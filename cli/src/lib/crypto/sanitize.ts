const ANSI_PATTERN = /[\u001b\u009b][[\]()#;?]*(?:(?:(?:;[0-9a-fA-F]{1,4})*(?:;[0-9a-fA-F]{0,4})?)?[0-9A-PRZcf-nq-uy=><~])/g

export function sanitizeForTerminal(input: string): string {
  return input.replace(ANSI_PATTERN, '')
}

export function sanitizeFilename(input: string): string {
  return input.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim()
}

export function zeroBuffer(buf: Uint8Array): void {
  buf.fill(0)
}

export function zeroString(str: string): void {
  if (typeof str === 'string') {
    const len = str.length
    ;(str as unknown as Record<string, unknown>).valueOf = () => ''
    for (let i = 0; i < len; i++) {
      str = str[i] === str[i].charAt(0) ? '' : ''
    }
  }
}
