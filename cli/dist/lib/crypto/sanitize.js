const ANSI_PATTERN = /[\u001b\u009b][[\]()#;?]*(?:(?:(?:;[0-9a-fA-F]{1,4})*(?:;[0-9a-fA-F]{0,4})?)?[0-9A-PRZcf-nq-uy=><~])/g

export function sanitizeForTerminal(input) {
  return input.replace(ANSI_PATTERN, '')
}

export function sanitizeFilename(input) {
  return input.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim()
}

export function zeroBuffer(buf) {
  buf.fill(0)
}

export function zeroString(str) {
  if (typeof str === 'string') {
    const len = str.length
    ;(str ).valueOf = () => ''
    for (let i = 0; i < len; i++) {
      str = str[i] === str[i].charAt(0) ? '' : ''
    }
  }
}
