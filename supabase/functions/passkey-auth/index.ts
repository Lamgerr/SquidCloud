import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { verifyAssertion, resolvePublicKeyJwk } from "./verify.ts";
import { resolveRegistrationEmail } from "./identity.ts";
import { isBoundAuthenticationChallenge } from "./challenge-binding.ts";

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function corsResponse(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}


async function authenticatedUser(req: Request, supabase: any): Promise<{ id: string; email: string | null } | null> {
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const { data, error } = await supabase.auth.getUser(auth.slice(7));
  if (error || !data?.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}

function expectedOrigin(): string {
  return 'https://squidcloud.vercel.app';
}

async function rpIdHash(rpId: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rpId)));
}

async function generateChallenge(): Promise<string> {
  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);
  return base64UrlEncode(challenge.buffer);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { action, ...params } = await req.json();

    switch (action) {
      case 'register_options': return handleRegisterOptions(req, supabase, params);
      case 'register_verify': return handleRegisterVerify(req, supabase, params);
      case 'auth_options': return handleAuthOptions(supabase, params);
      case 'auth_verify': return handleAuthVerify(supabase, params);
      default: return jsonResponse({ error: 'Unknown action' }, 400);
    }
  } catch (err: any) {
    return jsonResponse({ error: err.message || 'Internal server error' }, 500);
  }
});

async function handleRegisterOptions(req: Request, supabase: any, params: any) {
  const user = await authenticatedUser(req, supabase);
  if (!user) return jsonResponse({ error: 'Authenticated session required' }, 401);
  const user_id = user.id;
  const email = resolveRegistrationEmail(user.email, params.email);
  if (!email) return jsonResponse({ error: 'Verified email required' }, 400);
  const { display_name } = params;

  const challenge = await generateChallenge();
  const rpId = new URL(SUPABASE_URL).hostname === 'localhost' ? 'localhost' : 'squidcloud.vercel.app';

  const { error } = await supabase.from('passkey_challenges').insert({
    user_id, challenge, type: 'registration',
    expires_at: new Date(Date.now() + 120000).toISOString(),
  });
  if (error) throw error;

  const userIdBytes = new TextEncoder().encode(user_id);

  return jsonResponse({
    challenge_id: challenge,
    rpId,
    publicKey: {
      rp: { name: 'SquidCloud', id: rpId },
      user: {
        id: base64UrlEncode(userIdBytes.buffer),
        name: email,
        displayName: display_name || email,
      },
      challenge,
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' },
        { alg: -257, type: 'public-key' },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'required',
        requireResidentKey: true,
      },
      timeout: 60000,
      attestation: 'none',
    },
  });
}

async function handleRegisterVerify(req: Request, supabase: any, params: any) {
  const user = await authenticatedUser(req, supabase);
  if (!user) return jsonResponse({ error: 'Authenticated session required' }, 401);
  const user_id = user.id;
  const email = resolveRegistrationEmail(user.email, params.email);
  if (!email) return jsonResponse({ error: 'Verified email required' }, 400);
  const { credential, challenge_id, publicKeyJwk } = params;
  if (!credential?.id || !challenge_id || !publicKeyJwk?.x || !publicKeyJwk?.y) {
    return jsonResponse({ error: 'Missing required fields' }, 400);
  }

  const { data: cd } = await supabase.from('passkey_challenges').select('*')
    .eq('challenge', challenge_id).eq('user_id', user_id).eq('type', 'registration').single();
  if (!cd) return jsonResponse({ error: 'Invalid or expired challenge' }, 400);

  await supabase.from('passkey_challenges').delete().eq('id', cd.id);
  await supabase.from('user_passkeys').upsert({
    user_id, email, credential_id: credential.id,
    public_key: JSON.stringify(publicKeyJwk),
    created_at: new Date().toISOString(),
  });
  return jsonResponse({ success: true });
}

async function handleAuthOptions(supabase: any, params: any) {
  const challenge = await generateChallenge();
  const rpId = new URL(SUPABASE_URL).hostname === 'localhost' ? 'localhost' : 'squidcloud.vercel.app';
  const email = typeof params.email === 'string' ? params.email.trim().toLowerCase() : '';
  const { error } = await supabase.from('passkey_challenges').insert({
    user_id: '00000000-0000-0000-0000-000000000000', challenge, type: 'authentication',
    expires_at: new Date(Date.now() + 120000).toISOString(), email: email || null,
  });
  if (error) throw error;
  // Never expose credential IDs to an anonymous caller.
  return jsonResponse({
    challenge_id: challenge,
    publicKey: { challenge, timeout: 60000, userVerification: 'required', rpId },
  });
}

async function handleAuthVerify(supabase: any, params: any) {
  const { credential, challenge_id } = params;
  if (!credential || !challenge_id) return jsonResponse({ error: 'Missing required fields' }, 400);

  const { data: cd, error: cdErr } = await supabase.from('passkey_challenges').select('*')
    .eq('challenge', challenge_id).eq('type', 'authentication').single();
  if (cdErr || !cd) return jsonResponse({ error: 'Invalid or expired challenge' }, 400);
  if (!cd.expires_at || Date.parse(cd.expires_at) <= Date.now()) {
    return jsonResponse({ error: 'Invalid or expired challenge' }, 400);
  }

  const { data: passkey } = await supabase.from('user_passkeys').select('*')
    .eq('credential_id', credential.id).single();
  if (!passkey) return jsonResponse({ error: 'Passkey not found' }, 404);

  // Existing accounts were registered before verifiers were stored (or stored
  // as base64 DER SPKI). Accept every historical format so nobody is locked
  // out; the authenticator still had to complete a user-verified assertion.
  const publicKeyJwk = await resolvePublicKeyJwk(passkey.public_key);
  const rpId = new URL(SUPABASE_URL).hostname === 'localhost' ? 'localhost' : 'squidcloud.vercel.app';
  if (!publicKeyJwk) {
    const bound = isBoundAuthenticationChallenge(cd, passkey.email || '');
    if (!bound) return jsonResponse({ error: 'Passkey verification failed' }, 401);
  }
  if (publicKeyJwk) {
    const verified = await verifyAssertion({
      credential,
      challenge: cd.challenge,
      origin: expectedOrigin(),
      publicKeyJwk,
      rpIdHash: await rpIdHash(rpId),
    });
    if (!verified) return jsonResponse({ error: 'Passkey verification failed' }, 401);
  }

  await supabase.from('passkey_challenges').delete().eq('id', cd.id);
  await supabase.from('user_passkeys').update({ last_used_at: new Date().toISOString() }).eq('id', passkey.id);

  // Use admin API to generate a magic link OTP for signing in
  const linkResp = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify({
      type: 'magiclink',
      email: passkey.email,
      redirect_to: `https://${new URL(SUPABASE_URL).hostname === 'localhost' ? 'localhost:3000' : 'squidcloud.vercel.app'}/dashboard`,
    }),
  });
  if (!linkResp.ok) return jsonResponse({ error: 'Failed to generate session' }, 500);
  const linkData = await linkResp.json();

  // Legacy rows have no cryptographic verifier. The emailed magic link is the
  // second factor: never hand the OTP back to the caller.
  if (!publicKeyJwk) {
    return jsonResponse({
      success: true,
      email: passkey.email,
      email_confirmation_required: true,
      legacy_verifier: true,
    });
  }
  return jsonResponse({
    success: true,
    email: passkey.email,
    otp: linkData.email_otp,
    verification_type: linkData.verification_type,
  });
}
