
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import FileManager from '@/components/FileManager';
import { useAuth } from '@/contexts/AuthContext';
import DragDropUpload from '@/components/DragDropUpload';

const StoragePage = () => {
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <DragDropUpload
      onDragStateChange={setIsDragging}
      onFilesDropped={(files) => {
        if (files.length > 0) {
          toast({
            title: "Files received",
            description: `${files.length} file(s) being processed for upload`,
          });
        }
      }}
    >
      <div className={`container mx-auto py-6 px-4 ${isDragging ? 'bg-primary/10 border-2 border-dashed border-primary/30 rounded-lg' : ''}`}>
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Storage Manager</h1>
          <p className="text-muted-foreground">
            Manage your files and folders securely in the cloud
          </p>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex justify-between items-center">
              <span>File Browser</span>
              {isDragging && (
                <span className="text-sm font-normal text-primary animate-pulse">
                  Drop files to upload
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FileManager />
          </CardContent>
        </Card>
      </div>
    </DragDropUpload>
  );
};

export default StoragePage;
