
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Define proper CORS headers to allow requests from any origin
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

// Create a response with error information and CORS headers
const createErrorResponse = (message: string, status = 500, details?: any) => {
  console.error(`Error: ${message}`, details);
  return new Response(
    JSON.stringify({ 
      error: message,
      details: details ? JSON.stringify(details) : undefined
    }),
    { 
      status: status, 
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json' 
      } 
    }
  );
};

// Main serve function
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    });
  }

  try {
    const GITHUB_TOKEN = Deno.env.get('GITHUB_TOKEN');
    const GITHUB_USERNAME = Deno.env.get('GITHUB_USERNAME');
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!GITHUB_TOKEN || !GITHUB_USERNAME) {
      return createErrorResponse('GitHub configuration not complete. GITHUB_TOKEN and GITHUB_USERNAME are required.', 500);
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return createErrorResponse('Supabase configuration not complete.', 500);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let requestData;
    try {
      requestData = await req.json();
    } catch (error) {
      return createErrorResponse('Invalid JSON in request body', 400, error);
    }

    const { action, ...body } = requestData;

    if (!action) {
      return createErrorResponse('Action is required', 400);
    }

    // Add create-repos action handler
    if (action === 'create-repos') {
      const { count, userId } = body;
      
      if (!userId) {
        return createErrorResponse('User ID is required', 400);
      }

      try {
        // First check for existing repos
        const { data: existingRepos, error: repoError } = await supabase
          .from('repositories')
          .select('*')
          .eq('user_id', userId);

        if (repoError) {
          throw repoError;
        }
        
        // If user already has repos, return them
        if (existingRepos && existingRepos.length > 0) {
          console.log(`Found ${existingRepos.length} existing repos for user ${userId}`);
          return new Response(
            JSON.stringify({ 
              repos: existingRepos.map(repo => ({
                name: repo.repo_name,
                html_url: `https://github.com/${GITHUB_USERNAME}/${repo.repo_name}`
              }))
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Continue with creating new repos only if none exist
        const validCount = Math.min(Math.max(1, count || 2), 2); // Limit to 2 repos max
        const createdRepos = [];

        // Generate random repo names if Gemini is not available
        let repoNames = [];
        for (let i = 0; i < validCount; i++) {
          repoNames.push(`cloudbliss_${Math.random().toString(36).substring(2, 7)}`);
        }

        // Try to get creative names from Gemini if available
        if (GEMINI_API_KEY) {
          try {
            const genNames = await generateCreativeRepoNames(validCount, GEMINI_API_KEY);
            if (genNames && genNames.length === validCount) {
              repoNames = genNames;
            }
          } catch (e) {
            console.warn("Could not get creative names, using fallback names", e);
          }
        }

        for (let i = 0; i < validCount; i++) {
          const baseName = repoNames[i];
          const uniqueSuffix = `${Date.now().toString(36)}_${i}`;
          const repoName = `${baseName}_${uniqueSuffix}`;

          // Create repository with retry logic
          const createRepoWithRetry = async (retries = 3): Promise<any> => {
            try {
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
                    description: "Secure data vault",
                    private: true,
                    auto_init: true
                  })
                }
              );

              if (!createResponse.ok) {
                const errorText = await createResponse.text();
                console.error(`GitHub API error (${createResponse.status}): ${errorText}`);
                
                if (retries > 0 && [429, 500, 502, 503, 504].includes(createResponse.status)) {
                  // Wait and retry for rate limits or server errors
                  const delay = (4 - retries) * 1000; // Increasing backoff
                  console.log(`Retrying repo creation for ${repoName} after ${delay}ms, ${retries} retries left`);
                  await new Promise(resolve => setTimeout(resolve, delay));
                  return createRepoWithRetry(retries - 1);
                }
                
                throw new Error(`Failed to create repo: ${createResponse.status} - ${errorText}`);
              }

              return await createResponse.json();
            } catch (error) {
              if (retries > 0) {
                const delay = (4 - retries) * 1000;
                console.log(`Error creating repo, retrying after ${delay}ms: ${error.message}`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return createRepoWithRetry(retries - 1);
              }
              throw error;
            }
          };

          try {
            const repoData = await createRepoWithRetry();
            
            // Store repo in database
            const { error: insertError } = await supabase
              .from('repositories')
              .insert({
                user_id: userId,
                repo_name: repoName,
                status: { created: new Date().toISOString() }
              });

            if (insertError) {
              console.error(`Error storing repo in database: ${insertError.message}`);
            }

            createdRepos.push({
              name: repoName,
              html_url: repoData.html_url
            });

            // Update user's repo_count
            const { error: updateError } = await supabase
              .from('profiles')
              .update({ repo_count: createdRepos.length })
              .eq('id', userId);

            if (updateError) {
              console.error(`Error updating repo count: ${updateError.message}`);
            }

          } catch (createError) {
            console.error(`Failed to create repo ${repoName}:`, createError);
            // Continue with next repo despite error
          }
        }

        if (createdRepos.length === 0) {
          return createErrorResponse('Failed to create any repositories', 500);
        }

        return new Response(
          JSON.stringify({ repos: createdRepos }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (error) {
        console.error('Error in create-repos:', error);
        return createErrorResponse('Failed to create repositories', 500, error);
      }
    }

    // Validate required parameters for file operations
    const { fileName, fileType, data, userId, path, createRepo, repo } = body;
    
    // Use the specified repo if provided, otherwise try to find a repo for this user
    let storageRepo = repo;
    
    if (!storageRepo) {
      // If no repo specified, get a list of repos for this user
      if (!userId) {
        return createErrorResponse('Either repo or userId is required', 400);
      }
      
      try {
        const { data: repos, error: repoError } = await supabase
          .from('repositories')
          .select('repo_name')
          .eq('user_id', userId);
        
        if (repoError) {
          throw repoError;
        }
        
        if (repos && repos.length > 0) {
          // Pick a random repo from the list for load balancing
          const randomIndex = Math.floor(Math.random() * repos.length);
          storageRepo = repos[randomIndex].repo_name;
        }
      } catch (dbError) {
        console.error("Error fetching repositories:", dbError);
        return createErrorResponse('Failed to fetch repositories', 500, dbError);
      }
    }
    
    // If we still don't have a repo and createRepo flag is true, we'll create a user-specific repository
    if (!storageRepo && createRepo) {
      // Generate a repository name for this user if not provided
      const userStorageRepo = `cloudbliss_${userId.slice(0, 8)}_${Date.now().toString(36)}`;
      
      // Create a new private repository for this user
      try {
        // Check if the repository already exists
        const repoExists = await checkRepoExists(userStorageRepo, GITHUB_USERNAME, GITHUB_TOKEN);
        
        if (!repoExists) {
          await createRepository(userStorageRepo, GITHUB_USERNAME, GITHUB_TOKEN);
          console.log(`Created new repository: ${userStorageRepo} for user ${userId}`);
          
          // Store in database
          const { error: insertError } = await supabase
            .from('repositories')
            .insert({
              user_id: userId,
              repo_name: userStorageRepo
            });
          
          if (insertError) {
            console.error(`Failed to store repo record: ${insertError.message}`);
          }
        }
        
        storageRepo = userStorageRepo;
      } catch (createError) {
        console.error("Error creating repository:", createError);
        return createErrorResponse('Failed to create repository', 500, createError);
      }
    }
    
    if (!storageRepo) {
      return createErrorResponse('No storage repository available', 400);
    }
    
    console.log(`Using repository: ${storageRepo} for action: ${action}`);
    
    // Before performing any operation, verify the repository exists
    try {
      const repoExists = await checkRepoExists(storageRepo, GITHUB_USERNAME, GITHUB_TOKEN);
      
      if (!repoExists) {
        if (createRepo) {
          console.log(`Repository ${storageRepo} does not exist, creating it now.`);
          await createRepository(storageRepo, GITHUB_USERNAME, GITHUB_TOKEN);
          console.log(`Successfully created repository: ${storageRepo}`);
        } else {
          return createErrorResponse(`Repository ${storageRepo} does not exist`, 404);
        }
      }
    } catch (repoCheckError) {
      console.error("Error checking repository:", repoCheckError);
      return createErrorResponse('Failed to verify repository', 500, repoCheckError);
    }
    
    // Handle different file operations
    switch (action) {
      case 'upload': {
        if (!fileName || !data || !userId) {
          return createErrorResponse('fileName, data, and userId are required for upload', 400);
        }
        
        // Create a file path for this user
        const filePath = path || `${userId}/${fileName}`;
        
        // Ensure user directory exists - create the directory if needed
        try {
          const dirExists = await checkPathExists(userId, storageRepo, GITHUB_USERNAME, GITHUB_TOKEN);
          if (!dirExists) {
            await createDirectory(userId, storageRepo, GITHUB_USERNAME, GITHUB_TOKEN);
            console.log(`Created directory for user ${userId} in repository ${storageRepo}`);
          }
        } catch (dirError) {
          try {
            console.log(`Creating directory for user ${userId} in repository ${storageRepo}`);
            await createDirectory(userId, storageRepo, GITHUB_USERNAME, GITHUB_TOKEN);
          } catch (createDirError) {
            console.error("Error creating directory:", createDirError);
            return createErrorResponse('Failed to create directory', 500, createDirError);
          }
        }
        
        try {
          // Convert data to base64 if it's not already (for JSON chunks, it's already a string)
          let base64Content = data;
          if (fileType && fileType.startsWith('application/json')) {
            // For JSON data, we need to encode it to base64
            try {
              base64Content = btoa(unescape(encodeURIComponent(data)));
            } catch (encodeError) {
              console.error("Error encoding JSON content:", encodeError);
              base64Content = btoa(data); // Fallback
            }
          }
          
          // Upload file to GitHub with retries
          const uploadWithRetries = async (retries = 3) => {
            try {
              return await uploadToGitHub(filePath, base64Content, fileType, storageRepo, GITHUB_USERNAME, GITHUB_TOKEN);
            } catch (uploadError) {
              if (retries > 0 && uploadError.message && uploadError.message.includes('API')) {
                const delay = (4 - retries) * 1000;
                console.log(`Upload error, retrying after ${delay}ms: ${uploadError.message}`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return uploadWithRetries(retries - 1);
              }
              throw uploadError;
            }
          };
          
          const uploadResponse = await uploadWithRetries();
          
          return new Response(
            JSON.stringify({ 
              success: true, 
              path: filePath, 
              repo: storageRepo,
              ...uploadResponse 
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (uploadError) {
          console.error("Error uploading file:", uploadError);
          return createErrorResponse('Failed to upload file', 500, uploadError);
        }
      }
      
      case 'download': {
        try {
          if (!path || !repo) {
            return createErrorResponse('path and repo are required for download', 400);
          }
      
          // Get file from GitHub with retries
          const downloadWithRetries = async (retries = 3) => {
            try {
              const response = await fetch(
                `https://api.github.com/repos/${GITHUB_USERNAME}/${repo}/contents/${path}`,
                {
                  headers: {
                    'Authorization': `Bearer ${GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'CloudBliss-Storage-App'
                  }
                }
              );
          
              if (!response.ok) {
                if (retries > 0 && [429, 500, 502, 503, 504].includes(response.status)) {
                  const delay = (4 - retries) * 1000;
                  console.log(`Download error (${response.status}), retrying after ${delay}ms`);
                  await new Promise(resolve => setTimeout(resolve, delay));
                  return downloadWithRetries(retries - 1);
                }
                throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
              }
          
              return await response.json();
            } catch (error) {
              if (retries > 0 && error.message && !error.message.includes('404')) {
                const delay = (4 - retries) * 1000;
                console.log(`Download error, retrying after ${delay}ms: ${error.message}`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return downloadWithRetries(retries - 1);
              }
              throw error;
            }
          };
          
          const data = await downloadWithRetries();
      
          // Validate content exists
          if (!data.content) {
            return createErrorResponse('No content found in GitHub response', 404);
          }
      
          return new Response(
            JSON.stringify({ 
              success: true, 
              content: data.content,
              size: data.size,
              sha: data.sha 
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (error) {
          console.error('Download error:', error);
          return createErrorResponse('Failed to download file', 500, error);
        }
      }
      
      case 'delete': {
        if (!path || !repo) {
          return createErrorResponse('path and repo are required for delete', 400);
        }
        
        try {
          // Delete file from GitHub with retries
          const deleteWithRetries = async (retries = 3) => {
            try {
              await deleteFromGitHub(path, repo, GITHUB_USERNAME, GITHUB_TOKEN);
              return true;
            } catch (deleteError) {
              if (retries > 0 && deleteError.message && deleteError.message.includes('API')) {
                const delay = (4 - retries) * 1000;
                console.log(`Delete error, retrying after ${delay}ms: ${deleteError.message}`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return deleteWithRetries(retries - 1);
              }
              throw deleteError;
            }
          };
          
          await deleteWithRetries();
          
          return new Response(
            JSON.stringify({ success: true }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (deleteError) {
          console.error("Error deleting file:", deleteError);
          return createErrorResponse('Failed to delete file', 500, deleteError);
        }
      }
      
      case 'list': {
        if (!userId) {
          return createErrorResponse('userId is required for listing files', 400);
        }
        
        try {
          // List files for this user in the specific repo
          const files = await listUserFiles(userId, storageRepo, GITHUB_USERNAME, GITHUB_TOKEN);
          
          return new Response(
            JSON.stringify({ success: true, files }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (listError) {
          console.error("Error listing files:", listError);
          return createErrorResponse('Failed to list files', 500, listError);
        }
      }
      
      case 'create_folder': {
        if (!userId || !body.folderName) {
          return createErrorResponse('userId and folderName are required for creating a folder', 400);
        }
        
        try {
          const folderPath = path ? `${path}/${body.folderName}` : `${userId}/${body.folderName}`;
          
          // Create folder (directory)
          await createDirectory(folderPath, storageRepo, GITHUB_USERNAME, GITHUB_TOKEN);
          
          return new Response(
            JSON.stringify({ 
              success: true, 
              path: folderPath,
              repo: storageRepo 
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (folderError) {
          console.error("Error creating folder:", folderError);
          return createErrorResponse('Failed to create folder', 500, folderError);
        }
      }
      
      default:
        return createErrorResponse(`Unknown action: ${action}`, 400);
    }
  } catch (error) {
    console.error('Error in GitHub storage function:', error);
    return createErrorResponse('Internal server error', 500, error);
  }
});

// Check if repository exists
async function checkRepoExists(repo: string, username: string, token: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${username}/${repo}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'CloudBliss-Storage-App'
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
        'User-Agent': 'CloudBliss-Storage-App',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: repo,
        description: 'CloudBliss secure storage vault',
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
          'User-Agent': 'CloudBliss-Storage-App'
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
          'User-Agent': 'CloudBliss-Storage-App'
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
          'User-Agent': 'CloudBliss-Storage-App',
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
        'User-Agent': 'CloudBliss-Storage-App',
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
        'User-Agent': 'CloudBliss-Storage-App',
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
        'User-Agent': 'CloudBliss-Storage-App',
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

// Helper function to generate creative repository names using Gemini API or fallback to defaults
async function generateCreativeRepoNames(count: number, apiKey: string): Promise<string[]> {
  try {
    // Simple hardcoded creative names as fallback
    const creativeNames = [
      "quantumVault", "cyberNexus", "dataForge", "byteHaven", "secureSphere", 
      "cryptoKeeper", "cloudArmor", "dataMatrix", "safeHarbor", "bitVault"
    ];
    
    // Use a simple trick - select random items from our predefined list
    const shuffled = [...creativeNames].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  } catch (error) {
    console.error('Error generating creative repo names:', error);
    return [];
  }
}
