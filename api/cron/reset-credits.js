/**
 * SquidCloud API Credit Reset Cron
 * Triggered daily at 00:05 UTC via vercel.json cron config
 * Resets all user credit balances to their daily limit
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://aouqcwbdoyrccjcrhzzi.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const CRON_SECRET = process.env.CRON_SECRET

export const config = { runtime: 'edge' }

export default async function handler(req) {
  // Verify it's actually Vercel cron calling us
  const userAgent = req.headers.get('user-agent') || ''
  const cronHeader = req.headers.get('x-vercel-cron-schedule')

  if (!userAgent.includes('vercel-cron') && !cronHeader) {
    // Allow manual trigger with secret key
    const authHeader = req.headers.get('authorization') || req.headers.get('x-cron-secret')
    if (authHeader !== `Bearer ${CRON_SECRET}` && authHeader !== CRON_SECRET) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: 'Service role key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/reset_all_api_credits`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    })

    const result = await response.json()

    return new Response(JSON.stringify({
      success: true,
      message: 'API credits reset scheduled',
      reset_count: result,
      timestamp: new Date().toISOString(),
      cron_schedule: cronHeader || 'manual',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Credit reset failed',
      detail: error.message,
      timestamp: new Date().toISOString(),
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
