
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
  
  if (!GITHUB_TOKEN || !GITHUB_USERNAME) {
    return new Response(
      JSON.stringify({ error: 'GitHub configuration not complete. GITHUB_TOKEN and GITHUB_USERNAME are required.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { action, fileName, fileType, data, userId, path, createRepo, repo } = await req.json();
    
    if (!action) {
      return new Response(
        JSON.stringify({ error: 'Action is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Use the specified repo if provided, otherwise try to find a repo for this user
    let storageRepo = repo;
    
    if (!storageRepo) {
      // If no repo specified, get a list of repos for this user
      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'Either repo or userId is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      try {
        const dbResponse = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/rest/v1/repositories?user_id=eq.${userId}&select=repo_name`,
          {
            headers: {
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              'Content-Type': 'application/json'
            }
          }
        );
        
        if (dbResponse.ok) {
          const repos = await dbResponse.json();
          if (repos && repos.length > 0) {
            // Pick a random repo from the list
            const randomIndex = Math.floor(Math.random() * repos.length);
            storageRepo = repos[randomIndex].repo_name;
          }
        }
      } catch (dbError) {
        console.error("Error fetching repositories:", dbError);
      }
    }
    
    // If we still don't have a repo and createRepo flag is true, we'll create a user-specific repository
    if (!storageRepo && createRepo) {
      // Generate a repository name for this user if not provided
      const userStorageRepo = `nexus_${userId.slice(0, 8)}_${Date.now().toString(36)}`;
      
      // Check if the repository already exists
      const repoExists = await checkRepoExists(userStorageRepo, GITHUB_USERNAME, GITHUB_TOKEN);
      
      if (!repoExists) {
        // Create a new private repository for this user
        await createRepository(userStorageRepo, GITHUB_USERNAME, GITHUB_TOKEN);
        console.log(`Created new repository: ${userStorageRepo} for user ${userId}`);
        
        // Store in database
        try {
          const dbResponse = await fetch(
            `${Deno.env.get('SUPABASE_URL')}/rest/v1/repositories`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
              },
              body: JSON.stringify({
                user_id: userId,
                repo_name: userStorageRepo
              })
            }
          );
          
          if (!dbResponse.ok) {
            console.error(`Failed to store repo record for ${userStorageRepo}:`, await dbResponse.text());
          }
        } catch (dbError) {
          console.error(`Database error for ${userStorageRepo}:`, dbError);
        }
      }
      
      storageRepo = userStorageRepo;
    }
    
    if (!storageRepo) {
      return new Response(
        JSON.stringify({ error: 'No storage repository specified. Either provide a repo parameter, or use createRepo flag, or ensure the user has repositories in the database.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Using repository: ${storageRepo} for action: ${action}`);
    
    // Verify the repository exists before attempting operations
    const repoExists = await checkRepoExists(storageRepo, GITHUB_USERNAME, GITHUB_TOKEN);
    if (!repoExists) {
      console.error(`Repository ${storageRepo} does not exist for ${GITHUB_USERNAME}`);
      return new Response(
        JSON.stringify({ error: `Repository ${storageRepo} does not exist` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        
        // Ensure user directory exists
        try {
          const dirExists = await checkPathExists(userId, storageRepo, GITHUB_USERNAME, GITHUB_TOKEN);
          if (!dirExists) {
            // Create directory by adding a README file
            await createDirectory(userId, storageRepo, GITHUB_USERNAME, GITHUB_TOKEN);
          }
        } catch (dirError) {
          console.log("Creating directory since it might not exist:", dirError);
          await createDirectory(userId, storageRepo, GITHUB_USERNAME, GITHUB_TOKEN);
        }
        
        // Convert data to base64 if it's not already (for JSON chunks, it's already a string)
        let base64Content = data;
        if (fileType && fileType.startsWith('application/json')) {
          // For JSON data, we need to encode it to base64
          base64Content = btoa(data);
        }
        
        // Upload file to GitHub
        const uploadResponse = await uploadToGitHub(filePath, base64Content, fileType, storageRepo, GITHUB_USERNAME, GITHUB_TOKEN);
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            path: filePath, 
            repo: storageRepo,
            ...uploadResponse 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      case 'download': {
        if (!path || !repo) {
          return new Response(
            JSON.stringify({ error: 'path and repo are required for download' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Download file from GitHub
        const content = await downloadFromGitHub(path, repo, GITHUB_USERNAME, GITHUB_TOKEN);
        
        return new Response(
          JSON.stringify({ success: true, content }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      case 'delete': {
        if (!path || !repo) {
          return new Response(
            JSON.stringify({ error: 'path and repo are required for delete' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Delete file from GitHub
        await deleteFromGitHub(path, repo, GITHUB_USERNAME, GITHUB_TOKEN);
        
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      case 'list': {
        if (!userId) {
          return new Response(
            JSON.stringify({ error: 'userId is required for listing files' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // List files for this user in the specific repo
        const files = await listUserFiles(userId, storageRepo, GITHUB_USERNAME, GITHUB_TOKEN);
        
        return new Response(
          JSON.stringify({ success: true, files }),
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
  
  // Check if repository exists
  async function checkRepoExists(repo: string, username: string, token: string): Promise<boolean> {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${username}/${repo}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'InflateStorage-App'
          }
        }
      );
      
      return response.status === 200;
    } catch (error) {
      console.error('Error checking repository:', error);
      return false;
    }
  }
  
  // Create a new private GitHub repository
  async function createRepository(repo: string, username: string, token: string): Promise<void> {
    const response = await fetch(
      'https://api.github.com/user/repos',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'InflateStorage-App',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: repo,
          description: 'InflateStorage secure nexus',
          private: true,
          auto_init: true
        })
      }
    );
    
    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Failed to create repository: ${response.status} ${response.statusText} - ${errorData}`);
    }
  }
  
  // Check if a path exists in the repository
  async function checkPathExists(path: string, repo: string, username: string, token: string): Promise<boolean> {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${username}/${repo}/contents/${path}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'InflateStorage-App'
          }
        }
      );
      
      return response.status === 200;
    } catch (error) {
      console.error('Error checking path:', error);
      return false;
    }
  }
  
  // Create a directory by adding a README.md file
  async function createDirectory(dirPath: string, repo: string, username: string, token: string): Promise<void> {
    const readmePath = `${dirPath}/README.md`;
    const readmeContent = 'This directory contains encrypted storage chunks.';
    
    await uploadToGitHub(
      readmePath,
      btoa(readmeContent),
      'text/markdown',
      repo,
      username,
      token
    );
  }
  
  // List files for a specific user
  async function listUserFiles(userId: string, repo: string, username: string, token: string): Promise<any[]> {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${username}/${repo}/contents/${userId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'InflateStorage-App'
          }
        }
      );
      
      if (response.status === 404) {
        // Directory doesn't exist yet, which is fine
        return [];
      }
      
      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error listing files:', error);
      // Return empty array to avoid breaking the client
      return [];
    }
  }
  
  // Helper function to upload a file to GitHub
  async function uploadToGitHub(
    path: string, 
    content: string, 
    contentType: string, 
    repo: string,
    username: string,
    token: string
  ): Promise<any> {
    console.log(`Uploading to GitHub: ${path} in repo ${repo}`);
    
    // First, check if the file already exists to get the SHA if it does
    let existingSha;
    try {
      const fileResponse = await fetch(
        `https://api.github.com/repos/${username}/${repo}/contents/${path}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
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
      `https://api.github.com/repos/${username}/${repo}/contents/${path}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'InflateStorage-App',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: `Upload file ${path}`,
          content: content, // Base64 encoded content
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
    return { 
      url: data.content.download_url, 
      sha: data.content.sha,
      html_url: data.content.html_url 
    };
  }
  
  // Helper function to download a file from GitHub
  async function downloadFromGitHub(
    path: string,
    repo: string,
    username: string,
    token: string
  ): Promise<string> {
    console.log(`Downloading from GitHub: ${path} from repo ${repo}`);
    
    const response = await fetch(
      `https://api.github.com/repos/${username}/${repo}/contents/${path}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
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
  async function deleteFromGitHub(
    path: string,
    repo: string,
    username: string,
    token: string
  ): Promise<void> {
    console.log(`Deleting from GitHub: ${path} from repo ${repo}`);
    
    // First, get the current SHA
    const fileResponse = await fetch(
      `https://api.github.com/repos/${username}/${repo}/contents/${path}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
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
      `https://api.github.com/repos/${username}/${repo}/contents/${path}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
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
