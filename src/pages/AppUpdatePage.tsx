
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Clock, Package, Check } from 'lucide-react';

interface AppVersion {
  id: string;
  version: string;
  platform: string;
  download_url: string;
  changelog: string;
  release_date: string;
  size: number;
  is_mandatory: boolean;
}

const AppUpdatePage = () => {
  const [searchParams] = useSearchParams();
  const platform = searchParams.get('platform') || 'windows';
  const [latestVersion, setLatestVersion] = useState<AppVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLatestVersion = async () => {
      try {
        setLoading(true);
        
        const { data, error } = await supabase.functions.invoke('get-app-updates', {
          body: { platform }
        });
        
        if (error) {
          throw new Error(error.message);
        }
        
        if (data?.latestVersion) {
          setLatestVersion(data.latestVersion);
        } else {
          setError("No updates available for this platform");
        }
      } catch (err: any) {
        console.error("Error fetching app updates:", err);
        setError(err.message || "Failed to fetch updates");
      } finally {
        setLoading(false);
      }
    };
    
    fetchLatestVersion();
  }, [platform]);

  // Format bytes to human readable size
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">CloudBliss Desktop Downloads</h1>
      
      <div className="flex space-x-2 mb-6">
        <Button 
          variant={platform === 'windows' ? 'default' : 'outline'} 
          size="sm"
          onClick={() => window.location.href = '/app/updates?platform=windows'}
        >
          Windows
        </Button>
        <Button 
          variant={platform === 'macos' ? 'default' : 'outline'} 
          size="sm"
          onClick={() => window.location.href = '/app/updates?platform=macos'}
        >
          macOS
        </Button>
        <Button 
          variant={platform === 'linux' ? 'default' : 'outline'} 
          size="sm"
          onClick={() => window.location.href = '/app/updates?platform=linux'}
        >
          Linux
        </Button>
      </div>
      
      {loading ? (
        <Card>
          <CardContent className="py-6">
            <div className="flex items-center justify-center">
              <Clock className="animate-spin h-8 w-8 text-primary mr-2" />
              <p>Loading latest version information...</p>
            </div>
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="py-6">
            <div className="text-center">
              <p className="text-destructive mb-2">{error}</p>
              <p className="text-muted-foreground">
                Desktop application may not be available for this platform yet.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : latestVersion ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>CloudBliss for {platform}</CardTitle>
              {latestVersion.is_mandatory && (
                <Badge variant="destructive">Mandatory Update</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="h-16 w-16 bg-primary/10 rounded-lg flex items-center justify-center">
                <Package className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Version {latestVersion.version}</h3>
                <p className="text-sm text-muted-foreground">
                  Released on {formatDate(latestVersion.release_date)} • {formatBytes(latestVersion.size)}
                </p>
              </div>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">What's New</h4>
              <div className="bg-muted/50 p-4 rounded-lg">
                <pre className="whitespace-pre-wrap text-sm">{latestVersion.changelog}</pre>
              </div>
            </div>
          </CardContent>
          <CardFooter className="border-t pt-4 flex justify-between">
            <div className="text-sm text-muted-foreground flex items-center">
              <Check className="h-4 w-4 mr-1 text-green-500" />
              Secured download
            </div>
            <Button asChild>
              <a href={latestVersion.download_url} download>
                <Download className="mr-2 h-4 w-4" />
                Download
              </a>
            </Button>
          </CardFooter>
        </Card>
      ) : null}
      
      <div className="mt-8 text-center text-sm text-muted-foreground">
        <p>
          CloudBliss desktop applications provide native integration with your operating system,
          including offline access to your files and enhanced security features.
        </p>
      </div>
    </div>
  );
};

export default AppUpdatePage;
