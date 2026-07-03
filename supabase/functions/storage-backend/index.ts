import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { withPrelGateway, jsonResponse, PrelContext } from '../_shared/kza-prel.ts'
import { registerAdapter, getAdapter, listAdapterTypes } from '../_shared/storage-adapter.ts'
import { GithubAdapter } from '../_shared/adapters/github.ts'
import { pasteCNetAdapter } from '../_shared/adapters/paste-c-net.ts'
import { pasteRsAdapter } from '../_shared/adapters/paste-rs.ts'
import { fileIoAdapter } from '../_shared/adapters/file-io.ts'
import { ipfsAdapter } from '../_shared/adapters/ipfs.ts'
import { usenetAdapter } from '../_shared/adapters/usenet.ts'
import { createManifest, saveManifest, loadManifest, parseManifest, ChunkEntry } from '../_shared/ao56fj3.ts'
import { planPlacement, PlacementDecision } from '../_shared/ao56fj3-placer.ts'

registerAdapter(pasteCNetAdapter)
registerAdapter(pasteRsAdapter)
registerAdapter(fileIoAdapter)
registerAdapter(ipfsAdapter)
registerAdapter(usenetAdapter)

serve(async (req) => {
  return withPrelGateway(req, { functionId: 'storage-backend', operation: 'default' }, async (ctx: PrelContext) => {
    try {
      const GITHUB_TOKEN = Deno.env.get('GITHUB_TOKEN') || ''
      const GITHUB_USERNAME = Deno.env.get('GITHUB_USERNAME') || ''
      const GITHUB_TOKEN_2 = Deno.env.get('GITHUB_TOKEN_2') || ''
      const GITHUB_USERNAME_2 = Deno.env.get('GITHUB_USERNAME_2') || ''
      const GITHUB_TOKEN_3 = Deno.env.get('GITHUB_TOKEN_3') || ''
      const GITHUB_USERNAME_3 = Deno.env.get('GITHUB_USERNAME_3') || ''
      const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
      const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

      if (GITHUB_TOKEN && GITHUB_USERNAME) registerAdapter(new GithubAdapter(GITHUB_TOKEN, GITHUB_USERNAME))
      if (GITHUB_TOKEN_2 && GITHUB_USERNAME_2) registerAdapter(new GithubAdapter(GITHUB_TOKEN_2, GITHUB_USERNAME_2))
      if (GITHUB_TOKEN_3 && GITHUB_USERNAME_3) registerAdapter(new GithubAdapter(GITHUB_TOKEN_3, GITHUB_USERNAME_3))

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

      const body = await req.json() as Record<string, unknown>
      const action = body.action as string

      switch (action) {

        case 'store-chunk': {
          const chunkData = body.chunkData as number[] | undefined
          const chunkIndex = body.chunkIndex as number
          const totalChunks = body.totalChunks as number
          const fileId = body.fileId as string
          const totalSize = body.totalSize as number
          const chunkSize = body.chunkSize as number
          const providerType = body.providerType as string | undefined

          if (!chunkData || fileId === undefined) {
            return jsonResponse({ error: 'chunkData and fileId required' }, 400)
          }

          const blob = new Uint8Array(chunkData)
          let chunkProviderType = providerType

          if (!chunkProviderType) {
            const decisions = planPlacement(ctx, totalChunks, totalSize, chunkSize)
            const decision = decisions.find(d => d.chunkIndex === chunkIndex)
            chunkProviderType = decision?.providerType || 'paste_c_net'
          }

          const adapter = getAdapter(chunkProviderType)
          if (!adapter) return jsonResponse({ error: `unknown provider: ${chunkProviderType}` }, 400)

          if (blob.length > adapter.maxBlobSize()) {
            return jsonResponse({ error: `chunk ${blob.length}B exceeds ${adapter.providerType} limit ${adapter.maxBlobSize()}B` }, 413)
          }

          const result = await adapter.store(ctx, blob, {
            chunkIndex: String(chunkIndex),
            totalChunks: String(totalChunks),
            userId: ctx.userId,
            fileId,
          })

          return jsonResponse({
            success: true,
            ref: result.ref,
            providerType: chunkProviderType,
            url: result.url,
          })
        }

        case 'retrieve-chunk': {
          const ref = body.ref as string
          const providerType = body.providerType as string
          if (!ref || !providerType) return jsonResponse({ error: 'ref and providerType required' }, 400)

          const adapter = getAdapter(providerType)
          if (!adapter) return jsonResponse({ error: `unknown provider: ${providerType}` }, 400)

          const blob = await adapter.retrieve(ctx, ref)
          return jsonResponse({
            success: true,
            data: Array.from(blob),
            length: blob.length,
          })
        }

        case 'delete-chunk': {
          const ref = body.ref as string
          const providerType = body.providerType as string
          if (!ref || !providerType) return jsonResponse({ error: 'ref and providerType required' }, 400)

          const adapter = getAdapter(providerType)
          if (!adapter) return jsonResponse({ error: `unknown provider: ${providerType}` }, 400)

          const ok = await adapter.delete(ctx, ref)
          return jsonResponse({ success: ok })
        }

        case 'store-chunks': {
          const fileId = body.fileId as string
          const totalSize = body.totalSize as number
          const chunkSize = body.chunkSize as number
          const chunks = body.chunks as Array<{ index: number; data: number[]; providerType?: string }>

          if (!fileId || !chunks) return jsonResponse({ error: 'fileId and chunks required' }, 400)

          const entries: ChunkEntry[] = []
          const totalChunks = chunks.length

          let decisions: PlacementDecision[] | null = null
          if (!chunks[0]?.providerType) {
            decisions = planPlacement(ctx, totalChunks, totalSize, chunkSize)
          }

          for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i]
            const providerType = chunk.providerType || decisions![i].providerType
            const blob = new Uint8Array(chunk.data)
            const adapter = getAdapter(providerType)
            if (!adapter) {
              console.warn(`unknown provider ${providerType} for chunk ${i}, skipping`)
              continue
            }

            if (blob.length > adapter.maxBlobSize()) {
              console.warn(`chunk ${i} too large for ${providerType}, splitting not implemented yet`)
            }

            try {
              const result = await adapter.store(ctx, blob, {
                chunkIndex: String(chunk.index),
                totalChunks: String(totalChunks),
                userId: ctx.userId,
                fileId,
              })
              entries.push({
                chunkIndex: chunk.index,
                providerType,
                ref: result.ref,
                url: result.url,
                size: blob.length,
              })
            } catch (e) {
              console.error(`chunk ${i} store failed on ${providerType}:`, e)
              const fallback = 'paste_c_net'
              const fallbackAdapter = getAdapter(fallback)
              if (fallbackAdapter && fallback !== providerType) {
                const result = await fallbackAdapter.store(ctx, blob, {
                  chunkIndex: String(chunk.index), totalChunks: String(totalChunks), userId: ctx.userId, fileId,
                })
                entries.push({
                  chunkIndex: chunk.index,
                  providerType: fallback,
                  ref: result.ref,
                  url: result.url,
                  size: blob.length,
                })
              } else {
                throw e
              }
            }
          }

          const manifest = await createManifest(ctx.userId, fileId, totalSize, chunkSize, entries)
          await saveManifest(SUPABASE_URL, SUPABASE_SERVICE_KEY, fileId, manifest)

          return jsonResponse({
            success: true,
            chunksStored: entries.length,
            manifestVersion: 1,
          })
        }

        case 'retrieve-manifest': {
          const fileId = body.fileId as string
          if (!fileId) return jsonResponse({ error: 'fileId required' }, 400)

          const manifestRaw = await loadManifest(SUPABASE_URL, SUPABASE_SERVICE_KEY, fileId)
          if (!manifestRaw) return jsonResponse({ error: 'manifest not found' }, 404)

          const manifest = await parseManifest(ctx.userId, fileId, manifestRaw)
          return jsonResponse({
            success: true,
            manifest: {
              fileId: manifest.fileId,
              totalChunks: manifest.totalChunks,
              totalSize: manifest.totalSize,
              algorithm: manifest.algorithm,
              entries: manifest.entries.map(e => ({
                chunkIndex: e.chunkIndex,
                providerType: e.providerType,
                ref: e.ref,
                size: e.size,
              })),
            },
          })
        }

        case 'list-providers': {
          return jsonResponse({
            success: true,
            providers: listAdapterTypes().filter(t => !t.startsWith('github_')),
          })
        }

        case 'health': {
          const results: Record<string, boolean> = {}
          for (const type of listAdapterTypes()) {
            const adapter = getAdapter(type)
            if (adapter) {
              try { results[type] = await adapter.health() } catch { results[type] = false }
            }
          }
          return jsonResponse({ success: true, health: results })
        }

        default:
          return jsonResponse({ error: `unknown action: ${action}` }, 400)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('storage-backend error:', msg, e)
      return jsonResponse({ error: msg }, 500)
    }
  })
})
