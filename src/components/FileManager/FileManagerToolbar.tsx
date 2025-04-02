
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  FolderPlus, Upload, LayoutGrid, List, 
  SortAsc, SortDesc, Search, X, Filter
} from 'lucide-react';
import { useFileManager } from './FileManagerContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { createFolder, uploadFileToFolder } from '@/lib/file-manager';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const FileManagerToolbar: React.FC = () => {
  const { state, dispatch, refreshCurrentFolder } = useFileManager();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a folder name",
        variant: "destructive"
      });
      return;
    }

    try {
      const folder = await createFolder(newFolderName.trim(), state.currentFolder);
      dispatch({ type: 'ADD_ITEM', payload: folder });
      setShowNewFolderDialog(false);
      setNewFolderName('');
      
      toast({
        title: "Folder created",
        description: `Folder "${newFolderName}" has been created`
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create folder",
        variant: "destructive"
      });
    }
  };

  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    
    try {
      toast({
        title: "Uploading",
        description: `Uploading ${file.name}...`,
      });
      
      const uploadedFile = await uploadFileToFolder(
        file, 
        state.currentFolder,
        (progress) => {
          // Handle progress updates if needed
        }
      );
      
      dispatch({ type: 'ADD_ITEM', payload: uploadedFile });
      
      toast({
        title: "Upload complete",
        description: `${file.name} has been uploaded`
      });
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload file",
        variant: "destructive"
      });
    } finally {
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const toggleViewMode = () => {
    const newMode = state.viewMode === 'grid' ? 'list' : 'grid';
    dispatch({ type: 'SET_VIEW_MODE', payload: newMode });
  };

  const toggleSortDirection = () => {
    const newDirection = state.sorting.direction === 'asc' ? 'desc' : 'asc';
    dispatch({ 
      type: 'SET_SORTING', 
      payload: { ...state.sorting, direction: newDirection }
    });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Implement search functionality
    console.log("Search for:", searchTerm);
  };

  return (
    <div className="flex flex-col space-y-2 p-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowNewFolderDialog(true)}
          >
            <FolderPlus className="h-4 w-4 mr-2" />
            New Folder
          </Button>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleUploadClick}
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload
          </Button>
          
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>

        <div className="flex items-center space-x-2">
          {showSearch ? (
            <form onSubmit={handleSearch} className="flex items-center">
              <Input
                type="text"
                placeholder="Search files..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9 w-[200px]"
              />
              <Button 
                variant="ghost" 
                size="icon" 
                type="button"
                onClick={() => setShowSearch(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </form>
          ) : (
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setShowSearch(true)}
            >
              <Search className="h-4 w-4" />
            </Button>
          )}
          
          <Button 
            variant="ghost" 
            size="icon"
            onClick={toggleViewMode}
          >
            {state.viewMode === 'grid' ? (
              <LayoutGrid className="h-4 w-4" />
            ) : (
              <List className="h-4 w-4" />
            )}
          </Button>
          
          <Button 
            variant="ghost" 
            size="icon"
            onClick={toggleSortDirection}
          >
            {state.sorting.direction === 'asc' ? (
              <SortAsc className="h-4 w-4" />
            ) : (
              <SortDesc className="h-4 w-4" />
            )}
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup 
                value={state.sorting.field}
                onValueChange={(value) => {
                  dispatch({ 
                    type: 'SET_SORTING', 
                    payload: { 
                      ...state.sorting, 
                      field: value as 'name' | 'created_at' | 'updated_at' | 'size'
                    }
                  });
                }}
              >
                <DropdownMenuRadioItem value="name">Name</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="created_at">Date created</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="updated_at">Date modified</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="size">Size</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* New Folder Dialog */}
      <Dialog open={showNewFolderDialog} onOpenChange={setShowNewFolderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create new folder</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Folder name"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewFolderDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateFolder}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FileManagerToolbar;
