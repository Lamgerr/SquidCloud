
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    // Get the request body
    const { fileId, accessCode } = await req.json();
    
    if (!fileId) {
      return new Response(
        JSON.stringify({ error: "File ID is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Create a Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") as string;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if the file is publicly shared or if access code is valid
    let isValidAccess = false;
    
    // Check if file is publicly shared
    const { data: fileData, error: fileError } = await supabase
      .from('files')
      .select('*')
      .eq('id', fileId)
      .single();
      
    if (fileError) {
      return new Response(
        JSON.stringify({ error: "File not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }
    
    if (fileData.shared) {
      isValidAccess = true;
    } else if (accessCode) {
      // Check if access code is valid
      const { data: shareData, error: shareError } = await supabase
        .from('shares')
        .select('*')
        .eq('file_id', fileId)
        .eq('access_code', accessCode)
        .single();
        
      if (!shareError && shareData) {
        // Check if share has expired
        if (!shareData.expires_at || new Date(shareData.expires_at) >= new Date()) {
          isValidAccess = true;
        }
      }
    }
    
    if (!isValidAccess) {
      return new Response(
        JSON.stringify({ error: "Not authorized to access this file" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }
    
    // Get the file content from GitHub storage or database
    const response = await supabase.functions.invoke('github-storage', {
      body: { 
        action: 'download', 
        fileId,
        forSharing: true
      }
    });
    
    if (response.error || !response.data) {
      throw new Error(response.error || "Failed to download file");
    }
    
    // Return the file content
    return new Response(
      JSON.stringify({ content: response.data.content, contentType: fileData.type }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error("Error downloading shared file:", error);
    
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
