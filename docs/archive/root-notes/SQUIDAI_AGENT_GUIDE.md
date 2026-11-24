# SquidAI Agent - Comprehensive Guide

## 🤖 Overview

SquidAI has been transformed from a simple chat assistant into a **powerful AI agent** with real database and file system access. It can now perform actual operations on your files, query your storage, and execute complex tasks automatically.

## ✨ Key Capabilities

### 1. **File Analytics & Queries**
SquidAI can analyze your storage and answer questions like:
- "How many PDFs do I have?"
- "Show me my storage usage"
- "What are my largest files?"
- "Show me files by type"

### 2. **File Operations**
Full CRUD operations on your files:
- Create new files with content
- Read file contents
- Update existing files
- Delete files
- Rename files

### 3. **Folder Management**
Organize your storage structure:
- Create folders and subfolders
- Delete folders (with or without contents)
- List all folders
- Navigate folder hierarchies

### 4. **Search & Discovery**
Find anything in your storage:
- Search files by name
- Search folders
- Advanced content search (coming soon)
- Filter by file type

### 5. **Auto-Organization**
Let SquidAI organize your files:
- Automatically categorize files by type
- Create organized folder structures
- Move files to appropriate locations
- Batch operations

### 6. **Content Generation**
Generate new content intelligently:
- Create files based on reference text
- Generate code from descriptions
- Create documents from templates
- Reference instant preview modal content

## 🛠️ Available Tools

### Analytics Tools

#### `getFileAnalytics`
Get comprehensive storage statistics.

**Example Questions:**
- "Show me my file statistics"
- "What's the breakdown of my files?"
- "Analyze my storage"

**Returns:**
```typescript
{
  totalFiles: number;
  totalSize: number;
  filesByType: Record<string, number>;
  largestFiles: Array<{ name: string; size: number }>;
  recentFiles: Array<{ name: string; created_at: string }>;
}
```

#### `countFilesByExtension`
Count files with specific extensions.

**Example Questions:**
- "How many PDFs do I have?"
- "Count my images"
- "How many videos are there?"

**Usage:**
```typescript
// User asks: "How many PDFs?"
await SquidAITools.countFilesByExtension('pdf')
// Returns: 42
```

#### `getStorageUsed`
Get storage usage information.

**Example Questions:**
- "How much storage am I using?"
- "What's my storage percentage?"
- "Show storage stats"

**Returns:**
```typescript
{
  used: number;        // Bytes used
  total: number;       // Total bytes available
  percentage: number;  // Usage percentage
}
```

### File Operation Tools

#### `createFile`
Create a new file with content.

**Example Requests:**
- "Create a TODO.md file with my tasks"
- "Make a README file explaining this project"
- "Generate a config.json file"

**Parameters:**
```typescript
{
  fileName: string;
  content: string;
  parentFolder?: string;
  fileType?: string;  // MIME type
}
```

#### `readFileContent`
Read content from an existing file.

**Example Requests:**
- "What's in my README file?"
- "Show me the content of config.json"
- "Read the TODO list"

#### `updateFileContent`
Modify existing file content.

**Example Requests:**
- "Update my README to include installation steps"
- "Add a new item to my TODO list"
- "Change the configuration"

#### `deleteFile`
Remove a file from storage.

**Example Requests:**
- "Delete old-file.txt"
- "Remove the temporary files"

#### `renameFile`
Rename an existing file.

**Example Requests:**
- "Rename document.txt to report.txt"
- "Change the file name to project-final.docx"

### Folder Management Tools

#### `createFolder`
Create a new folder.

**Example Requests:**
- "Create a Projects folder"
- "Make a new folder called Documents"
- "Create a subfolder for images"

**Parameters:**
```typescript
{
  folderName: string;
  parentPath?: string;  // Optional parent folder
}
```

#### `deleteFolder`
Delete a folder.

**Example Requests:**
- "Delete the temp folder"
- "Remove the old-projects folder and its contents"

**Parameters:**
```typescript
{
  folderPath: string;
  deleteContents: boolean;  // Delete files inside?
}
```

#### `listFolders`
List all folders.

**Example Requests:**
- "Show me all my folders"
- "List folders in Documents"
- "What folders do I have?"

### Search Tools

#### `searchFiles`
Search for files and folders.

**Example Requests:**
- "Find all files with 'report' in the name"
- "Search for project files"
- "Find my presentation"

**Parameters:**
```typescript
{
  query: string;
  searchContent?: boolean;  // Search inside files
}
```

**Returns:**
```typescript
{
  files: any[];
  folders: any[];
  totalResults: number;
}
```

#### `getFilesInFolder`
List files in a specific folder.

**Example Requests:**
- "What's in my Documents folder?"
- "List files in Projects"
- "Show me what's in Images"

### Organization Tools

#### `organizeFilesByType`
Automatically organize files into categorized folders.

**Example Requests:**
- "Organize my files"
- "Auto-categorize everything"
- "Clean up my storage"

**Creates folders:**
- Code Files (.js, .ts, .py, etc.)
- Documents (.pdf, .doc, .txt, etc.)
- Spreadsheets (.xlsx, .csv, etc.)
- Images (.jpg, .png, .gif, etc.)
- Videos (.mp4, .avi, etc.)
- Audio (.mp3, .wav, etc.)
- Archives (.zip, .rar, etc.)
- Data (.json, .xml, etc.)
- Others (everything else)

**Returns:**
```typescript
{
  foldersCreated: string[];
  filesMoved: Array<{ from: string; to: string }>;
  summary: string;
}
```

#### `moveFilesToFolder`
Move specific files to a target folder.

**Example Requests:**
- "Move all PDFs to Documents"
- "Put images in the Photos folder"
- "Move these files to Archive"

### Content Generation Tools

#### `generateContentFromReference`
Generate new content based on reference text.

**Example Requests:**
- "Create a README based on this code"
- "Generate documentation from the preview"
- "Make a summary of this text"

**Parameters:**
```typescript
{
  referenceText: string;
  outputType: 'markdown' | 'code' | 'text';
  instructions: string;
}
```

#### `generateCode`
Generate code from descriptions.

**Example Requests:**
- "Write a Python function to sort files"
- "Create a React component for file upload"
- "Generate TypeScript types for file metadata"

**Parameters:**
```typescript
{
  language: string;
  description: string;
  context?: string;
}
```

## 💬 Example Conversations

### File Analytics
```
User: "How many PDFs do I have?"
SquidAI: 🔧 Using countFilesByExtension...
         📊 Found 42 PDF files.

User: "Show me my storage usage"
SquidAI: 🔧 Using getStorageUsed...
         💾 Storage Usage:
         - Used: 2.3 GB
         - Total: 10 GB
         - 23% used
```

### File Creation
```
User: "Create a TODO.md file with my tasks for today"
SquidAI: 🔧 Creating file...
         ✅ File created successfully!
         Created: TODO.md
         
User: "Add 'Review pull requests' to that file"
SquidAI: 🔧 Updating file content...
         ✅ File updated successfully!
```

### Organization
```
User: "My files are a mess, can you organize them?"
SquidAI: 🔧 Running organizeFilesByType...
         ✨ Organized 156 files into 8 categories:
         - Code Files (42 files)
         - Documents (33 files)
         - Images (28 files)
         - Videos (12 files)
         - Archives (8 files)
         - Spreadsheets (15 files)
         - Audio (6 files)
         - Others (12 files)
```

### Search & Discovery
```
User: "Find all my project files"
SquidAI: 🔧 Searching files...
         🔍 Found 15 results:
         - 12 files (project-plan.pdf, project.ts, etc.)
         - 3 folders (Projects, project-archive, etc.)
         
User: "What's in my Projects folder?"
SquidAI: 🔧 Listing folder contents...
         📁 Projects folder contains:
         - website-redesign/
         - mobile-app/
         - api-server/
         - README.md
         - roadmap.txt
```

### Content Generation
```
User: "Create a Python script to count files by extension"
SquidAI: 🔧 Generating code...
         ✅ Created: count_files.py
         
         The script includes:
         - File extension counter
         - Directory traversal
         - Pretty-printed results
         
         Ready to use!
```

## 🔄 Tool Execution Flow

1. **User Input** → User asks a question or makes a request
2. **Intent Recognition** → SquidAI determines if a tool is needed
3. **Tool Selection** → AI chooses the appropriate tool
4. **Parameter Extraction** → AI extracts parameters from user input
5. **Tool Execution** → Real database/file operation is performed
6. **Result Processing** → Results are formatted for user
7. **Response Generation** → Natural language response with results

## 🎯 Best Practices

### For Users

1. **Be Specific**: "Count PDF files" works better than "files"
2. **Provide Context**: Include folder names, file types, etc.
3. **Ask Follow-ups**: SquidAI maintains conversation history
4. **Use Natural Language**: No need for technical syntax
5. **Review Results**: Always check what SquidAI did

### For Developers

1. **Error Handling**: All tools include try-catch blocks
2. **User Permissions**: Tools check user authentication
3. **Database Safety**: RLS policies protect user data
4. **Logging**: Tool execution is logged for debugging
5. **Type Safety**: Full TypeScript types for all operations

## 🔐 Security

- **Row-Level Security**: All database operations respect RLS policies
- **User Authentication**: Tools verify user session before execution
- **Permission Checks**: Users can only access their own files
- **Safe Operations**: Delete operations include confirmations
- **Audit Trail**: All operations can be logged and tracked

## 🚀 Future Enhancements

### Planned Features
- [ ] Advanced content search (full-text search)
- [ ] Batch operations (process multiple files)
- [ ] Smart suggestions (AI-powered file organization)
- [ ] File versioning support
- [ ] Collaborative file sharing integration
- [ ] Advanced code generation (with syntax validation)
- [ ] File preview integration (read from preview modal)
- [ ] Scheduled tasks (automated organization)
- [ ] Natural language queries for complex operations
- [ ] Integration with external AI models (GPT-4, Claude, etc.)

### Tool Expansions
- Image analysis and tagging
- PDF text extraction and search
- Video metadata extraction
- Audio transcription
- Archive contents preview
- Code analysis and refactoring suggestions
- Duplicate file detection
- Storage optimization recommendations

## 📊 Performance

- **Fast Queries**: Database queries use proper indexes
- **Efficient Operations**: Batch operations minimize round-trips
- **Smart Caching**: Conversation history enables context awareness
- **Background Tasks**: Long operations can run in background
- **Real-time Updates**: UI updates immediately after operations

## 🐛 Troubleshooting

### Common Issues

**Q: SquidAI says "Error executing tool"**
A: Check your authentication and permissions. Ensure you're logged in.

**Q: File counts seem wrong**
A: Check your current folder context. Tools may be scoped to specific folders.

**Q: Created files don't appear**
A: Refresh your file list. Files are created in the database and storage.

**Q: Search returns no results**
A: Try broader search terms. Search is case-insensitive but exact match.

**Q: Organization creates too many folders**
A: This is normal - SquidAI creates categories for all file types found.

## 🎓 Learning Path

1. **Start Simple**: Try file counting and analytics queries
2. **Practice Searches**: Find files and folders by name
3. **Create Content**: Make simple text files
4. **Organize Files**: Let SquidAI auto-organize your storage
5. **Advanced Operations**: Batch moves, content generation
6. **Custom Workflows**: Combine multiple tools in conversations

## 📝 API Reference

See `src/services/squid-ai-tools.ts` for complete TypeScript definitions.

## 🤝 Contributing

Want to add new tools? Follow this pattern:

```typescript
// 1. Add method to SquidAITools class
static async myNewTool(param: string): Promise<Result> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');
  
  // Your implementation
  return result;
}

// 2. Register tool in SquidAI.registerTools()
{
  name: 'myNewTool',
  description: 'What this tool does',
  parameters: {
    type: 'object',
    properties: {
      param: { type: 'string', description: 'Parameter description' }
    },
    required: ['param']
  }
}

// 3. Add case to SquidAI.executeTool()
case 'myNewTool':
  return await SquidAITools.myNewTool(args.param);

// 4. Add formatting in SquidAI.formatToolResult()
case 'myNewTool':
  return `✅ ${result.message}`;
```

## 📚 Resources

- [SquidAI Source Code](src/services/squid-ai.ts)
- [Tools Implementation](src/services/squid-ai-tools.ts)
- [Database Schema](supabase/migrations/)
- [API Documentation](API_README.md)

---

**SquidAI Agent** - Your intelligent file management assistant 🐙✨
