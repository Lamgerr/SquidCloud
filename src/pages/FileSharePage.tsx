
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Download, FileText, Lock, File, Share2 } from 'lucide-react';
import { FileItem as FileItemType } from '@/lib/api';
import FilePreview from '@/components/FilePreview';

const FileSharePage = () => {
  const { fileId } = useParams<{ fileId: string }>();
  const [file, setFile] = useState<FileItemType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessCode, setAccessCode] = useState<string>('');
  const [needsAccessCode, setNeedsAccessCode] = useState(false);
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    const fetchSharedFile = async () => {
      try {
        setLoading(true);
        
        if (!fileId) {
          setError("File ID is missing");
          return;
        }
        
        // First check if this is a public shared file
        const { data, error: fetchError } = await supabase
          .from('files')
          .select('*')
          .eq('id', fileId)
          .eq('shared', true)
          .single();
          
        if (fetchError) {
          // If not publicly shared, check if it requires access code
          setNeedsAccessCode(true);
          setLoading(false);
          return;
        }
        
        if (data) {
          setFile(data as FileItemType);
        } else {
          setError("File not found or not shared");
        }
      } catch (err: any) {
        console.error("Error fetching shared file:", err);
        setError(err.message || "An error occurred while fetching the file");
      } finally {
        setLoading(false);
      }
    };
    
    fetchSharedFile();
  }, [fileId]);

  const validateAccessCode = async () => {
    if (!fileId || !accessCode.trim()) return;
    
    try {
      setValidating(true);
      
      const { data, error } = await supabase.functions.invoke('validate-share', {
        body: { fileId, accessCode: accessCode.trim() }
      });
      
      if (error) {
        setError("Invalid access code");
        return;
      }
      
      if (data?.file) {
        setFile(data.file as FileItemType);
        setNeedsAccessCode(false);
      } else {
        setError("Invalid access code");
      }
    } catch (err: any) {
      console.error("Error validating access code:", err);
      setError(err.message || "Failed to validate access code");
    } finally {
      setValidating(false);
    }
  };

  const handleDownload = async () => {
    if (!file) return;
    
    try {
      const { data, error } = await supabase.functions.invoke('download-shared-file', {
        body: { fileId: file.id, accessCode: accessCode.trim() }
      });
      
      if (error) {
        setError("Failed to download file");
        return;
      }
      
      // Create download URL from the received data
      const blob = new Blob([data.content], { type: file.type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
    } catch (err: any) {
      console.error("Error downloading file:", err);
      setError(err.message || "Failed to download file");
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-12 flex flex-col items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading shared file...</p>
      </div>
    );
  }

  if (needsAccessCode && !file) {
    return (
      <div className="container mx-auto py-12 max-w-md">
        <Card className="shadow-lg">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-6">
              <div className="rounded-full bg-primary/10 p-3 mb-4">
                <Lock className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-2xl font-semibold mb-1">Protected File</h2>
              <p className="text-muted-foreground text-center mb-6">
                This file requires an access code to view
              </p>
              
              {error && (
                <div className="bg-destructive/10 text-destructive p-3 rounded-md mb-4 w-full text-center">
                  {error}
                </div>
              )}
              
              <div className="flex w-full max-w-sm items-center space-x-2 mb-4">
                <Input 
                  type="text" 
                  placeholder="Enter access code" 
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                />
                <Button onClick={validateAccessCode} disabled={validating}>
                  {validating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Validating
                    </>
                  ) : (
                    'Access'
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
          <CardFooter className="justify-center border-t pt-4">
            <p className="text-xs text-muted-foreground">
              Don't have the access code? Contact the person who shared this file with you.
            </p>
          </CardFooter>
        </Card>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="container mx-auto py-12 max-w-md">
        <Card className="shadow-lg">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-8">
              <div className="rounded-full bg-destructive/10 p-3 mb-4">
                <FileText className="h-8 w-8 text-destructive" />
              </div>
              <h2 className="text-2xl font-semibold mb-1">File Not Available</h2>
              <p className="text-muted-foreground text-center mb-4">
                {error}
              </p>
              <Button asChild variant="outline">
                <Link to="/">Go Home</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (file) {
    return (
      <div className="container mx-auto py-6">
        <Card className="shadow-lg">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <div className="rounded-full bg-primary/10 p-2 mr-3">
                  <File className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">{file.name}</h2>
                  <p className="text-sm text-muted-foreground">
                    {file.type} • Shared with you
                  </p>
                </div>
              </div>
              <Button onClick={handleDownload} size="sm" className="flex items-center gap-1">
                <Download className="h-4 w-4" />
                Download
              </Button>
            </div>
            
            <FilePreview file={file} onClose={() => {}} />
          </CardContent>
          <CardFooter className="justify-between border-t pt-4">
            <p className="text-xs text-muted-foreground">
              Securely shared via CloudBliss
            </p>
            <div className="flex items-center text-xs text-muted-foreground">
              <Share2 className="h-3 w-3 mr-1" />
              Shared file
            </div>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return null;
};

export default FileSharePage;
