
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// List of admin user IDs
const ADMIN_USER_IDS = [
  "1dee2494-0de5-481c-9d16-7000a9f2e68f"
];

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the request body
    const { version, platform, changelog, download_url, size, is_mandatory } = await req.json();
    
    // Validate required fields
    if (!version || !platform || !changelog || !download_url) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Create a Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") as string;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") as string;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the user from the authorization header
    const authHeader = req.headers.get('authorization')?.split(' ')[1];
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    // Check if user is an admin
    if (!ADMIN_USER_IDS.includes(user.id)) {
      return new Response(
        JSON.stringify({ error: "Not authorized" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    // Create app version in database
    const { data, error } = await supabase
      .from('app_versions')
      .insert({
        version,
        platform,
        changelog,
        download_url,
        size: size || 0,
        is_mandatory: is_mandatory || false,
        released_by: user.id,
      })
      .select('*')
      .single();
      
    if (error) {
      throw new Error(error.message);
    }
    
    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error("Error adding app update:", error);
    
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
