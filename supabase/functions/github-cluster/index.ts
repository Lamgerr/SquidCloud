import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withPrelGateway } from "../_shared/kza-prel.ts";

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

function corsResponse(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

function jsonResponse(payload: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

// Generates a cryptographically secure, random folder string
function generateSecureFolder(): string {
  return crypto.randomUUID().split('-').join('');
}

serve(async (req: Request) => {
  return withPrelGateway(req, { functionId: 'github-cluster', operation: 'default' }, async () => {
  if (req.method === 'OPTIONS') return corsResponse();

  try {
    const requestData = await req.json();
    const { action, count } = requestData;

    // ==========================================
    // 1. CLUSTER HEALTH (Mocked for backward compatibility)
    // ==========================================
    if (action === 'get-cluster-info') {
      return jsonResponse({
        success: true,
        nodes: [{ id: 1, username: 'b2-storage-cluster' }],
        totalNodes: 1,
        totalRepos: 9999 // Arbitrary high number so res54 client proceeds happily
      });
    }

    // ==========================================
    // 2. SELECT MULTIPLE RANDOM FOLDERS (Virtual Paths)
    // ==========================================
    if (action === 'select-nodes') {
      const nodeCount = count || 4; // Default to 4 random folders if not specified
      const nodes = [];

      for (let i = 0; i < nodeCount; i++) {
        // We generate a completely random virtual folder name for B2
        // Example: "f83a2b4e9d..."
        const secureRandomFolder = generateSecureFolder();
        
        nodes.push({
          nodeId: 1,
          accountId: 1,
          repoName: 'b2', // Tells your res54 client that this belongs to Backblaze
          username: secureRandomFolder // We repurpose 'username' to pass the secure folder path
        });
      }
      
      return jsonResponse({ success: true, nodes });
    }

    // ==========================================
    // 3. SELECT SINGLE RANDOM FOLDER
    // ==========================================
    if (action === 'select-node') {
      return jsonResponse({ 
        success: true, 
        nodeId: 1,
        accountId: 1,
        repoName: 'b2',
        username: generateSecureFolder(),
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
  });
});
