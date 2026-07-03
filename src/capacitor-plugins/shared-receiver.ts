import { PluginListenerHandle, registerPlugin } from '@capacitor/core';

export interface SharedFile {
  uri: string; // platform-specific URI
  mimeType?: string;
  name?: string;
  size?: number;
}

export interface SharedFilesEvent {
  files: SharedFile[];
}

export interface SharedReceiverPlugin {
  addListener(eventName: 'sharedFiles', listenerFunc: (event: SharedFilesEvent) => void): Promise<PluginListenerHandle>;
  getInitialSharedFiles(): Promise<SharedFilesEvent>; // when app launches from intent
  clearSharedFiles(): Promise<void>; // clear ghost loop
}

const SharedReceiver = registerPlugin<SharedReceiverPlugin>('SharedReceiver', {
  web: {
    // Web fallback: check window.__INITIAL_SHARED_FILES if the native code injected any
    async addListener(_eventName: 'sharedFiles', _listenerFunc: (event: SharedFilesEvent) => void) {
      // Provide a web fallback: listen for a DOM CustomEvent named 'squidcloud:sharedFiles'
      const handler = (ev: Event) => {
        try {
          const detail = (ev as CustomEvent).detail as SharedFile[] | { files: SharedFile[] };
          if (Array.isArray(detail)) {
            _listenerFunc({ files: detail as SharedFile[] });
          } else if ((detail as any).files) {
            _listenerFunc({ files: (detail as any).files as SharedFile[] });
          }
        } catch (_e) {
          // ignore
        }
      };
      window.addEventListener('squidcloud:sharedFiles', handler as EventListener);

      return {
        remove: async () => {
          window.removeEventListener('squidcloud:sharedFiles', handler as EventListener);
        }
      };
    },
    async getInitialSharedFiles() {
      // If hosting in a Web context with query params, parse them here. Default: none.
      const params = new URLSearchParams(location.search);
      const initial = params.get('sharedFiles');
      if (initial) {
        try {
          const parsed = JSON.parse(decodeURIComponent(initial));
          return { files: Array.isArray(parsed) ? parsed : [] };
        } catch (_e) {
          return { files: [] };
        }
      }
      return { files: [] };
    },
    async clearSharedFiles() {
      // web clear
      const url = new URL(window.location.href);
      url.searchParams.delete('sharedFiles');
      window.history.replaceState({}, '', url.toString());
    }
  }
});

export default SharedReceiver;

// Convenience helper for web consumers: register a callback for incoming shared files
export const onSharedFiles = (cb: (files: SharedFile[]) => void) => {
  // First try native plugin listener (Capacitor runtime will route to native)
  try {
    SharedReceiver.addListener('sharedFiles', (event) => cb(event.files || []));
  } catch (_e) {
    // ignore
  }

  // Also register the web CustomEvent fallback so hosting pages can dispatch synthetic events
  const handler = (ev: Event) => {
    const detail = (ev as CustomEvent).detail as SharedFile[] | { files: SharedFile[] } | undefined;
    if (!detail) return;
    if (Array.isArray(detail)) cb(detail as SharedFile[]);
    else if ((detail as any).files) cb((detail as any).files as SharedFile[]);
  };
  window.addEventListener('squidcloud:sharedFiles', handler as EventListener);
  return () => window.removeEventListener('squidcloud:sharedFiles', handler as EventListener);
};
