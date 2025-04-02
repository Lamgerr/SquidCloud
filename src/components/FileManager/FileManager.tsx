
import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { FileManagerProvider } from './FileManagerContext';
import FileManagerToolbar from './FileManagerToolbar';
import Breadcrumb from './Breadcrumb';
import FileGrid from './FileGrid';
import FilePreview from './FilePreview';

interface FileManagerProps {
  className?: string;
}

const FileManager: React.FC<FileManagerProps> = ({ className }) => {
  const [previewFile, setPreviewFile] = useState<{ id: string, type: string } | null>(null);

  const handleOpenPreview = (fileId: string, fileType: string) => {
    setPreviewFile({ id: fileId, type: fileType });
  };

  const handleClosePreview = () => {
    setPreviewFile(null);
  };

  return (
    <FileManagerProvider>
      <Card className={className}>
        <CardContent className="p-0">
          <div className="px-4 pt-4">
            <Breadcrumb />
          </div>
          <FileManagerToolbar />
          <FileGrid onOpenPreview={handleOpenPreview} />
        </CardContent>
      </Card>

      {previewFile && (
        <FilePreview 
          fileId={previewFile.id} 
          fileType={previewFile.type} 
          onClose={handleClosePreview} 
        />
      )}
    </FileManagerProvider>
  );
};

export default FileManager;
