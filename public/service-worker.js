const CACHE_NAME = 'squidcloud-v12.0.17-1782975900953';
const API_CACHE = 'api-cache-v2';
const STATIC_CACHE = 'static-cache-v3';

const urlsToCache = ['/', '/index.html', '/manifest.json', '/favicon.ico'];

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

// Stream Request Map
self.streamRequests = new Map();

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // 🚀 THE VIRTUAL SERVER: Intercept video range requests
  if (url.pathname.startsWith('/virtual-stream/')) {
    const fileId = url.pathname.split('/').pop();
    const rangeHeader = event.request.headers.get('range') || 'bytes=0-';

    event.respondWith(
      new Promise((resolve, reject) => {
        const requestId = Date.now().toString() + Math.random().toString();
        
        self.streamRequests.set(requestId, { resolve, reject });

        // Ask the React app to decrypt this specific byte range
        self.clients.matchAll({ type: 'window' }).then(clients => {
          if (!clients || clients.length === 0) {
            return reject(new Error('No active window to process decryption'));
          }
          clients[0].postMessage({
            type: 'REQUEST_DECRYPT_STREAM',
            fileId,
            range: rangeHeader,
            requestId
          });
        });
        
        // Timeout to prevent infinite hanging
        setTimeout(() => {
          if (self.streamRequests.has(requestId)) {
            self.streamRequests.delete(requestId);
            reject(new Error('Stream decryption timeout'));
          }
        }, 15000);
      })
    );
    return;
  }

  // Fallback to your standard network fetch for everything else
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});

// Listen for decrypted data from the React app
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'DECRYPT_STREAM_RESPONSE') {
    const { requestId, buffer, start, end, totalSize, contentType } = event.data;
    
    if (self.streamRequests && self.streamRequests.has(requestId)) {
      const { resolve } = self.streamRequests.get(requestId);
      
      const headers = new Headers({
        'Content-Type': contentType || 'video/mp4',
        'Accept-Ranges': 'bytes',
        'Content-Range': `bytes ${start}-${end}/${totalSize}`,
        'Content-Length': buffer.byteLength,
      });
      
      // Serve the partial content exactly like a real backend server!
      resolve(new Response(buffer, { status: 206, headers }));
      self.streamRequests.delete(requestId);
    }
  }
});
