import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Upload, CheckCircle, AlertCircle, ArrowLeft, FileArchive, Loader2 } from '@/lib/icon-map';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader } from '@/components/ui/Loader';

interface MigrationJob {
  id: string;
  source_platform: string;
  status: string;
  total_files: number;
  processed_files: number;
  failed_files: number;
  settings: any;
  error_message?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

interface MigrationWizardProps {
  onComplete?: () => void;
  onCancel?: () => void;
}

const MigrationWizard: React.FC<MigrationWizardProps> = ({ onComplete, onCancel }) => {
  const [selectedZip, setSelectedZip] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [migrationJob, setMigrationJob] = useState<MigrationJob | null>(null);
  const { toast } = useToast();
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (migrationJob?.id && ['scheduled', 'extracting', 'uploading'].includes(migrationJob.status)) {
      const interval = setInterval(async () => {
        try {
          const { data, error } = await supabase.from('migration_jobs').select('*').eq('id', migrationJob.id).single();
          if (error) throw error;
          if (data) {
            setMigrationJob(data);
            if (data.status === 'completed' && onComplete) setTimeout(() => onComplete(), 2000);
          }
        } catch {}
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [migrationJob?.id, onComplete]);

  const handleZipSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.zip')) {
        toast({ title: "Invalid file", description: "Please select a ZIP file", variant: "destructive" });
        return;
      }
      setSelectedZip(file);
    }
  };

  const handleZipUpload = async () => {
    if (!selectedZip) return;
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const user = (await supabase.auth.getSession()).data.session?.user;
      if (!user) throw new Error('Not authenticated');

      const timestamp = Date.now();
      const storagePath = `${user.id}/${timestamp}/${selectedZip.name}`;

      const { error: uploadError } = await supabase.storage
        .from('migration-zips')
        .upload(storagePath, selectedZip, { cacheControl: '3600', upsert: false });

      if (uploadError) throw uploadError;
      setUploadProgress(50);

      const { data, error: fnError } = await supabase.functions.invoke('zip-upload', {
        body: { storagePath, originalName: selectedZip.name, totalSize: selectedZip.size, totalFiles: 0 }
      });

      if (fnError || data?.error) throw new Error(fnError?.message || data?.error || 'Failed to schedule import');
      setUploadProgress(100);

      setMigrationJob(data.job);

      toast({
        title: "ZIP Uploaded",
        description: "Your ZIP file has been queued for processing. Progress will update automatically.",
      });
    } catch (error: any) {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload ZIP file",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  if (migrationJob && ['scheduled', 'extracting', 'uploading', 'completed', 'failed'].includes(migrationJob.status)) {
    const progress = migrationJob.total_files > 0 ? (migrationJob.processed_files / migrationJob.total_files) * 100 : 0;

    return (
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileArchive className="h-5 w-5" /> ZIP Import Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Status</span>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              migrationJob.status === 'completed' ? 'text-green-500 bg-green-500/10' :
              migrationJob.status === 'failed' ? 'text-red-500 bg-red-500/10' :
              migrationJob.status === 'scheduled' ? 'text-yellow-500 bg-yellow-500/10' :
              'text-blue-500 bg-blue-500/10'
            }`}>
              {migrationJob.status === 'scheduled' ? 'Queued' :
               migrationJob.status === 'extracting' ? 'Extracting' :
               migrationJob.status === 'uploading' ? 'Uploading' :
               migrationJob.status === 'completed' ? 'Completed' :
               migrationJob.status === 'failed' ? 'Failed' : migrationJob.status}
            </span>
          </div>

          {migrationJob.total_files > 0 && <Progress value={progress} className="w-full" />}

          {['scheduled', 'extracting', 'uploading'].includes(migrationJob.status) && (
            <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 p-3 rounded-md text-sm flex items-center gap-2">
              <Loader size="sm" />
              {migrationJob.status === 'scheduled' && 'Your ZIP file is queued for processing…'}
              {migrationJob.status === 'extracting' && 'Extracting files from your ZIP archive…'}
              {migrationJob.status === 'uploading' && 'Uploading extracted files to your storage…'}
            </div>
          )}

          {migrationJob.total_files > 0 && (
            <div className="grid grid-cols-3 gap-4 text-center">
              <div><div className="text-2xl font-bold">{migrationJob.total_files}</div><div className="text-sm text-muted-foreground">Total</div></div>
              <div><div className="text-2xl font-bold text-green-600">{migrationJob.processed_files}</div><div className="text-sm text-muted-foreground">Uploaded</div></div>
              <div><div className="text-2xl font-bold text-red-600">{migrationJob.failed_files}</div><div className="text-sm text-muted-foreground">Failed</div></div>
            </div>
          )}

          {migrationJob.error_message && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-md">
              <p className="font-medium">Error:</p>
              <p className="text-sm">{migrationJob.error_message}</p>
            </div>
          )}

          {migrationJob.status === 'completed' && (
            <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 p-4 rounded-md text-center">
              <CheckCircle className="h-8 w-8 mx-auto mb-2" />
              <p className="font-medium">Import Completed!</p>
              <p className="text-sm">{migrationJob.processed_files} files imported</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><FileArchive className="h-5 w-5" /> Import from ZIP</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Select a ZIP backup file to import. It will be extracted and all files will be uploaded to your storage
          preserving the folder structure.
        </p>

        <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center space-y-4">
          <FileArchive className="mx-auto h-12 w-12 text-muted-foreground" />
          <div>
            <Label htmlFor="zip-upload-input" className="cursor-pointer">
              <span className="text-primary hover:text-primary/80 font-medium">
                {selectedZip ? selectedZip.name : 'Choose a ZIP file'}
              </span>
            </Label>
            <Input
              id="zip-upload-input"
              type="file"
              accept=".zip,application/zip"
              className="hidden"
              onChange={handleZipSelect}
            />
          </div>
          {selectedZip && (
            <div className="text-sm text-muted-foreground">
              {(selectedZip.size / 1024 / 1024).toFixed(1)} MB
            </div>
          )}
          <Button onClick={handleZipUpload} disabled={!selectedZip || isUploading} className="w-full">
            {isUploading ? (
              <><Loader size="sm" className="mr-2" /> Uploading…</>
            ) : (
              <><Upload className="w-4 h-4 mr-2" /> Upload & Import</>
            )}
          </Button>
          {isUploading && (
            <div className="space-y-2">
              <Progress value={uploadProgress} className="w-full" />
              <p className="text-xs text-muted-foreground">{uploadProgress}%</p>
            </div>
          )}
        </div>

        {onCancel && (
          <div className="pt-4 border-t">
            <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MigrationWizard;
