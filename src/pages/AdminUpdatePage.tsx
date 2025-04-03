
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Upload, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const AdminUpdatePage = () => {
  const { os } = useParams<{ os: string }>();
  const [version, setVersion] = useState('');
  const [changelog, setChangelog] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [fileSize, setFileSize] = useState('');
  const [mandatory, setMandatory] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setIsAdmin(false);
          setVerifying(false);
          return;
        }

        const { data, error } = await supabase.functions.invoke('check-admin-status', {
          body: { userId: user.id }
        });

        if (error || !data?.isAdmin) {
          setIsAdmin(false);
        } else {
          setIsAdmin(true);
        }
      } catch (error) {
        console.error("Error checking admin status:", error);
        setIsAdmin(false);
      } finally {
        setVerifying(false);
      }
    };

    checkAdminStatus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!version || !changelog || !downloadUrl || !fileSize) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }
    
    try {
      setUploading(true);
      
      const { data, error } = await supabase.functions.invoke('add-app-update', {
        body: {
          version,
          platform: os || 'windows',
          changelog,
          download_url: downloadUrl,
          size: parseInt(fileSize),
          is_mandatory: mandatory,
        }
      });
      
      if (error) {
        throw new Error(error.message);
      }
      
      toast({
        title: "Update Published",
        description: `Version ${version} for ${os} has been published successfully.`
      });
      
      // Reset form
      setVersion('');
      setChangelog('');
      setDownloadUrl('');
      setFileSize('');
      setMandatory(false);
    } catch (error: any) {
      console.error("Error publishing update:", error);
      toast({
        title: "Publishing Failed",
        description: error.message || "Failed to publish update",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  if (verifying) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="container max-w-2xl mx-auto py-12 px-4">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">
              You don't have permission to access this page. This area is restricted to administrators only.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl mx-auto py-6 px-4">
      <h1 className="text-2xl font-bold mb-6">Publish App Update for {os}</h1>
      
      <Card>
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Update Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="version">Version Number</Label>
                <Input
                  id="version"
                  placeholder="e.g. 1.2.0"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fileSize">File Size (bytes)</Label>
                <Input
                  id="fileSize"
                  type="number"
                  placeholder="Size in bytes"
                  value={fileSize}
                  onChange={(e) => setFileSize(e.target.value)}
                  required
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="downloadUrl">Download URL</Label>
              <Input
                id="downloadUrl"
                placeholder="https://example.com/download/app.exe"
                value={downloadUrl}
                onChange={(e) => setDownloadUrl(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="changelog">Changelog</Label>
              <Textarea
                id="changelog"
                placeholder="What's new in this version..."
                value={changelog}
                onChange={(e) => setChangelog(e.target.value)}
                rows={6}
                required
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="mandatory"
                checked={mandatory}
                onCheckedChange={setMandatory}
              />
              <Label htmlFor="mandatory">Force update (mandatory)</Label>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end border-t pt-4">
            <Button type="submit" disabled={uploading}>
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Publishing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Publish Update
                </>
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default AdminUpdatePage;
