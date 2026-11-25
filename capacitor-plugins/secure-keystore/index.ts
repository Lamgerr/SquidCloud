/** Typed bridge to the native Android SecureKeyStore plugin (hardened client). */
import { registerPlugin } from '@capacitor/core';

interface SecureKeyStorePlugin {
  wrap(options: { userId: string; wrappedMk: string }): Promise<{ iv: string; data: string }>;
  unwrap(options: { userId: string; iv: string; data: string }): Promise<{ wrappedMk: string }>;
  delete(options: { userId: string }): Promise<void>;
}

const SecureKeyStore = registerPlugin<SecureKeyStorePlugin>('SecureKeyStore');

export const nativeVault = {
  isAvailable: () => typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.(),
  wrap: (userId: string, wrappedMk: string) => SecureKeyStore.wrap({ userId, wrappedMk }),
  unwrap: (userId: string, iv: string, data: string) => SecureKeyStore.unwrap({ userId, iv, data }),
  delete: (userId: string) => SecureKeyStore.delete({ userId }),
};
