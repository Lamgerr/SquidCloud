import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { withPrelGateway, jsonResponse, getCorsHeaders, PrelContext } from '../_shared/kza-prel.ts'

serve(async (req) => {
  return withPrelGateway(req, { functionId: 'squid-ai-chat', operation: 'default' }, async (ctx: PrelContext) => {
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: getCorsHeaders() })
    }

    try {
      const { messages, context } = await req.json()
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')

      if (!LOVABLE_API_KEY) {
        throw new Error('LOVABLE_API_KEY is not configured')
      }

      // Build system prompt with context
      let systemPrompt = `You are Squid AI, an intelligent, cute assistant for SquidCloud storage system. You help users organize files, create content, and manage their cloud storage.

Available Actions:
- CREATE_FOLDER: Create new folders
- MOVE_FILES: Move files to folders
- ORGANIZE_FILES: Automatically organize files by type
- GENERATE_CONTENT: Generate file content (README, documentation, etc.)
- ANALYZE_FILE: Analyze file content and provide insights

When user asks you to perform actions, respond in JSON format with:
{
  "action": "ACTION_NAME",
  "parameters": { ... },
  "message": "Human-readable response"
}

For general questions, just respond normally in a friendly and helpful way.`

      if (context) {
        systemPrompt += `\n\nCurrent Context:
- File: ${context.fileName || 'N/A'}
- Type: ${context.fileType || 'N/A'}
- Path: ${context.filePath || 'N/A'}`

        if (context.fileContent) {
          systemPrompt += `\n- Content Preview: ${context.fileContent.substring(0, 500)}...`
        }
      }

      // Prepare messages array with system prompt
      const fullMessages = [
        { role: 'system', content: systemPrompt },
        ...messages
      ]

      console.log('Calling Lovable AI with messages:', fullMessages.length)

      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: fullMessages,
          temperature: 0.7,
          max_tokens: 2048,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Lovable AI error:', response.status, errorText)

        if (response.status === 429) {
          return jsonResponse({ error: 'Rate limit exceeded. Please try again in a moment.' }, 429)
        }

        if (response.status === 402) {
          return jsonResponse({ error: 'Payment required. Please add credits to your Lovable workspace.' }, 402)
        }

        throw new Error(`Lovable AI error: ${response.statusText}`)
      }

      const data = await response.json()
      const assistantMessage = data.choices[0].message.content

      console.log('Received response from Lovable AI')

      // Try to parse action from response
      let action = null
      try {
        const jsonMatch = assistantMessage.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          action = JSON.parse(jsonMatch[0])
        }
      } catch (e) {
        console.log('No action found in response')
      }

      return jsonResponse({
        message: assistantMessage,
        action: action
      })

    } catch (error) {
      console.error('Error in squid-ai-chat function:', error)
      return jsonResponse({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Sorry, I encountered an error. Please try again.'
      }, 500)
    }
  })
})
