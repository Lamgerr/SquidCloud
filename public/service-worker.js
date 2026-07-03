const CACHE_NAME = 'squidcloud-v12.0.18-streamer';
const API_CACHE = 'api-cache-v2';
const STATIC_CACHE = 'static-cache-v3';

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.streamRequests = new Map();

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // 🚀 VIRTUAL STREAM INTERCEPTOR: Safe HTTP 206 Partial Content handling
  if (url.pathname.startsWith('/virtual-stream/')) {
    const fileId = url.pathname.split('/').pop();
    const rangeHeader = event.request.headers.get('range') || 'bytes=0-';

    event.respondWith(
      new Promise((resolve) => {
        const requestId = Date.now().toString() + '-' + Math.random().toString(36).substring(2, 9);
        
        // Timeout set to 60s for multi-megabyte chunk decryption over slow networks
        const timeoutTimer = setTimeout(() => {
          if (self.streamRequests.has(requestId)) {
            self.streamRequests.delete(requestId);
            console.warn(`[SW] Stream decryption timed out for request ${requestId}`);
            // Resolve with HTTP 504 Gateway Timeout so <video> onError catches it gracefully
            resolve(new Response('Stream Decryption Timeout', { status: 504 }));
          }
        }, 60000);

        self.streamRequests.set(requestId, { resolve, timeoutTimer });

        self.clients.matchAll({ type: 'window' }).then(clients => {
          if (!clients || clients.length === 0) {
            clearTimeout(timeoutTimer);
            self.streamRequests.delete(requestId);
            return resolve(new Response('No active client window found', { status: 503 }));
          }
          clients[0].postMessage({
            type: 'REQUEST_DECRYPT_STREAM',
            fileId,
            range: rangeHeader,
            requestId
          });
        }).catch(err => {
          clearTimeout(timeoutTimer);
          self.streamRequests.delete(requestId);
          resolve(new Response('Client IPC Error: ' + err.message, { status: 500 }));
        });
      })
    );
    return;
  }

  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'DECRYPT_STREAM_RESPONSE') {
    const { requestId, buffer, start, end, totalSize, contentType, error } = event.data;
    
    if (self.streamRequests && self.streamRequests.has(requestId)) {
      const { resolve, timeoutTimer } = self.streamRequests.get(requestId);
      clearTimeout(timeoutTimer);
      self.streamRequests.delete(requestId);

      if (error || !buffer) {
        return resolve(new Response(error || 'Decryption failed', { status: 500 }));
      }
      
      const headers = new Headers({
        'Content-Type': contentType || 'video/mp4',
        'Accept-Ranges': 'bytes',
        'Content-Range': `bytes ${start}-${end}/${totalSize}`,
        'Content-Length': buffer.byteLength.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      });
      
      resolve(new Response(buffer, { status: 206, headers }));
    }
  }
});
