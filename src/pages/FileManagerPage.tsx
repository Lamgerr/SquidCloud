
import React from 'react';
import FileManager from '@/components/FileManager/FileManager';

const FileManagerPage: React.FC = () => {
  return (
    <div className="container mx-auto max-w-6xl py-6 px-4">
      <h1 className="text-2xl font-semibold mb-4">File Manager</h1>
      <FileManager className="min-h-[calc(100vh-200px)]" />
    </div>
  );
};

export default FileManagerPage;
