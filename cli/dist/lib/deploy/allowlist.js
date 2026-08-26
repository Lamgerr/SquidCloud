const ALLOWED_EXTENSIONS = new Set([
  '.html', '.css', '.js', '.mjs', '.json', '.svg',
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.ico',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.mp4', '.webm', '.ogg', '.mp3', '.wav',
  '.pdf', '.txt', '.xml', '.map',
])

export function isAllowedFile(filePath) {
  const ext = filePath.toLowerCase().slice(filePath.lastIndexOf('.'))
  if (!ext) return false
  return ALLOWED_EXTENSIONS.has(ext)
}

export function getAllowedExtensions() {
  return [...ALLOWED_EXTENSIONS]
}
