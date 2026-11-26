import { supabase } from '@/integrations/supabase/client';

export interface PasskeyRegistrationResult {
  credentialId: string;
}

export interface PasskeyAuthResult {
  success: boolean;
  session?: any;
  user?: any;
  email?: string;
  redirect?: string;
}

export async function isPasskeyAvailable(): Promise<boolean> {
  if (!window.PublicKeyCredential) return false;
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

function base64UrlToBytes(str: string): Uint8Array {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64UrlToArrayBuffer(str: string): ArrayBuffer {
  return base64UrlToBytes(str).buffer;
}

function base64UrlToUint8Array(str: string): Uint8Array {
  return base64UrlToBytes(str);
}


async function getPublicKeyJwk(credential: PublicKeyCredential): Promise<JsonWebKey | null> {
  try {
    const att = credential.response as AuthenticatorAttestationResponse;
    const spki = att.getPublicKey?.();
    if (!spki) return null;
    const key = await crypto.subtle.importKey('spki', spki, { name: 'ECDSA', namedCurve: 'P-256' }, true, []);
    return await crypto.subtle.exportKey('jwk', key);
  } catch { return null; }
}

export async function registerPasskey(
  userId: string,
  email: string,
  displayName?: string
): Promise<PasskeyRegistrationResult | null> {
  try {
    const { data, error } = await supabase.functions.invoke('passkey-auth', {
      body: {
        action: 'register_options',
        user_id: userId,
        email,
        display_name: displayName || email,
      },
    });

    if (error || !data?.publicKey) return null;

    const { publicKey } = data;

    const creationOptions: PublicKeyCredentialCreationOptions = {
      rp: publicKey.rp,
      user: {
        id: base64UrlToUint8Array(publicKey.user.id),
        name: publicKey.user.name,
        displayName: publicKey.user.displayName,
      },
      challenge: base64UrlToArrayBuffer(publicKey.challenge),
      pubKeyCredParams: publicKey.pubKeyCredParams,
      authenticatorSelection: publicKey.authenticatorSelection,
      timeout: publicKey.timeout,
      attestation: publicKey.attestation,
    };

    const credential = await navigator.credentials.create({ publicKey: creationOptions }) as PublicKeyCredential;
    if (!credential) return null;

    const response = credential.response as AuthenticatorAttestationResponse;
    const clientDataJSON = arrayBufferToBase64Url(response.clientDataJSON);
    const attestationObject = arrayBufferToBase64Url(response.attestationObject);

    const { data: verifyData, error: verifyError } = await supabase.functions.invoke('passkey-auth', {
      body: {
        action: 'register_verify',
        user_id: userId,
        email,
        challenge_id: data.challenge_id,
        credential: {
          id: credential.id,
          rawId: arrayBufferToBase64Url(credential.rawId),
          response: { clientDataJSON, attestationObject },
          type: credential.type,
        },
        publicKeyJwk: await getPublicKeyJwk(credential),
      },
    });

    if (verifyError || !verifyData?.success) return null;
    return { credentialId: credential.id };
  } catch (error: any) {
    if (error.name === 'NotAllowedError') return null;
    console.error('Passkey registration error:', error);
    return null;
  }
}

export async function authenticateWithPasskey(email?: string): Promise<PasskeyAuthResult> {
  try {
    const { data, error } = await supabase.functions.invoke('passkey-auth', {
      body: { action: 'auth_options', email: email || null },
    });

    if (error || !data?.publicKey) return { success: false };

    const { publicKey } = data;

    const requestOptions: PublicKeyCredentialRequestOptions = {
      challenge: base64UrlToArrayBuffer(publicKey.challenge),
      timeout: publicKey.timeout,
      userVerification: publicKey.userVerification,
    };

    if (publicKey.rpId) requestOptions.rpId = publicKey.rpId;

    const credential = await navigator.credentials.get({
      publicKey: requestOptions,
      mediation: 'optional',
    }) as PublicKeyCredential;

    if (!credential) return { success: false };

    const response = credential.response as AuthenticatorAssertionResponse;

    const { data: verifyData, error: verifyError } = await supabase.functions.invoke('passkey-auth', {
      body: {
        action: 'auth_verify',
        challenge_id: data.challenge_id,
        credential: {
          id: credential.id,
          rawId: arrayBufferToBase64Url(credential.rawId),
          response: {
            clientDataJSON: arrayBufferToBase64Url(response.clientDataJSON),
            authenticatorData: arrayBufferToBase64Url(response.authenticatorData),
            signature: arrayBufferToBase64Url(response.signature),
            userHandle: response.userHandle ? arrayBufferToBase64Url(response.userHandle) : null,
          },
          type: credential.type,
        },
      },
    });

    if (verifyError) return { success: false };

    if (verifyData?.otp) {
      const { data: otpData, error: otpError } = await supabase.auth.verifyOtp({
        email: verifyData.email,
        token: verifyData.otp,
        type: verifyData.verification_type || 'magiclink',
      });
      if (otpError || !otpData?.session) return { success: false };
      return { success: true, session: otpData.session, email: verifyData.email };
    }

    return verifyData;
  } catch (error: any) {
    if (error.name === 'NotAllowedError') return { success: false };
    console.error('Passkey auth error:', error);
    return { success: false };
  }
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
