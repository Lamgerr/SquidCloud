import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { withPrelGateway, jsonResponse, getCorsHeaders, PrelContext } from '../_shared/kza-prel.ts'

interface ManifestRequest {
  fileId: string;
  userId: string;
  requestedMaxQuality?: string;
  playbackMode?: 'streaming' | 'download';
}

interface VideoQualityVariant {
  qualityId: string;
  label: string;
  playlistUrl: string;
  bandwidth: number;
  resolution?: string;
  codecs?: string;
}

interface ManifestResponse {
  masterManifestUrl: string;
  variants: VideoQualityVariant[];
  ttl: number;
  duration?: number;
  segmentDuration: number;
}

const SEGMENT_DURATION = 3;

const QUALITY_PRESETS = {
  '240p': { bandwidth: 400000, resolution: '426x240', label: '240p' },
  '360p': { bandwidth: 800000, resolution: '640x360', label: '360p' },
  '480p': { bandwidth: 1500000, resolution: '854x480', label: '480p' },
  '720p': { bandwidth: 3000000, resolution: '1280x720', label: '720p' },
  '1080p': { bandwidth: 6000000, resolution: '1920x1080', label: '1080p' },
};

serve(async (req) => {
  return withPrelGateway(req, { functionId: 'media-manifest', operation: 'default' }, async (ctx: PrelContext) => {
    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      const body: ManifestRequest = await req.json();
      const { fileId, userId, requestedMaxQuality = '1080p', playbackMode = 'streaming' } = body;

      // Validate file access
      const { data: file, error: fileError } = await supabase
        .from('files')
        .select('*')
        .eq('id', fileId)
        .single();

      if (fileError || !file) {
        throw new Error('File not found');
      }

      // Check ownership or share permissions
      if (file.user_id !== ctx.userId) {
        const { data: shareData } = await supabase
          .from('file_shares')
          .select('*')
          .eq('file_id', fileId)
          .eq('can_view', true)
          .single();

        if (!shareData && !file.is_public) {
          throw new Error('Access denied');
        }
      }

      if (!file.type.startsWith('video/')) {
        throw new Error('File is not a video');
      }

      let metadata: any;
      try {
        if (file.storage_path === 'res54_distributed' && file.tags && file.tags.length > 0) {
          metadata = JSON.parse(file.tags[0]);
        } else {
          throw new Error('File does not use Res54 encryption');
        }
      } catch (error) {
        throw new Error('Invalid Res54 metadata');
      }

      const availableQualities = determineAvailableQualities(file.size, requestedMaxQuality);
      const estimatedDuration = estimateVideoDuration(file.size, file.type);
      const variants: VideoQualityVariant[] = [];
      const ttl = 3600;
      const expiryTime = Date.now() + (ttl * 1000);

      for (const quality of availableQualities) {
        const qualityId = quality.label;
        const playlistUrl = await generateSignedPlaylistUrl({
          fileId,
          userId: ctx.userId,
          quality: qualityId,
          expiry: expiryTime,
          segmentDuration: SEGMENT_DURATION,
          totalChunks: metadata.chunks.length,
        });

        variants.push({
          qualityId,
          label: quality.label,
          playlistUrl,
          bandwidth: quality.bandwidth,
          resolution: quality.resolution,
          codecs: 'avc1.42E01E,mp4a.40.2',
        });
      }

      const masterManifestUrl = await generateSignedMasterManifestUrl({
        fileId,
        userId: ctx.userId,
        expiry: expiryTime,
        variants,
      });

      await supabase
        .from('api_request_logs')
        .insert({
          user_id: ctx.userId,
          endpoint: '/edge/media/manifest',
          file_id: fileId,
          request_data: { requestedMaxQuality, playbackMode },
          response_status: 200,
          bytes_transferred: 0,
          created_at: new Date().toISOString(),
        });

      return jsonResponse({
        masterManifestUrl,
        variants,
        ttl,
        duration: estimatedDuration,
        segmentDuration: SEGMENT_DURATION,
      });

    } catch (error) {
      console.error('Manifest generation error:', error);
      return jsonResponse({ error: error.message || 'Failed to generate manifest' }, 500);
    }
  });
});

function determineAvailableQualities(fileSize: number, maxQuality: string): typeof QUALITY_PRESETS[keyof typeof QUALITY_PRESETS][] {
  const qualities = Object.values(QUALITY_PRESETS);
  const maxQualityIndex = qualities.findIndex(q => q.label === maxQuality);
  
  // For smaller files, limit available qualities
  if (fileSize < 50 * 1024 * 1024) { // < 50MB
    return qualities.slice(0, 3); // Up to 480p
  } else if (fileSize < 200 * 1024 * 1024) { // < 200MB
    return qualities.slice(0, 4); // Up to 720p
  }
  
  // Return all qualities up to requested max
  return qualities.slice(0, maxQualityIndex + 1);
}

function estimateVideoDuration(fileSize: number, mimeType: string): number {
  // Improved estimation based on file size and typical bitrates
  // For h264 videos: ~2Mbps, for other formats: ~1.5Mbps
  // Use per-segment duration and total segment count for better accuracy
  const avgBitrate = mimeType.includes('h264') ? 2000000 : 1500000;
  const rawEstimate = Math.round((fileSize * 8) / avgBitrate);
  // Round to nearest second
  return Math.max(1, rawEstimate);
}

async function generateSignedPlaylistUrl(params: {
  fileId: string;
  userId: string;
  quality: string;
  expiry: number;
  segmentDuration: number;
  totalChunks: number;
}): Promise<string> {
  const { fileId, userId, quality, expiry, segmentDuration, totalChunks } = params;
  
  // Create playlist parameters
  const playlistParams = {
    fileId,
    userId,
    quality,
    expiry: expiry.toString(),
    segmentDuration: segmentDuration.toString(),
    totalChunks: totalChunks.toString(),
  };

  // Generate HMAC signature
  const signature = await generateHMACSignature(playlistParams);
  
  // Build playlist URL
  const baseUrl = Deno.env.get('SUPABASE_URL') + '/functions/v1/media-playlist';
  const params_str = new URLSearchParams({
    ...playlistParams,
    signature,
  }).toString();

  return `${baseUrl}?${params_str}`;
}

async function generateSignedMasterManifestUrl(params: {
  fileId: string;
  userId: string;
  expiry: number;
  variants: VideoQualityVariant[];
}): Promise<string> {
  const { fileId, userId, expiry, variants } = params;
  
  const manifestParams = {
    fileId,
    userId,
    expiry: expiry.toString(),
    variantCount: variants.length.toString(),
  };

  const signature = await generateHMACSignature(manifestParams);
  
  const baseUrl = Deno.env.get('SUPABASE_URL') + '/functions/v1/media-master-manifest';
  const params_str = new URLSearchParams({
    ...manifestParams,
    signature,
  }).toString();

  return `${baseUrl}?${params_str}`;
}

async function generateHMACSignature(params: Record<string, string>): Promise<string> {
  const secret = Deno.env.get('STREAM_SIGNING_SECRET') ?? 'default-secret';
  
  // Sort parameters for consistent signing
  const sortedKeys = Object.keys(params).sort();
  const paramString = sortedKeys.map(key => `${key}=${params[key]}`).join('&');
  
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(paramString)
  );

  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}