
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

  try {
    const { count, userId } = await req.json();
    
    const GITHUB_TOKEN = Deno.env.get('GITHUB_TOKEN');
    const GITHUB_USERNAME = Deno.env.get('GITHUB_USERNAME');
    
    if (!GITHUB_TOKEN || !GITHUB_USERNAME) {
      return new Response(
        JSON.stringify({ error: 'GitHub configuration not complete' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Validate and normalize count
    const repoCount = count ? parseInt(String(count), 10) : 5;
    const validCount = isNaN(repoCount) ? 5 : Math.min(Math.max(1, repoCount), 5);
    
    const createdRepos = [];
    
    // Create each repository
    for (let i = 0; i < validCount; i++) {
      const repoName = `storage-${userId.substring(0, 8)}-${Date.now()}-${i}`;
      
      // Check if repository already exists
      const existsResponse = await fetch(
        `https://api.github.com/repos/${GITHUB_USERNAME}/${repoName}`,
        {
          headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'InflateStorage-Edge-Function'
          }
        }
      );
      
      // If repo doesn't exist, create it
      if (existsResponse.status === 404) {
        const createResponse = await fetch(
          'https://api.github.com/user/repos',
          {
            method: 'POST',
            headers: {
              'Authorization': `token ${GITHUB_TOKEN}`,
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'InflateStorage-Edge-Function',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              name: repoName,
              description: 'Universal storage repository',
              private: true,
              auto_init: true
            })
          }
        );
        
        if (!createResponse.ok) {
          console.error(`Failed to create repo ${repoName}:`, await createResponse.text());
          continue;
        }
        
        const repoData = await createResponse.json();
        createdRepos.push({
          name: repoName,
          html_url: repoData.html_url
        });
        
        console.log(`Created repository: ${repoName}`);
      } else if (existsResponse.ok) {
        // Repo already exists
        const repoData = await existsResponse.json();
        createdRepos.push({
          name: repoName,
          html_url: repoData.html_url
        });
        
        console.log(`Repository already exists: ${repoName}`);
      }
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Created ${createdRepos.length} repositories`,
        repositories: createdRepos
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error in create-repos function:', error);
    
    return new Response(
      JSON.stringify({ error: error.message || 'An error occurred while creating repositories' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
