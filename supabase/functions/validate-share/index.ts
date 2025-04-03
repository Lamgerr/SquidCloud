
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
    
    if (!fileId || !accessCode) {
      return new Response(
        JSON.stringify({ error: "File ID and access code are required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Create a Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") as string;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if the access code is valid for the file
    const { data: shareData, error: shareError } = await supabase
      .from('shares')
      .select('*')
      .eq('file_id', fileId)
      .eq('access_code', accessCode)
      .single();

    if (shareError || !shareData) {
      return new Response(
        JSON.stringify({ error: "Invalid access code" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    // Check if share has expired
    if (shareData.expires_at && new Date(shareData.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "This share link has expired" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 410 }
      );
    }

    // Get the file data
    const { data: fileData, error: fileError } = await supabase
      .from('files')
      .select('*')
      .eq('id', fileId)
      .single();

    if (fileError || !fileData) {
      return new Response(
        JSON.stringify({ error: "File not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    // Return the file data
    return new Response(
      JSON.stringify({ file: fileData }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error("Error validating share:", error);
    
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
