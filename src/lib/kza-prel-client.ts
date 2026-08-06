import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface PrelGatewayOptions {
  functionId: string
  operation: string
  useCIP?: boolean
  useF2FA?: boolean
  longOp?: boolean
  sessionId?: string
  signal?: AbortSignal
}

export interface PrelGatewayResult {
  ok: boolean
  prel_token?: string
  context?: PrelContext
  error?: string
  code?: string
}

export interface PrelContext {
  user_id: string
  session_id: string
  function_id: string
  operation_scope: string[]
  chain_depth: number
  is_long_op: boolean
  expires_at: string
  long_op_expires_at: string | null
}

export interface PrelRefreshResult {
  ok: boolean
  expires_at: string
  long_op_expires_at: string
}

export interface PrelSession {
  user_id: string
  session_id: string
  function_id: string
  operation: string
  prel_token: string
  expires_at: number
  long_op_expires_at: number | null
  is_long_op: boolean
}

const KZA_PREL_URL = '/functions/v1/kza-prel'

export class KzaPrelClient {
  private supabase: SupabaseClient
  private sessions: Map<string, PrelSession> = new Map()
  private refreshIntervals: Map<string, number> = new Map()

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase
  }

  async authenticate(
    functionId: string,
    operation: string = 'default',
    options: {
      useCIP?: boolean
      useF2FA?: boolean
      longOp?: boolean
      sessionId?: string
    } = {}
  ): Promise<PrelGatewayResult> {
    const sessionId = options.sessionId || crypto.randomUUID?.() || this.generateId()

    const cip = options.useCIP
      ? await this.generateCIP()
      : undefined

    const f2fa = options.useF2FA
      ? await this.getF2FA(functionId, sessionId)
      : undefined

    const result = await this.callGateway(functionId, operation, sessionId, options, cip, f2fa)

    // CIP proof-of-work: server issued a challenge — solve and retry once
    if (result.code === 'KZA_PREL_CIP_POW' && options.useCIP && result.challenge) {
      const powSolution = await this.solveCIPChallenge(result.challenge, cip!, result.pow_bits ?? 0)
      const retried = await this.callGateway(functionId, operation, sessionId, options, `${cip}.${powSolution}`, f2fa)
      return retried
    }

    return result
  }

  private async callGateway(
    functionId: string,
    operation: string,
    sessionId: string,
    options: { longOp?: boolean },
    cip: string | undefined,
    f2fa: string | undefined
  ): Promise<PrelGatewayResult> {
    const { data: authData } = await this.supabase.auth.getSession()
    const authHeader = authData?.session?.access_token
      ? `Bearer ${authData.session.access_token}`
      : ''

    const body: Record<string, unknown> = {
      function_id: functionId,
      operation,
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': authHeader,
      'X-PREL-Session': sessionId,
      'X-PREL-Long-Op': String(!!options.longOp),
    }

    if (cip) headers['X-CIP'] = cip
    if (f2fa) headers['X-F2FA'] = f2fa

    const { data, error } = await this.supabase.functions.invoke('kza-prel/gateway', {
      body,
      headers,
    })

    if (error) {
      return { ok: false, error: error.message, code: 'KZA_PREL_ERROR' }
    }

    const result = data as PrelGatewayResult & { challenge?: string; pow_bits?: number }

    if (result.ok && result.prel_token && result.context) {
      this.cacheSession({
        user_id: result.context.user_id,
        session_id: result.context.session_id,
        function_id,
        operation,
        prel_token: result.prel_token,
        expires_at: new Date(result.context.expires_at).getTime(),
        long_op_expires_at: result.context.long_op_expires_at
          ? new Date(result.context.long_op_expires_at).getTime()
          : null,
        is_long_op: result.context.is_long_op,
      })
    }

    return result
  }

  async validate(
    targetFunctionId: string,
    options: {
      longOp?: boolean
      signal?: AbortSignal
    } = {}
  ): Promise<PrelGatewayResult> {
    const session = this.getSession(targetFunctionId)
    if (!session) {
      return { ok: false, error: 'No cached PREL session', code: 'KZA_PREL_MISSING' }
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-PREL-Token': session.prel_token,
      'X-PREL-Function': targetFunctionId,
      'X-PREL-Long-Op': String(!!options.longOp),
    }

    const { data, error } = await this.supabase.functions.invoke('kza-prel/validate', {
      body: {},
      headers: {
        'Content-Type': 'application/json',
        'X-PREL-Token': session.prel_token,
        'X-PREL-Function': targetFunctionId,
        'X-PREL-Long-Op': String(!!options.longOp),
      },
    })

    if (error) {
      this.sessions.delete(targetFunctionId)
      return { ok: false, error: error.message, code: 'KZA_PREL_ERROR' }
    }

    const result = data as PrelGatewayResult

    if (result.ok && result.prel_token && result.context) {
      this.cacheSession({
        user_id: result.context.user_id,
        session_id: result.context.session_id,
        function_id: targetFunctionId,
        operation: result.context.operation_scope?.[0] || 'default',
        prel_token: result.prel_token,
        expires_at: new Date(result.context.expires_at).getTime(),
        long_op_expires_at: result.context.long_op_expires_at
          ? new Date(result.context.long_op_expires_at).getTime()
          : null,
        is_long_op: result.context.is_long_op,
      })
    }

    return result
  }

  async refresh(
    functionId: string,
    extendSeconds: number = 300
  ): Promise<PrelRefreshResult> {
    const session = this.getSession(functionId)
    if (!session) {
      return { ok: false, expires_at: '', long_op_expires_at: '' } as unknown as PrelRefreshResult
    }

    const { data, error } = await this.supabase.functions.invoke('kza-prel/refresh', {
      body: {},
      headers: {
        'Content-Type': 'application/json',
        'X-PREL-Token': session.prel_token,
        'X-PREL-Extend': String(extendSeconds),
      },
    })

    if (error || !data?.ok) {
      return { ok: false, expires_at: '', long_op_expires_at: '' } as unknown as PrelRefreshResult
    }

    // Update cached session
    session.expires_at = new Date(data.expires_at).getTime()
    session.long_op_expires_at = data.long_op_expires_at
      ? new Date(data.long_op_expires_at).getTime()
      : null
    this.sessions.set(functionId, session)

    return data as PrelRefreshResult
  }

  async revoke(userId?: string, sessionId?: string): Promise<boolean> {
    const { data, error } = await this.supabase.functions.invoke('kza-prel/revoke', {
      body: {
        user_id: userId,
        session_id: sessionId,
      },
    })

    if (!error && data?.ok) {
      this.sessions.clear()
      return true
    }
    return false
  }

  getSession(functionId: string): PrelSession | undefined {
    return this.sessions.get(functionId)
  }

  getSessions(): Map<string, PrelSession> {
    return new Map(this.sessions)
  }

  clearSession(functionId: string): void {
    this.clearRefreshInterval(functionId)
    this.sessions.delete(functionId)
  }

  clearAllSessions(): void {
    for (const fnId of this.sessions.keys()) {
      this.clearRefreshInterval(fnId)
    }
    this.sessions.clear()
  }

  startAutoRefresh(
    functionId: string,
    intervalMs: number = 120_000
  ): void {
    this.stopAutoRefresh(functionId)
    const id = setInterval(async () => {
      const session = this.getSession(functionId)
      if (!session) {
        this.stopAutoRefresh(functionId)
        return
      }
      await this.refresh(functionId, Math.ceil(intervalMs / 1000))
    }, intervalMs)
    this.refreshIntervals.set(functionId, id as unknown as number)
  }

  stopAutoRefresh(functionId: string): void {
    this.clearRefreshInterval(functionId)
  }

  private clearRefreshInterval(functionId: string): void {
    const id = this.refreshIntervals.get(functionId)
    if (id !== undefined) {
      clearInterval(id)
      this.refreshIntervals.delete(functionId)
    }
  }

  private cacheSession(session: PrelSession): void {
    this.sessions.set(session.function_id, session)
  }

  async generateCIP(): Promise<string> {
    const buildVersion = '1.0.0'
    const entropyArr = new Uint8Array(32)
    crypto.getRandomValues(entropyArr)

    const entropyHash = Array.from(entropyArr)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    const timing = new Uint8Array(4)
    crypto.getRandomValues(timing)
    const timingDelta = 50 + (timing[0] % 450)

    const finalHash = await this.sha256(entropyHash + timingDelta)
    return `${buildVersion}.${finalHash.substring(0, 64)}.${timingDelta}`
  }

  async getF2FA(functionId: string, sessionId: string): Promise<string> {
    const { data: { user } } = await this.supabase.auth.getUser()

    const { data: seedData, error: seedError } = await this.supabase.rpc(
      'kza_prel_generate_f2fa_seed',
      {
        p_user_id: user?.id,
        p_function_id: functionId,
        p_session_nonce: sessionId,
      }
    )

    if (seedError || !seedData) {
      throw new Error(`KZA_F2FA_SEED_UNAVAILABLE: ${seedError?.message ?? 'no seed'}`)
    }

    const seed = String(seedData)
    const currentWindow = Math.floor(Date.now() / 30000)
    return await this.computeF2FACode(seed, functionId, currentWindow)
  }

  async solveCIPChallenge(challenge: string, cip: string, powBits: number): Promise<string> {
    const [, hash] = cip.split('.')
    const target = Math.ceil(powBits / 4)
    if (!target) return ''
    for (let nonce = 0; nonce < 2_000_000; nonce++) {
      const candidate = `${challenge}:${hash}:${nonce}`
      const digest = await this.sha256(candidate)
      if (digest.startsWith('0'.repeat(target))) {
        return String(nonce)
      }
    }
    return ''
  }

  private async computeF2FACode(seed: string, functionId: string, window: number): Promise<string> {
    const encoder = new TextEncoder()
    const windowBytes = new Uint8Array(8)
    for (let i = 0; i < 8; i++) {
      windowBytes[i] = (window >> (i * 8)) & 0xff
    }

    const input = encoder.encode(seed + functionId)
    const combined = new Uint8Array(input.length + 8)
    combined.set(input)
    combined.set(windowBytes, input.length)

    const hashBuffer = await crypto.subtle.digest('SHA-256', combined)
    const hashArray = new Uint8Array(hashBuffer)

    let code = 0
    for (let i = 0; i < 3; i++) {
      const block = new DataView(hashArray.slice(i * 8, i * 8 + 8).buffer)
      code ^= block.getUint32(0, true)
      code ^= block.getUint32(4, true)
    }

    return String(code % 100000000).padStart(8, '0')
  }

  private async sha256(input: string): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  }

  private generateId(): string {
    return Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  }
}

export function createPrelClient(supabase: SupabaseClient): KzaPrelClient {
  return new KzaPrelClient(supabase)
}
