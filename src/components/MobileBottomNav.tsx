
import React, { useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Files, HardDrive, Settings, Upload, FolderTree } from 'lucide-react';
import { cn } from '@/lib/utils';

const MobileBottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (uploadInputRef.current) {
      uploadInputRef.current.click();
    }
  };

  return (
    <>
      <input
        type="file"
        ref={uploadInputRef}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) {
            navigate('/upload', { state: { file: e.target.files[0] } });
          }
        }}
      />
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-md border-t h-16 flex items-center justify-around z-50">
        <button
          onClick={() => navigate('/files')}
          className={cn(
            "flex flex-col items-center justify-center w-16 h-16",
            location.pathname === '/files' ? "text-primary" : "text-muted-foreground"
          )}
        >
          <Files className="h-5 w-5" />
          <span className="text-xs mt-1">Files</span>
        </button>

        <button
          onClick={() => navigate('/file-manager')}
          className={cn(
            "flex flex-col items-center justify-center w-16 h-16",
            location.pathname === '/file-manager' ? "text-primary" : "text-muted-foreground"
          )}
        >
          <FolderTree className="h-5 w-5" />
          <span className="text-xs mt-1">Storage</span>
        </button>

        <button
          onClick={handleUploadClick}
          className="flex flex-col items-center justify-center w-16 h-16 -mt-8"
        >
          <div className="bg-primary text-primary-foreground rounded-full p-4">
            <Upload className="h-5 w-5" />
          </div>
          <span className="text-xs mt-1">Upload</span>
        </button>

        <button
          onClick={() => navigate('/settings')}
          className={cn(
            "flex flex-col items-center justify-center w-16 h-16",
            location.pathname === '/settings' ? "text-primary" : "text-muted-foreground"
          )}
        >
          <Settings className="h-5 w-5" />
          <span className="text-xs mt-1">Settings</span>
        </button>
      </nav>
    </>
  );
};

export default MobileBottomNav;
