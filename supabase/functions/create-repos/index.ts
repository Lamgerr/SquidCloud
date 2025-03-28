
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
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    
    if (!GITHUB_TOKEN || !GITHUB_USERNAME) {
      return new Response(
        JSON.stringify({ error: 'Configuration not complete' }),
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
    
    // Generate creative names using Gemini API
    const repoNames = await generateRepoNames(validCount, GEMINI_API_KEY);
    
    // Create each repository
    for (let i = 0; i < validCount; i++) {
      // Use the generated name, or fall back to a standard pattern
      const baseName = repoNames[i] || `vault_${Math.random().toString(36).substring(2, 7)}`;
      // Add a unique identifier to ensure uniqueness
      const uniqueSuffix = `${Date.now().toString(36)}_${i}`;
      const repoName = `${baseName}_${uniqueSuffix}`;
      
      // Check if repository already exists
      const existsResponse = await fetch(
        `https://api.github.com/repos/${GITHUB_USERNAME}/${repoName}`,
        {
          headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'CloudVault-Edge-Function'
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
              'User-Agent': 'CloudVault-Edge-Function',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              name: repoName,
              description: 'Secure data vault',
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
        message: `Created ${createdRepos.length} vaults`,
        repositories: createdRepos
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error in create-repos function:', error);
    
    return new Response(
      JSON.stringify({ error: error.message || 'An error occurred while creating vaults' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper function to generate creative repository names using Gemini API
async function generateRepoNames(count: number, apiKey?: string): Promise<string[]> {
  if (!apiKey) {
    console.log("No Gemini API key provided, using fallback names");
    return Array(count).fill("").map(() => {
      const adjectives = ["mystic", "hidden", "secure", "quantum", "cosmic", "digital", "crypto", "private", "shadow", "silent"];
      const nouns = ["vault", "archive", "nexus", "haven", "sanctuary", "domain", "fortress", "chamber", "enclave", "cache"];
      const randomAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
      const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
      return `${randomAdj}_${randomNoun}`;
    });
  }
  
  try {
    const prompt = `Generate ${count} unique, creative names for private vaults or repositories. Each name should be a single word or two words connected by underscore, like "cosmic_vault" or "stardust". The names should be unique, memorable, and should NOT contain words like "storage", "repo", "github", or anything that suggests file storage. Return only the names as a comma-separated list with no additional text.`;
    
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.9,
          maxOutputTokens: 100
        }
      })
    });
    
    const data = await response.json();
    
    // Parse the response to extract the names
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      const text = data.candidates[0].content.parts[0].text;
      // Split by commas and clean up each name
      let names = text.split(',')
        .map(name => name.trim().toLowerCase())
        .filter(name => name.length > 0)
        // Replace spaces with underscores and remove any characters that aren't alphanumeric or underscore
        .map(name => name.replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''));
      
      // Ensure we have the requested number of names
      while (names.length < count) {
        names.push(`vault_${Math.random().toString(36).substring(2, 7)}`);
      }
      
      // Return just the number of names requested
      return names.slice(0, count);
    }
    
    throw new Error("Failed to generate names with Gemini API");
  } catch (error) {
    console.error("Error generating names with Gemini:", error);
    // Fallback to basic names
    return Array(count).fill("").map(() => {
      const adjectives = ["mystic", "hidden", "secure", "quantum", "cosmic", "digital", "crypto", "private", "shadow", "silent"];
      const nouns = ["vault", "archive", "nexus", "haven", "sanctuary", "domain", "fortress", "chamber", "enclave", "cache"];
      const randomAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
      const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
      return `${randomAdj}_${randomNoun}`;
    });
  }
}
