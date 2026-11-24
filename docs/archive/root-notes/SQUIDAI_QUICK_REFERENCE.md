# SquidAI Quick Reference

## 🚀 Quick Start

Just ask SquidAI natural questions and it will execute the appropriate tools automatically!

## 📊 File Analytics

| Ask SquidAI | What It Does |
|-------------|-------------|
| "How many PDFs do I have?" | Counts PDF files |
| "Show storage usage" | Displays used/total storage |
| "What are my largest files?" | Lists biggest files |
| "Analyze my files" | Full analytics breakdown |
| "Show files by type" | Groups files by extension |
| "What's my storage percentage?" | Usage percentage |

## 📁 File Operations

| Ask SquidAI | What It Does |
|-------------|-------------|
| "Create a README.md file" | Creates new file |
| "Make a TODO list file" | Creates TODO.md with content |
| "What's in my config.json?" | Reads file content |
| "Update my README" | Modifies file content |
| "Delete temp.txt" | Removes file |
| "Rename doc.txt to report.txt" | Renames file |

## 🗂️ Folder Management

| Ask SquidAI | What It Does |
|-------------|-------------|
| "Create a Projects folder" | Creates new folder |
| "Make a Documents subfolder" | Creates nested folder |
| "Delete old-files folder" | Removes folder |
| "What folders do I have?" | Lists all folders |
| "Show me folders in /Projects" | Lists subfolders |

## 🔍 Search

| Ask SquidAI | What It Does |
|-------------|-------------|
| "Find files with 'project' in name" | Searches by name |
| "Search for my presentation" | Finds matching files |
| "What's in my Documents folder?" | Lists folder contents |
| "Find all images" | Searches by type |

## ✨ Organization

| Ask SquidAI | What It Does |
|-------------|-------------|
| "Organize my files" | Auto-categorizes by type |
| "Clean up my storage" | Creates organized structure |
| "Move PDFs to Documents" | Moves specific files |
| "Sort files into folders" | Batch organization |

## 🎨 Content Generation

| Ask SquidAI | What It Does |
|-------------|-------------|
| "Generate a Python script to..." | Creates code file |
| "Create docs from this preview" | Uses reference content |
| "Make a README for this project" | Generates documentation |
| "Write a TypeScript interface for..." | Generates type definitions |

## 🛠️ Tool Names (for developers)

```typescript
// Analytics
getFileAnalytics(fileType?)
countFilesByExtension(extension)
getStorageUsed()
searchFiles(query, searchContent?)
getFilesInFolder(folderPath)

// File Operations
createFile(fileName, content, parentFolder?, fileType?)
readFileContent(fileId)
updateFileContent(fileId, newContent)
deleteFile(fileId)
renameFile(fileId, newName)

// Folder Operations
createFolder(folderName, parentPath?)
deleteFolder(folderPath, deleteContents)
listFolders(parentPath?)

// Organization
organizeFilesByType(files, currentPath?)
moveFilesToFolder(fileIds, targetFolder)

// Content Generation
generateContentFromReference(referenceText, outputType, instructions)
generateCode(language, description, context?)
```

## 💡 Pro Tips

1. **Be Conversational**: "How many videos?" works just as well as "Count video files"
2. **Context Matters**: SquidAI remembers conversation history
3. **Ask Follow-ups**: "Now move them to Videos folder" continues the context
4. **Natural Language**: No need for technical commands
5. **Preview Reference**: Say "use the preview content" to reference open files

## ⚡ Example Workflows

### Organize New Files
```
You: "How many files do I have?"
AI: "📊 Found 156 files"
You: "Organize them by type"
AI: "✨ Organized into 8 categories"
You: "Show me what's in Code Files"
AI: "📁 Code Files contains 42 items..."
```

### Create Project Structure
```
You: "Create a Projects folder"
AI: "✅ Folder created"
You: "Inside that, create README.md"
AI: "✅ File created in Projects/"
You: "Add installation instructions"
AI: "✅ Updated README.md"
```

### Find and Clean Up
```
You: "How many duplicate files?"
AI: "🔍 Found 8 potential duplicates"
You: "Show me the list"
AI: "📋 Here are the duplicates..."
You: "Delete the older copies"
AI: "✅ Deleted 4 files"
```

## 🎯 Common Patterns

**Count by Type**: "How many [type]?" → Auto-uses `countFilesByExtension`

**Storage Info**: "storage", "usage", "space" → Uses `getStorageUsed`

**Create Files**: "create", "make", "new file" → Uses `createFile`

**Organization**: "organize", "sort", "clean up" → Uses `organizeFilesByType`

**Search**: "find", "search", "where is" → Uses `searchFiles`

## 🔧 Troubleshooting

| Issue | Solution |
|-------|----------|
| "Tool failed" | Check you're logged in |
| Wrong count | Verify folder context |
| Can't find file | Try broader search terms |
| Slow response | Complex operations take time |
| Unexpected results | Be more specific in request |

---

**Ready to try?** Just start chatting with SquidAI! 🐙💬
