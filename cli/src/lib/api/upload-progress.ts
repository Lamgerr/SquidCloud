import https from 'node:https'
import http from 'node:http'

function buildMultipart(fileContent: Buffer, filename: string, boundary: string): Buffer {
  const header = Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
    `Content-Type: application/octet-stream\r\n\r\n`
  )
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`)
  return Buffer.concat([header, fileContent, footer])
}

export function uploadFileWithProgress(
  url: string,
  fileContent: Buffer,
  filename: string,
  headers: Record<string, string>,
  onProgress: (bytes: number) => void,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const boundary = `----FormBoundary${Math.random().toString(36).slice(2, 12)}`
    const body = buildMultipart(fileContent, filename, boundary)
    const total = body.length

    const urlObj = new URL(url)
    const isHttps = urlObj.protocol === 'https:'
    const mod = isHttps ? https : http

    const reqHeaders: Record<string, string> = {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': String(total),
      ...headers,
    }

    const options: http.RequestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: reqHeaders,
    }

    const req = mod.request(options, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () => {
        const body = Buffer.concat(chunks)
        const resp = new Response(body, {
          status: res.statusCode ?? 200,
          statusText: res.statusMessage ?? 'OK',
          headers: new Headers(res.headers as Record<string, string>),
        })
        resolve(resp)
      })
    })

    req.on('error', (err) => reject(err))

    let uploaded = 0
    const chunkSize = 65536
    let offset = 0

    function writeNext(): void {
      if (offset >= total) {
        req.end()
        return
      }
      const end = Math.min(offset + chunkSize, total)
      const chunk = body.subarray(offset, end)
      const canContinue = req.write(chunk)
      uploaded = end
      onProgress(uploaded)
      if (canContinue) {
        offset = end
        writeNext()
      } else {
        req.once('drain', () => {
          offset = end
          writeNext()
        })
      }
    }

    writeNext()
  })
}
