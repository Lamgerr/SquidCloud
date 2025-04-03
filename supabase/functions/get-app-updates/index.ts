
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
    const { platform, currentVersion } = await req.json();
    
    if (!platform) {
      return new Response(
        JSON.stringify({ error: "Platform is required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Create a Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") as string;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get the latest version for the specified platform
    const { data: latestVersion, error } = await supabase
      .from('app_versions')
      .select('*')
      .eq('platform', platform)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
      
    if (error) {
      // No versions found
      return new Response(
        JSON.stringify({ latestVersion: null, updateRequired: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Check if update is required (if current version is provided)
    let updateRequired = false;
    if (currentVersion) {
      // Compare versions (this is a simple string comparison, you may want to use semver)
      updateRequired = latestVersion.version !== currentVersion;
    }
    
    return new Response(
      JSON.stringify({ latestVersion, updateRequired }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error("Error fetching app updates:", error);
    
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
