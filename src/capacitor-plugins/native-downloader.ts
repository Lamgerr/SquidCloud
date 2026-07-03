import { registerPlugin } from '@capacitor/core';

export interface NativeDownloaderPlugin {
  enqueueDownload(options: {
    base64Data: string;
    filename: string;
    mimeType?: string;
  }): Promise<{
    downloadId: number;
    destination: string;
    uri?: string;
  }>;
  canRequestPackageInstalls(): Promise<{
    allowed: boolean;
  }>;
  openInstallPermissionSettings(): Promise<{
    opened: boolean;
  }>;
  downloadApkFromUrl(options: {
    url: string;
    filename?: string;
  }): Promise<{
    apkPath: string;
    uri: string;
  }>;
  verifyAndInstallApk(options: {
    apkPath: string;
  }): Promise<{
    verified: boolean;
    installIntentStarted: boolean;
  }>;
}

const NativeDownloader = registerPlugin<NativeDownloaderPlugin>('NativeDownloader');

export default NativeDownloader;
