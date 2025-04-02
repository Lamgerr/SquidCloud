
import React from 'react';
import { useFileManager } from './FileManagerContext';
import FileListItem from './FileListItem';

interface FileGridProps {
  onOpenPreview: (fileId: string, fileType: string) => void;
}

const FileGrid: React.FC<FileGridProps> = ({ onOpenPreview }) => {
  const { state } = useFileManager();
  
  // Sort items based on current sorting settings
  const sortedItems = [...state.items].sort((a, b) => {
    const { field, direction } = state.sorting;
    
    // Handle different field types
    switch (field) {
      case 'name':
        return direction === 'asc' 
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
        
      case 'created_at':
        return direction === 'asc'
          ? new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        
      case 'updated_at':
        return direction === 'asc'
          ? new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
          : new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        
      case 'size':
        const sizeA = a.size || 0;
        const sizeB = b.size || 0;
        return direction === 'asc' ? sizeA - sizeB : sizeB - sizeA;
        
      default:
        return 0;
    }
  });
  
  // Separate folders and files, with folders first
  const folders = sortedItems.filter(item => item.type === 'folder');
  const files = sortedItems.filter(item => item.type === 'file');
  
  // Combine them for display
  const itemsToDisplay = [...folders, ...files];

  if (state.loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
        <span className="ml-2">Loading...</span>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="text-center p-4 text-destructive">
        <p>Error: {state.error}</p>
      </div>
    );
  }

  if (itemsToDisplay.length === 0) {
    return (
      <div className="text-center p-10">
        <p className="text-muted-foreground">This folder is empty</p>
        <p className="text-sm mt-2">Click 'New Folder' to create a folder or 'Upload' to add files</p>
      </div>
    );
  }

  return (
    <div className={state.viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4" : "flex flex-col"}>
      {itemsToDisplay.map(item => (
        <FileListItem 
          key={item.id} 
          item={item} 
          onOpenPreview={onOpenPreview} 
        />
      ))}
    </div>
  );
};

export default FileGrid;
