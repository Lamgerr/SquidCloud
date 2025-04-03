
import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const AdminUpdatePage = () => {
  const { os } = useParams<{ os: string }>();
  const { toast } = useToast();
  const [version, setVersion] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [releaseNotes, setReleaseNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase.functions.invoke('check-admin-status');
        
        if (error) {
          throw error;
        }
        
        if (data && data.is_admin) {
          setIsAdmin(true);
        } else {
          toast({
            title: "Access Denied",
            description: "You don't have permission to access this page.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
      }
    };
    
    checkAdminStatus();
  }, [user, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!version || !downloadUrl) {
      toast({
        title: "Missing Information",
        description: "Version and download URL are required.",
        variant: "destructive",
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('add-app-update', {
        body: {
          platform: os,
          version,
          download_url: downloadUrl,
          release_notes: releaseNotes,
        },
      });
      
      if (error) {
        throw error;
      }
      
      toast({
        title: "Update Added",
        description: `Version ${version} added successfully for ${os}.`,
      });
      
      // Reset form
      setVersion('');
      setDownloadUrl('');
      setReleaseNotes('');
      
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add update.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getOSName = () => {
    switch(os?.toLowerCase()) {
      case 'windows': return 'Windows';
      case 'macos': return 'macOS';
      case 'android': return 'Android';
      default: return 'Unknown OS';
    }
  };

  if (!isAdmin) {
    return (
      <div className="container mx-auto py-10">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You don't have permission to access this page.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <Card>
        <CardHeader>
          <CardTitle>Add {getOSName()} App Update</CardTitle>
          <CardDescription>Publish a new update for {getOSName()} users</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="version">Version</Label>
              <Input
                id="version"
                placeholder="1.0.0"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="downloadUrl">Download URL</Label>
              <Input
                id="downloadUrl"
                placeholder="https://example.com/download"
                value={downloadUrl}
                onChange={(e) => setDownloadUrl(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="releaseNotes">Release Notes</Label>
              <Textarea
                id="releaseNotes"
                placeholder="What's new in this version..."
                value={releaseNotes}
                onChange={(e) => setReleaseNotes(e.target.value)}
                rows={5}
              />
            </div>
            
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? 'Publishing...' : 'Publish Update'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminUpdatePage;
