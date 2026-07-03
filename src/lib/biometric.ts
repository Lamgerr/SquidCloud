export type BiometricType = 'fingerprint' | 'face' | 'iris' | 'unknown'

interface BiometricResult {
  available: boolean
  type: BiometricType
  label: string
}

export async function detectBiometric(): Promise<BiometricResult> {
  const available = 'PublicKeyCredential' in window
  if (!available) return { available: false, type: 'unknown', label: 'Biometric' }

  try {
    const isUserVerifyingPlatformAuthenticatorAvailable =
      await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()

    if (!isUserVerifyingPlatformAuthenticatorAvailable) {
      return { available: false, type: 'unknown', label: 'Biometric' }
    }

    const ua = navigator.userAgent.toLowerCase()
    let type: BiometricType = 'unknown'
    let label = 'Biometric'

    if (/mac|iphone|ipad/.test(ua)) {
      if (/iphone|ipad/.test(ua)) {
        type = 'face'
        label = 'Face ID'
      } else if (/mac/.test(ua)) {
        if (ua.includes('touch')) {
          type = 'fingerprint'
          label = 'Touch ID'
        } else {
          type = 'face'
          label = 'Face ID'
        }
      }
    } else if (/android/.test(ua)) {
      type = 'fingerprint'
      label = 'Fingerprint'
    } else if (/win/.test(ua)) {
      type = 'fingerprint'
      label = 'Windows Hello'
    } else {
      type = 'fingerprint'
      label = 'Fingerprint'
    }

    return { available: true, type, label }
  } catch {
    return { available: false, type: 'unknown', label: 'Biometric' }
  }
}

export async function triggerBiometricSimple(
  userId: string,
  userEmail: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const challenge = new Uint8Array(32)
    crypto.getRandomValues(challenge)

    const credential = await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId: window.location.hostname,
        userVerification: 'required',
        allowCredentials: [],
      },
    } as any)

    if (!credential) {
      return { success: false, error: 'No credential' }
    }

    return { success: true }
  } catch (err: any) {
    const msg = err?.message || err?.name || 'Biometric verification failed'
    if (msg.includes('cancelled') || msg.includes('canceled') || msg.includes('AbortError')) {
      return { success: false, error: 'cancelled' }
    }
    return { success: false, error: 'failed' }
  }
}