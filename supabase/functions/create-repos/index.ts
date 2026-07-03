
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { withPrelGateway, jsonResponse, getCorsHeaders, PrelContext } from '../_shared/kza-prel.ts';

serve(async (req) => {
  return await withPrelGateway(req, { functionId: 'create-repos', operation: 'default' }, async (ctx: PrelContext) => {
    let body: any;
    
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid request body" }, 400);
    }
    
    const { action } = body;
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return jsonResponse({ error: "Server configuration error" }, 500);
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const apiKey = Deno.env.get("GEMINI_API_KEY") || "";
    
    try {
      const { data: repos, error: fetchError } = await supabase
        .from("repositories")
        .select("*")
        .eq("user_id", ctx.userId);
      
      if (fetchError) {
        return jsonResponse({ error: "Failed to fetch repositories" }, 500);
      }
      
      if (action === "create") {
        const count = body.count || 5;
        const repoConfigurations = await generateCreativeRepoNames(count, apiKey);
        
        const createdRepos = [];
        
        for (let i = 0; i < repoConfigurations.length; i++) {
          const repoName = repoConfigurations[i];
          
          const tagString = body.tags && Array.isArray(body.tags) 
            ? body.tags.join(", ") 
            : "";
          
          const { data: newRepo, error: createError } = await supabase
            .from("repositories")
            .insert({
              name: repoName,
              description: `Secure digital nexus for encrypted assets`,
              user_id: ctx.userId,
              tags: tagString,
              storage_type: "github",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .select()
            .single();
          
          if (createError) {
            console.error("Error creating repository:", createError);
            continue;
          } else {
            createdRepos.push(newRepo);
          }
        }
        
        return jsonResponse({
          success: true,
          repositories: createdRepos
        });
      }
      
      return jsonResponse({
        success: true,
        repositories: repos
      });
      
    } catch (error) {
      console.error('Error in create-repos function:', error);
      
      return jsonResponse({ error: error.message || 'An error occurred while creating vaults' }, 500);
    }
  });
});

// Helper function to generate creative repository names using Gemini API
async function generateCreativeRepoNames(count: number, apiKey?: string): Promise<string[]> {
  if (!apiKey) {
    console.log("No Gemini API key provided, using fallback names");
    return generateFallbackNames(count);
  }
  
  try {
    const prompt = `Generate ${count} unique, creative names for private secure data repositories. 
    Each name should be a single word or two words connected by underscore, like "cosmic_nexus" or "phantom_matrix". 
    The names should be unique, memorable, and should NOT contain words like "storage", "repo", "github", "vault", "file", "data", or anything that suggests file storage. 
    Return only the names as a comma-separated list with no additional text.`;
    
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
      
      // Ensure we have the requested number of names and none contain the word "storage"
      names = names.filter(name => !name.includes('storage'));
      
      // Fill in if we don't have enough names
      while (names.length < count) {
        names.push(...generateFallbackNames(count - names.length));
      }
      
      // Return just the number of names requested
      return names.slice(0, count);
    }
    
    throw new Error("Failed to generate names with Gemini API");
  } catch (error) {
    console.error("Error generating names with Gemini:", error);
    // Fallback to basic names
    return generateFallbackNames(count);
  }
}

// Generate fallback repository names without using "storage" word
function generateFallbackNames(count: number): string[] {
  const adjectives = ["mystic", "arcane", "enigmatic", "cryptic", "phantom", "celestial", "quantum", "cosmic", "ethereal", "astral"];
  const nouns = ["nexus", "cipher", "sanctum", "citadel", "sentinel", "bastion", "matrix", "aegis", "paradox", "vortex"];
  
  return Array(count).fill("").map(() => {
    const randomAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
    return `${randomAdj}_${randomNoun}`;
  });
}

// Generate creative descriptions for repositories
async function generateCreativeDescriptions(count: number, apiKey?: string): Promise<string[]> {
  if (!apiKey) {
    return ["Secure digital nexus for encrypted assets"];
  }
  
  try {
    const prompt = `Generate ${count} unique, creative descriptions for private secure data repositories.
    Each description should be a short phrase (under 50 characters) that sounds secure and professional,
    but does NOT directly mention storage, files, data, or anything that obviously suggests file storage.
    Return only the descriptions as a comma-separated list with no additional text.`;
    
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 100
        }
      })
    });
    
    const data = await response.json();
    
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      const text = data.candidates[0].content.parts[0].text;
      let descriptions = text.split(',')
        .map(desc => desc.trim())
        .filter(desc => desc.length > 0 && desc.length < 50);
      
      while (descriptions.length < count) {
        descriptions.push("Secure digital nexus for encrypted assets");
      }
      
      return descriptions.slice(0, count);
    }
    
    return ["Secure digital nexus for encrypted assets"];
  } catch (error) {
    console.error("Error generating descriptions with Gemini:", error);
    return ["Secure digital nexus for encrypted assets"];
  }
}
