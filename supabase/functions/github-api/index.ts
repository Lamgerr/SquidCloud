
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const GITHUB_TOKEN = Deno.env.get('GITHUB_TOKEN');
  
  if (!GITHUB_TOKEN) {
    return new Response(
      JSON.stringify({ error: 'GitHub token not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { endpoint, params } = await req.json();
    
    if (!endpoint) {
      return new Response(
        JSON.stringify({ error: 'GitHub API endpoint is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Construct the URL for the GitHub API request
    const url = new URL(`https://api.github.com/${endpoint}`);
    
    // Add query parameters if they exist
    if (params) {
      Object.keys(params).forEach(key => {
        url.searchParams.append(key, params[key]);
      });
    }
    
    console.log(`Making GitHub API request to: ${url.toString()}`);
    
    // Make the request to GitHub API
    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'InflateStorage-App'
      }
    });
    
    // Parse the response
    const data = await response.json();
    
    // Return the GitHub API response
    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in GitHub API function:', error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
