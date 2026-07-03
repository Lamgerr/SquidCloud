# Squid AI - Intelligent Cloud Storage Assistant

## Overview
Squid AI is an intelligent assistant powered by Google's Gemini 2.0 Flash that helps users manage their cloud storage through natural language commands.

## Features

### 1. **File Organization**
- Automatically organize files by type
- Create categorized folders:
  - Code Files (.js, .ts, .py, etc.)
  - Documents (.pdf, .doc, .txt, etc.)
  - Images (.jpg, .png, .gif, etc.)
  - Videos, Audio, Archives
  - Potentially Malicious files (auto-detected)
- Move files to appropriate folders

### 2. **Natural Language Commands**
Users can interact with Squid AI using natural language:
- "Hey Squid, organize my files"
- "Create a README for this project"
- "Move all images to a Photos folder"
- "Create a folder called Projects"

### 3. **Context-Aware AI**
- File context awareness (knows what file you're viewing)
- Generates content based on file type
- Provides intelligent suggestions

### 4. **Code Editor Integration**
Configure your preferred code editor in Settings:
- Visual Studio Code
- VS Code Insiders
- Cursor
- JetBrains IDEs (WebStorm, PhpStorm, PyCharm)
- Sublime Text
- Atom

### 5. **File Actions - "Open in Editor"**
When configured, file context menus show "Integrations" section with "Open in [Editor]" option.

## API Configuration

### Setting up Gemini API Key

1. **Get your Gemini API Key**:
   - Visit https://makersuite.google.com/app/apikey
   - Create a new API key

2. **Store in Supabase Secrets**:
   ```sql
   -- Run this in Supabase SQL Editor
   SELECT vault.create_secret('GEMINI_API_KEY', 'your-api-key-here');
   
   -- Create function to retrieve it
   CREATE OR REPLACE FUNCTION get_secret(secret_name text)
   RETURNS text
   LANGUAGE plpgsql
   SECURITY DEFINER
   AS $$
   DECLARE
     secret_value text;
   BEGIN
     SELECT decrypted_secret INTO secret_value
     FROM vault.decrypted_secrets
     WHERE name = secret_name;
     
     RETURN secret_value;
   END;
   $$;
   ```

3. **Grant permissions**:
   ```sql
   GRANT EXECUTE ON FUNCTION get_secret TO authenticated;
   ```

## Database Schema Updates

Add user preferences table for storing editor choice:

```sql
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  code_editor TEXT DEFAULT 'vscode',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own preferences"
  ON user_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON user_preferences FOR UPDATE
  USING (auth.uid() = user_id);
```

## Components Created

### 1. **SquidAIChat.tsx**
Interactive chat interface for Squid AI
- Real-time messaging
- Action execution
- Context awareness
- Loading states

### 2. **squid-ai.ts**
Core AI service using Gemini 2.0 Flash
- Chat history management
- Context-aware prompting
- Action parsing
- API communication

### 3. **squid-ai-tools.ts**
MCP (Model Context Protocol) Tools:
- `organizeFilesByType()` - Organize files automatically
- `createFolder()` - Create new folders
- `moveFilesToFolder()` - Move files
- `getCodeEditor()` / `setCodeEditor()` - Editor preferences
- `openInEditor()` - Generate editor URLs

## Usage Examples

### Organize Files
```typescript
import { SquidAITools } from '@/services/squid-ai-tools';

// Organize all files in current folder
const result = await SquidAITools.organizeFilesByType(files, currentFolder);
console.log(result.summary); // "Organized 45 files into 6 categories"
```

### Chat with Squid AI
```typescript
import { squidAI } from '@/services/squid-ai';

// Initialize
await squidAI.initialize();

// Send message
const response = await squidAI.chat("Organize my files", {
  fileName: 'current-file.pdf',
  fileType: 'application/pdf'
});

// Execute action if returned
if (response.action) {
  // Handle action
}
```

### Open File in Editor
```typescript
import { SquidAITools } from '@/services/squid-ai-tools';

const editorUrl = SquidAITools.openInEditor(
  '/path/to/file.js',
  'vscode'
);
// Returns: vscode://file//path/to/file.js

// Open in browser/system
window.location.href = editorUrl;
```

## File Context Menu Integration

Add "Integrations" section to file context menus with:
- Open in [Editor Name]
- Ask Squid AI about this file
- Generate documentation

## Settings Integration

The code editor setting has been added to the Settings tab in Dashboard:
- Select dropdown with all major editors
- Saves to user_preferences table
- Used in file action menus

## Future Enhancements

1. **More AI Actions**:
   - Duplicate file detection
   - Smart file tagging
   - Automatic backup suggestions
   - File relationship mapping

2. **Advanced Organization**:
   - Date-based organization
   - Project-based grouping
   - Size-based optimization

3. **Content Generation**:
   - README files
   - Documentation
   - Code comments
   - File descriptions

4. **Security**:
   - Enhanced malware detection
   - File integrity checking
   - Permission analysis

## Notes

- Gemini 2.0 Flash is used for fast, cost-effective responses
- All file operations respect RLS (Row Level Security)
- Editor integrations use URL protocols (may require desktop app installation)
- Malicious file detection is basic - enhance for production use

## Testing

1. Configure GEMINI_API_KEY in Supabase
2. Open Squid AI chat
3. Try commands:
   - "Organize my files"
   - "Create a folder called Test"
   - "What files do I have?"
4. Configure editor in Settings
5. Right-click file → Integrations → Open in Editor
