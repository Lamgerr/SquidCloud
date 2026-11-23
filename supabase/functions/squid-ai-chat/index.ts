import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { withPrelGateway, jsonResponse, getCorsHeaders, PrelContext } from '../_shared/kza-prel.ts'

/* Squid AI — ported from dex's model loop: persona + native tool_calls.
   The model can request tools; the function returns the request to the client,
   which executes them via the SquidCloud tool bench and replies with results. */

const SYSTEM = `You are Squid, the user's personal AI inside SquidCloud — a real collaborator, not a generic chatbot.
Identity: you are Squid (not Gemini/Claude/GPT). Protect the user's files and privacy.
Voice: straight, concise, confident, warm when it fits. Have a point of view; if an approach is weak, say what's better. No emoji, ever. No "Great question" or filler. Lead with the outcome.
Operating mode: for anything needing a check, change, creation or verification, CALL A TOOL immediately — never guess counts or invent results. Prefer dedicated tools. After a tool call, summarise its result in one or two plain sentences; never dump raw JSON. If a tool fails, try one sensible alternative, then report the blocker with evidence.
Output: plain text, short, one idea per paragraph. Markdown only for short lists or real code.`;

serve(async (req) => {
  return withPrelGateway(req, { functionId: 'squid-ai-chat', operation: 'default' }, async (ctx: PrelContext) => {
    if (req.method === 'OPTIONS') return new Response(null, { headers: getCorsHeaders() })

    try {
      const { messages, context, tools } = await req.json()
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
      if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured')

      let system = SYSTEM
      if (context) {
        system += `\n\nCurrent context:\n- File: ${context.fileName || 'N/A'}\n- Type: ${context.fileType || 'N/A'}\n- Path: ${context.filePath || 'N/A'}`
        if (context.fileContent) system += `\n- Content preview: ${String(context.fileContent).slice(0, 500)}`
      }

      const body: Record<string, unknown> = {
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'system', content: system }, ...(messages || [])],
        temperature: 0.6,
        max_tokens: 2048,
      }
      // Real JSON-schema tools when the client supplies them (dex-style bench)
      if (Array.isArray(tools) && tools.length) {
        body.tools = tools
        body.tool_choice = 'auto'
      }

      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const t = await response.text()
        if (response.status === 429) return jsonResponse({ error: 'Rate limit reached. Try again shortly.' }, 429)
        if (response.status === 402) return jsonResponse({ error: 'AI credits exhausted.' }, 402)
        throw new Error(`Lovable AI error ${response.status}: ${t.slice(0, 200)}`)
      }

      const data = await response.json()
      const msg = data.choices?.[0]?.message || {}
      return jsonResponse({
        message: msg.content || '',
        tool_calls: msg.tool_calls || null,
        finish_reason: data.choices?.[0]?.finish_reason || null,
      })
    } catch (error) {
      return jsonResponse({ error: error instanceof Error ? error.message : 'Unknown error' }, 500)
    }
  })
})
