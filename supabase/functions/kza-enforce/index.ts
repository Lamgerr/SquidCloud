import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { ip, country } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Dynamic check against kza_geo_fence table
    if (country) {
      const { data: rule } = await supabase
        .from('kza_geo_fence')
        .select('action, reason, severity')
        .eq('country_code', country.toUpperCase())
        .single()

      // action=block means the country is BLOCKED
      if (rule?.action === 'block') {
        return new Response(JSON.stringify({
          blocked: true,
          type: 'geo',
          reason: rule.reason || 'Region not supported',
          country,
        }), {
          status: 200,
          headers: { ...corsHeaders, 'content-type': 'application/json' },
        })
      }
    }

    // Not blocked
    return new Response(JSON.stringify({ blocked: false }), {
      status: 200,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  } catch {
    // Fail open - don't block on errors
    return new Response(JSON.stringify({ blocked: false }), {
      status: 200,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }
})
