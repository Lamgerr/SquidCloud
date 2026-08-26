import React from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import EnhancedFileManager from '@/components/EnhancedFileManager';
import FileManager from '@/components/FileManager';
import { HardDrive } from '@/lib/icon-map';

const StorageTab = () => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return <FileManager />;
  }

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-lg bg-card border border-sky-500/20 p-5">
        <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/5 rounded-full blur-3xl -translate-y-1/3 translate-x-1/4" />
        <div className="relative z-10 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400 shadow-sm">
            <HardDrive className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Storage</h1>
            <p className="mt-0.5 text-sm text-white/50">Browse and manage your file repositories &amp; mount points.</p>
          </div>
        </div>
      </div>
      <div className="rounded-lg bg-card/50 border border-border overflow-hidden">
        <EnhancedFileManager />
      </div>
    </div>
  );
};

export default StorageTab;
