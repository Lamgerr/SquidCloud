
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { withPrelGateway, jsonResponse, getCorsHeaders, PrelContext } from '../_shared/kza-prel.ts';

const ALLOWED_MODELS = new Set([
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
]);

const MAX_PROMPT_LENGTH = 16000;

serve(async (req) => {
  return withPrelGateway(req, { functionId: 'gemini-api', operation: 'default' }, async (ctx: PrelContext) => {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!GEMINI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse({ error: 'Required edge configuration missing' }, 500);
    }

    try {
      const { prompt, model = "gemini-1.5-flash", options = {} } = await req.json();
      
      if (!prompt || typeof prompt !== 'string') {
        return jsonResponse({ error: 'Prompt is required' }, 400);
      }

      if (prompt.length > MAX_PROMPT_LENGTH) {
        return jsonResponse({ error: `Prompt exceeds maximum length (${MAX_PROMPT_LENGTH})` }, 413);
      }

      const selectedModel = String(model).trim();
      if (!ALLOWED_MODELS.has(selectedModel)) {
        return jsonResponse({ error: 'Model is not allowed by policy' }, 400);
      }

      const safeOptions = {
        temperature: typeof options.temperature === 'number' ? Math.max(0, Math.min(2, options.temperature)) : 0.7,
        topP: typeof options.topP === 'number' ? Math.max(0, Math.min(1, options.topP)) : 0.95,
        topK: typeof options.topK === 'number' ? Math.max(1, Math.min(100, options.topK)) : 40,
        maxOutputTokens: typeof options.maxOutputTokens === 'number' ? Math.max(1, Math.min(4096, options.maxOutputTokens)) : 2048,
        stopSequences: Array.isArray(options.stopSequences)
          ? options.stopSequences.filter((v: unknown) => typeof v === 'string').slice(0, 8)
          : []
      };
      
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${GEMINI_API_KEY}`;
      
      const requestBody = {
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: safeOptions.temperature,
          topP: safeOptions.topP,
          topK: safeOptions.topK,
          maxOutputTokens: safeOptions.maxOutputTokens,
          stopSequences: safeOptions.stopSequences
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          }
        ]
      };
      
      const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      const data = await response.json();
      
      if (data.error) {
        console.error('Gemini API error:', data.error);
        return jsonResponse({ error: data.error }, 500);
      }
      
      return new Response(
        JSON.stringify(data),
        { status: response.status, headers: { ...getCorsHeaders(), 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      console.error('Error in Gemini API function:', error);
      
      return jsonResponse({ error: error.message }, 500);
    }
  });
});
