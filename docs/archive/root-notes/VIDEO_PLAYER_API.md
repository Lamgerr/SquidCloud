# SquidCloud Secure Video Player API Documentation

## Overview

The SquidCloud Secure Video Player provides Netflix-like video streaming capabilities with advanced security features, adaptive bitrate streaming, and comprehensive analytics. All video content is encrypted using the Res54 encryption system and streamed securely through signed URLs.

## Table of Contents

1. [Authentication](#authentication)
2. [Video Streaming Endpoints](#video-streaming-endpoints)
3. [Video Analytics](#video-analytics)
4. [HLS Generation](#hls-generation)
5. [Error Codes](#error-codes)
6. [SDK Usage](#sdk-usage)

## Authentication

All API endpoints require valid JWT authentication. Include the JWT token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

## Video Streaming Endpoints

### 1. Generate Signed Stream URL

**Endpoint:** `POST /functions/v1/video-stream-url`

Generates signed URLs for secure video streaming with adaptive bitrate support.

**Request Body:**
```json
{
  "fileId": "uuid",
  "requestedQualities": ["auto", "1080p", "720p", "480p", "360p"],
  "requesterUserId": "uuid",
  "playbackMode": "stream"
}
```

**Parameters:**
- `fileId` (required): UUID of the video file
- `requestedQualities` (optional): Array of quality labels to generate
- `requesterUserId` (required): UUID of the requesting user
- `playbackMode` (required): "stream" or "download"

**Response:**
```json
{
  "url": "https://example.com/stream/signed-url",
  "ttl_seconds": 3600,
  "qualities": [
    {
      "id": "auto",
      "label": "Auto",
      "bandwidth": 0,
      "url": "https://example.com/stream/auto?signature=..."
    },
    {
      "id": "1080p",
      "label": "1080p",
      "bandwidth": 5000000,
      "url": "https://example.com/stream/1080p?signature=...",
      "height": 1080,
      "width": 1920
    }
  ],
  "hlsManifest": "#EXTM3U\n#EXT-X-VERSION:3\n...",
  "sessionId": "uuid"
}
```

**Status Codes:**
- `200`: Success
- `403`: Access denied
- `404`: File not found
- `500`: Internal server error

### 2. Stream Proxy

**Endpoint:** `GET /functions/v1/video-stream-proxy/{quality}`

Serves decrypted video chunks with range request support.

**Query Parameters:**
- `fileId` (required): UUID of the video file
- `quality` (required): Quality identifier (auto, 1080p, 720p, etc.)
- `userId` (required): UUID of the requesting user
- `sessionId` (required): Session ID from stream URL generation
- `expiry` (required): Unix timestamp of URL expiry
- `signature` (required): HMAC signature for validation

**Headers:**
- `Range` (optional): HTTP range header for partial content requests

**Response:**
- Content-Type: Video MIME type
- Accept-Ranges: bytes
- Content-Range: bytes (for range requests)
- Content-Length: Size of response
- Cache-Control: public, max-age=3600

**Status Codes:**
- `200`: Full content
- `206`: Partial content (range request)
- `401`: Invalid signature
- `403`: Access denied
- `404`: File not found
- `410`: Stream URL expired

## Video Analytics

### 1. Playback Events

Automatically logged through the video player analytics hooks:

**Event Types:**
- `play`: Video playback started
- `pause`: Video playback paused
- `seek`: User seeked to different position
- `quality_change`: Video quality changed
- `speed_change`: Playback speed changed
- `buffer_start`: Buffering started
- `buffer_end`: Buffering ended
- `complete`: Video completed playback
- `error`: Playback error occurred

**Event Data:**
```json
{
  "user_id": "uuid",
  "file_id": "uuid",
  "session_id": "uuid",
  "event_type": "play",
  "position": 123.45,
  "timestamp": "2024-03-16T10:30:00Z",
  "metadata": {
    "quality": "720p",
    "bandwidth": 3000000,
    "error_message": "Network error"
  }
}
```

### 2. Resume Position

**Function:** `update_playback_resume(file_id, position, duration)`

Saves user's last watched position for video resumption.

**Function:** `get_playback_resume(file_id)`

Retrieves saved resume position for a video.

### 3. Analytics Dashboard

**View:** `video_analytics_summary`

Provides aggregated analytics for video files:

```sql
SELECT * FROM video_analytics_summary WHERE file_id = 'uuid';
```

**Returns:**
- `total_sessions`: Number of unique viewing sessions
- `unique_viewers`: Number of unique users who watched
- `avg_watch_time`: Average watch duration
- `total_bandwidth`: Total bandwidth consumed
- `completion_count`: Number of complete views
- `error_count`: Number of playback errors
- `last_viewed`: Most recent view timestamp

## HLS Generation

### 1. Queue Transcoding Job

**Endpoint:** `POST /functions/v1/hls-generation`

Queues a video file for HLS transcoding and adaptive bitrate generation.

**Request Body:**
```json
{
  "fileId": "uuid",
  "userId": "uuid",
  "outputQualities": ["360p", "720p", "1080p"],
  "priority": "normal"
}
```

**Response:**
```json
{
  "message": "Transcoding job created successfully",
  "jobId": "uuid",
  "status": "queued",
  "estimatedTime": 5
}
```

### 2. Check Transcoding Status

**Function:** `get_transcode_job_status(file_id)`

Returns current status of transcoding job:

```json
{
  "job_id": "uuid",
  "status": "processing",
  "progress": 45,
  "output_qualities": ["360p", "720p", "1080p"],
  "estimated_time": 5,
  "created_at": "2024-03-16T10:30:00Z"
}
```

### 3. Get Available HLS Files

**Function:** `get_hls_files(file_id)`

Returns available HLS renditions for a video:

```json
[
  {
    "quality": "1080p",
    "manifest_path": "playlists/1080p/playlist.m3u8",
    "file_size": 524288000,
    "duration": 120.5,
    "bandwidth": 5000000,
    "resolution": "1920x1080"
  }
]
```

## Error Codes

### HTTP Status Codes

- `200`: Success
- `201`: Created
- `206`: Partial Content
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `410`: Gone (Expired)
- `500`: Internal Server Error

### Custom Error Codes

- `STREAM_URL_ERROR`: Failed to generate streaming URL
- `STREAM_PROXY_ERROR`: Failed to proxy stream content
- `HLS_GENERATION_ERROR`: Failed to queue HLS generation
- `DECRYPT_FAILED`: Res54 decryption failed
- `INTEGRITY_FAILED`: File integrity check failed
- `INVALID_SIGNATURE`: URL signature validation failed

### Error Response Format

```json
{
  "error": "Human readable error message",
  "code": "ERROR_CODE",
  "details": {
    "additional": "context"
  }
}
```

## SDK Usage

### React Component Integration

```tsx
import cbVideoPlayer from '@/components/cbVideoPlayer';
import { useVideoAnalytics, useVideoStreaming } from '@/hooks/useVideoAnalytics';

function VideoPreview({ file }) {
  const analytics = useVideoAnalytics({
    fileId: file.id,
    autoSaveInterval: 30,
    enableQualityMetrics: true,
  });

  const { streamingData, isLoading, error } = useVideoStreaming({
    fileId: file.id,
    requestedQualities: ['auto', '1080p', '720p', '480p'],
    playbackMode: 'stream',
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <cbVideoPlayer
      file={file}
      src={streamingData.hlsManifest ? 
        { master: streamingData.url, qualities: streamingData.qualities } : 
        streamingData.url
      }
      analytics={analytics}
      onDownload={() => handleDownload()}
      onShare={() => handleShare()}
    />
  );
}
```

### Direct API Usage

```typescript
import { VideoStreamingService, VideoAnalyticsService } from '@/services/VideoAnalyticsService';

// Get streaming URLs
const streamingData = await VideoStreamingService.getStreamingUrls(
  fileId, 
  ['720p', '480p'], 
  'stream'
);

// Initialize analytics session
const sessionId = await VideoAnalyticsService.initializeSession(fileId);

// Log playback events
await VideoAnalyticsService.logEvent(fileId, 'play', 0);
await VideoAnalyticsService.logEvent(fileId, 'pause', 123.45);

// Save resume position
await VideoAnalyticsService.saveResumePosition(fileId, 123.45, 300);

// Get resume position
const resumeData = await VideoAnalyticsService.getResumePosition(fileId);
```

## Security Considerations

### URL Signing

All streaming URLs are signed with HMAC-SHA256 using a server-side secret. URLs expire after the specified TTL (default 1 hour).

### Access Control

- Users can only access videos they own or have been explicitly shared with
- All database operations use Row Level Security (RLS)
- Res54 encryption ensures content is never stored unencrypted

### Rate Limiting

- Implement rate limiting on streaming endpoints
- Monitor bandwidth usage per user/session
- Automatic quality degradation under high load

### Data Privacy

- Analytics data is user-scoped and private
- Personal viewing data is never shared between users
- Configurable data retention policies

## Performance Optimization

### CDN Integration

- Cache HLS manifests and segments at CDN edge
- Use appropriate cache headers for different content types
- Implement cache invalidation for updated content

### Adaptive Streaming

- Automatic quality switching based on bandwidth
- Buffer-aware quality selection
- Smooth quality transitions without rebuffering

### Monitoring

- Real-time playback quality metrics
- Error tracking and alerting
- Bandwidth and performance analytics

## Future Enhancements

### Planned Features

- Live streaming support
- Multi-angle video support
- Advanced caption/subtitle handling
- AI-powered content analysis
- Enhanced mobile optimization
- Offline playback capabilities

### API Versioning

Current API version: v1
- Backward compatibility maintained for 12 months
- New features added to latest version
- Deprecation notices provided 6 months in advance