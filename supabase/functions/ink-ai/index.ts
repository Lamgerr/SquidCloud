import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withPrelGateway, jsonResponse, getCorsHeaders, PrelContext } from '../_shared/kza-prel.ts';

serve(async (req) => {
  return withPrelGateway(req, { functionId: 'ink-ai', operation: 'default' }, async (ctx: PrelContext) => {
    try {
    const { prompt, fileContext } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    // Define tools for file operations
    const tools = [
      {
        type: "function",
        function: {
          name: "organize_files_by_type",
          description: "Organize files into folders based on their file type (e.g., images, videos, documents, code, archives)",
          parameters: {
            type: "object",
            properties: {
              fileTypes: {
                type: "array",
                items: { type: "string" },
                description: "Array of file type categories to organize (e.g., ['images', 'videos', 'documents', 'code', 'archives', 'audio'])"
              }
            },
            required: ["fileTypes"],
            additionalProperties: false
          }
        }
      },
      {
        type: "function",
        function: {
          name: "create_file_with_content",
          description: "Create a new file with specified content (e.g., README, documentation, code files)",
          parameters: {
            type: "object",
            properties: {
              fileName: {
                type: "string",
                description: "Name of the file to create (with extension)"
              },
              content: {
                type: "string",
                description: "Content to write to the file"
              },
              mimeType: {
                type: "string",
                description: "MIME type of the file (e.g., 'text/plain', 'text/markdown', 'application/json')"
              }
            },
            required: ["fileName", "content", "mimeType"],
            additionalProperties: false
          }
        }
      },
      {
        type: "function",
        function: {
          name: "move_files_to_folder",
          description: "Move multiple files to a specific folder",
          parameters: {
            type: "object",
            properties: {
              folderName: {
                type: "string",
                description: "Name of the destination folder"
              },
              fileNames: {
                type: "array",
                items: { type: "string" },
                description: "Array of file names to move"
              }
            },
            required: ["folderName", "fileNames"],
            additionalProperties: false
          }
        }
      }
    ];

    // Build system prompt with file context
    let systemPrompt = `You are INK, an intelligent AI assistant for SquidCloud storage. You help users organize files, create content, and manage their cloud storage efficiently.

You have access to these tools:
- organize_files_by_type: Organize files into folders by type
- create_file_with_content: Create new files with content
- move_files_to_folder: Move files to specific folders

When users ask you to perform operations, use the appropriate tools. Be conversational and helpful.`;

    if (fileContext) {
      systemPrompt += `\n\nCurrent Context:
- File: ${fileContext.fileName || 'N/A'}
- Type: ${fileContext.fileType || 'N/A'}
- In Preview: ${fileContext.inPreview ? 'Yes' : 'No'}`;
    }

    // Call Lovable AI with tool calling
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt }
        ],
        tools: tools,
        tool_choice: "auto"
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Lovable AI error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.statusText}`);
    }

    const data = await response.json();
    const message = data.choices[0].message;

    // Process tool calls if any
    let operations: any[] = [];
    if (message.tool_calls && message.tool_calls.length > 0) {
      operations = message.tool_calls.map((tool: any) => {
        const args = JSON.parse(tool.function.arguments);
        return {
          type: tool.function.name,
          params: args
        };
      });
    }

    return jsonResponse({
      message: message.content || "Operation queued",
      operations: operations
    });

  } catch (error: unknown) {
    console.error("INK AI error:", error);
    return jsonResponse({
      error: error instanceof Error ? error.message : "Unknown error",
      message: "Sorry, I encountered an error processing your request."
    }, 500);
  }
  });
});
