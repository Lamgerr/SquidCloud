
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
  const GITHUB_USERNAME = Deno.env.get('GITHUB_USERNAME');
  const STORAGE_REPO = Deno.env.get('GITHUB_STORAGE_REPO');
  
  if (!GITHUB_TOKEN || !GITHUB_USERNAME || !STORAGE_REPO) {
    return new Response(
      JSON.stringify({ error: 'GitHub configuration not complete. GITHUB_TOKEN, GITHUB_USERNAME, and GITHUB_STORAGE_REPO are required.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { action, fileName, fileType, data, userId, path } = await req.json();
    
    if (!action) {
      return new Response(
        JSON.stringify({ error: 'Action is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Handle different file operations
    switch (action) {
      case 'upload': {
        if (!fileName || !data || !userId) {
          return new Response(
            JSON.stringify({ error: 'fileName, data, and userId are required for upload' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Create a file path for this user
        const filePath = `${userId}/${fileName}`;
        
        // Upload file to GitHub
        const uploadResponse = await uploadToGitHub(filePath, data, fileType);
        
        return new Response(
          JSON.stringify({ success: true, path: filePath, ...uploadResponse }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      case 'download': {
        if (!path) {
          return new Response(
            JSON.stringify({ error: 'path is required for download' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Download file from GitHub
        const content = await downloadFromGitHub(path);
        
        return new Response(
          JSON.stringify({ success: true, content }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      case 'delete': {
        if (!path) {
          return new Response(
            JSON.stringify({ error: 'path is required for delete' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Delete file from GitHub
        await deleteFromGitHub(path);
        
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Error in GitHub storage function:', error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  // Helper function to upload a file to GitHub
  async function uploadToGitHub(path: string, content: string, contentType: string): Promise<any> {
    console.log(`Uploading to GitHub: ${path}`);
    
    // First, check if the file already exists to get the SHA if it does
    let existingSha;
    try {
      const fileResponse = await fetch(
        `https://api.github.com/repos/${GITHUB_USERNAME}/${STORAGE_REPO}/contents/${path}`,
        {
          headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'InflateStorage-App',
          },
        }
      );
      
      if (fileResponse.status === 200) {
        const fileData = await fileResponse.json();
        existingSha = fileData.sha;
      }
    } catch (error) {
      console.log('File does not exist yet, will create new file');
      // File doesn't exist, which is fine for creation
    }
    
    // Now upload/update the file
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_USERNAME}/${STORAGE_REPO}/contents/${path}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'InflateStorage-App',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: `Upload file ${path}`,
          content: content, // Already base64 encoded from encryption
          sha: existingSha, // Include SHA if file exists
        }),
      }
    );
    
    if (!response.ok) {
      const errorData = await response.text();
      console.error('GitHub API error:', errorData);
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return { url: data.content.download_url, sha: data.content.sha };
  }
  
  // Helper function to download a file from GitHub
  async function downloadFromGitHub(path: string): Promise<string> {
    console.log(`Downloading from GitHub: ${path}`);
    
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_USERNAME}/${STORAGE_REPO}/contents/${path}`,
      {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'InflateStorage-App',
        },
      }
    );
    
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.content; // Base64 encoded content
  }
  
  // Helper function to delete a file from GitHub
  async function deleteFromGitHub(path: string): Promise<void> {
    console.log(`Deleting from GitHub: ${path}`);
    
    // First, get the current SHA
    const fileResponse = await fetch(
      `https://api.github.com/repos/${GITHUB_USERNAME}/${STORAGE_REPO}/contents/${path}`,
      {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'InflateStorage-App',
        },
      }
    );
    
    if (!fileResponse.ok) {
      if (fileResponse.status === 404) {
        console.log(`File ${path} not found, already deleted`);
        return;
      }
      throw new Error(`GitHub API error: ${fileResponse.status} ${fileResponse.statusText}`);
    }
    
    const fileData = await fileResponse.json();
    
    // Now delete the file
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_USERNAME}/${STORAGE_REPO}/contents/${path}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'InflateStorage-App',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: `Delete file ${path}`,
          sha: fileData.sha,
        }),
      }
    );
    
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }
  }
});
