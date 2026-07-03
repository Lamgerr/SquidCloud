
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { withPrelGateway, jsonResponse, getCorsHeaders, PrelContext } from '../_shared/kza-prel.ts';

const ALLOWED_ENDPOINT_PATTERNS = [
  /^users\/[A-Za-z0-9-]+$/,
  /^users\/[A-Za-z0-9-]+\/repos$/,
  /^repos\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/,
  /^rate_limit$/,
];

function isAllowedEndpoint(endpoint: string): boolean {
  if (!endpoint || endpoint.includes('://') || endpoint.startsWith('/') || endpoint.includes('..') || endpoint.includes('?')) {
    return false;
  }
  return ALLOWED_ENDPOINT_PATTERNS.some((pattern) => pattern.test(endpoint));
}

serve(async (req) => {
  return withPrelGateway(req, { functionId: 'github-api', operation: 'default' }, async (ctx: PrelContext) => {
    const GITHUB_TOKEN = Deno.env.get('GITHUB_TOKEN');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!GITHUB_TOKEN || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse({ error: 'Required edge configuration missing' }, 500);
    }

    try {
      const { endpoint, params } = await req.json();
      
      if (!endpoint) {
        return jsonResponse({ error: 'GitHub API endpoint is required' }, 400);
      }

      const normalizedEndpoint = String(endpoint).trim();
      if (!isAllowedEndpoint(normalizedEndpoint)) {
        return jsonResponse({ error: 'Endpoint is not allowed by policy' }, 403);
      }
      
      const url = new URL(`https://api.github.com/${normalizedEndpoint}`);
      
      if (params) {
        const entries = Object.entries(params as Record<string, unknown>);
        for (const [key, value] of entries) {
          if (['string', 'number', 'boolean'].includes(typeof value)) {
            url.searchParams.append(key, String(value));
          } else {
            return jsonResponse({ error: `Invalid query param type for key: ${key}` }, 400);
          }
        }
      }
      
      console.log(`Making GitHub API request to: ${url.toString()}`);
      
      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Squid-App'
        }
      });
      
      const data = await response.json();
      
      return new Response(
        JSON.stringify(data),
        { status: response.status, headers: { ...getCorsHeaders(), 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      console.error('Error in GitHub API function:', error);
      
      return jsonResponse({ error: error.message }, 500);
    }
  });
});
