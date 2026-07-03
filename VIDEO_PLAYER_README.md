# SquidCloud Secure Video Player System

## 🎥 Overview

The SquidCloud Secure Video Player is a comprehensive Netflix-like video streaming solution built for the SquidCloud storage platform. It provides secure, encrypted video streaming with adaptive bitrate support, comprehensive analytics, and a beautiful user interface that matches the SquidCloud design system.

## ✨ Key Features

### 🔒 Security First
- **Res54 Encryption**: All videos encrypted at rest and in transit
- **Signed URLs**: Time-limited, cryptographically signed streaming URLs
- **Access Control**: User-based permissions and sharing controls
- **No Data Leakage**: Encrypted chunks ensure no unencrypted data exposure

### 🎬 Advanced Video Player
- **Netflix-Style UI**: Clean, modern interface with glass morphism effects
- **Adaptive Streaming**: HLS support with automatic quality switching
- **Multiple Qualities**: 360p, 480p, 720p, 1080p, and Auto modes
- **Picture-in-Picture**: Native PiP support where available
- **Keyboard Shortcuts**: Full keyboard navigation support
- **Mobile Optimized**: Touch-friendly controls and responsive design

### 📊 Comprehensive Analytics
- **Playback Tracking**: Real-time event logging and analysis
- **Quality Metrics**: Buffer health, bitrate monitoring, error tracking
- **Resume Positions**: Automatic playback resumption
- **Usage Analytics**: Watch time, completion rates, bandwidth usage
- **Real-time Dashboard**: Live analytics and performance monitoring

### 🚀 Performance Optimized
- **Chunked Streaming**: Progressive loading and memory efficiency
- **CDN Ready**: Optimized for content delivery networks
- **Range Requests**: HTTP range support for efficient seeking
- **Background Transcoding**: Automatic HLS generation pipeline
- **Smart Buffering**: Intelligent prefetching and buffer management

## 🏗️ Architecture

### Frontend Components

```
src/components/
├── cbVideoPlayer.tsx           # Main video player component
├── EnhancedInstantPreviewModal.tsx # Modal integration
└── ui/                        # Shared UI components

src/hooks/
├── useVideoAnalytics.ts       # Analytics and resume hooks
└── useVideoStreaming.ts       # Streaming URL management

src/services/
└── VideoAnalyticsService.ts   # Analytics and streaming services

src/lib/
└── res54.ts                   # Extended with video streaming support
```

### Backend Services

```
supabase/functions/
├── video-stream-url/          # Signed URL generation
├── video-stream-proxy/        # Decryption and streaming proxy
└── hls-generation/           # Background transcoding service

supabase/migrations/
├── video_analytics_schema.sql     # Analytics database schema
└── video_transcoding_schema.sql   # Transcoding job management
```

### Database Schema

- **media_playback_logs**: Detailed playback event tracking
- **playback_resume**: User resume positions
- **video_stream_sessions**: Session management and bandwidth tracking
- **video_quality_metrics**: Performance and quality monitoring
- **transcode_jobs**: HLS generation job queue
- **hls_files**: Generated HLS file metadata

## 🚀 Quick Start

### 1. Installation

```bash
# Install dependencies
npm install hls.js

# Run database migrations
supabase db reset

# Deploy edge functions
supabase functions deploy video-stream-url
supabase functions deploy video-stream-proxy
supabase functions deploy hls-generation
```

### 2. Environment Setup

```bash
# Required environment variables
STREAM_SIGNING_SECRET=your-secure-secret-key
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key
```

### 3. Basic Usage

```tsx
import cbVideoPlayer from '@/components/cbVideoPlayer';
import { useVideoAnalytics, useVideoStreaming } from '@/hooks/useVideoAnalytics';

function VideoComponent({ file }) {
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

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <cbVideoPlayer
      file={file}
      src={streamingData}
      analytics={analytics}
      onDownload={handleDownload}
      onShare={handleShare}
    />
  );
}
```

## 🎮 Controls & Features

### Keyboard Shortcuts
- `Space` - Play/Pause
- `←/→` - Seek -5/+5 seconds
- `↑/↓` - Volume up/down
- `F` - Toggle fullscreen
- `M` - Toggle mute
- `P` - Picture-in-Picture

### Player Controls
- **Play/Pause Button**: Large center button and control bar
- **Timeline Scrubber**: Precise seeking with preview thumbnails
- **Volume Control**: Slider with mute toggle
- **Quality Selector**: Manual quality override
- **Speed Control**: 0.5x to 2x playback speeds
- **Skip Buttons**: -10s and +10s quick navigation
- **Fullscreen Toggle**: Maximize viewing experience
- **More Options**: Download, share, and advanced settings

### Mobile Features
- **Touch Controls**: Tap to show/hide controls
- **Gesture Support**: Optional swipe navigation
- **Native Fullscreen**: Platform-specific fullscreen experience
- **PiP Support**: Background playback on supported devices

## 📈 Analytics Dashboard

### Real-time Metrics
- Current viewers and sessions
- Bandwidth usage and quality distribution
- Error rates and buffering events
- Geographic viewing patterns

### Historical Analytics
- Watch time trends and completion rates
- Popular content and quality preferences
- User engagement and retention metrics
- Performance optimization insights

### Custom Events
```typescript
// Log custom analytics events
await VideoAnalyticsService.logEvent(fileId, 'custom_event', position, {
  custom_data: 'value',
  user_action: 'button_click'
});

// Track quality metrics
await VideoAnalyticsService.recordQualityMetrics({
  quality: '720p',
  bandwidth: 3000000,
  bufferLevel: 5.2,
  droppedFrames: 0
});
```

## 🔧 Configuration

### Video Player Options

```typescript
interface cbVideoPlayerProps {
  file: FileMetadata;
  src: string | HLSSource;
  poster?: string;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  audioTracks?: AudioTrack[];
  captions?: Caption[];
  analytics?: VideoAnalyticsHook;
  onDownload?: () => void;
  onShare?: () => void;
  resumePosition?: number;
  className?: string;
}
```

### Analytics Configuration

```typescript
const analytics = useVideoAnalytics({
  fileId: 'video-uuid',
  autoSaveInterval: 30, // Save resume position every 30 seconds
  enableQualityMetrics: true, // Track detailed quality metrics
});
```

### Streaming Configuration

```typescript
const streaming = useVideoStreaming({
  fileId: 'video-uuid',
  requestedQualities: ['auto', '1080p', '720p', '480p'],
  playbackMode: 'stream', // or 'download'
});
```

## 🎨 Theming & Customization

### SquidCloud Theme Integration

The video player automatically inherits the SquidCloud design system:

- **Cocoa/ForgeBerry Colors**: Matches current theme selection
- **Glass Morphism**: Translucent controls with backdrop blur
- **Liquid Glass Effects**: Smooth animations and transitions
- **Responsive Design**: Adapts to all screen sizes

### Custom Styling

```css
.cb-video-player {
  /* Custom player styling */
  --player-accent-color: var(--primary);
  --player-control-bg: rgba(0, 0, 0, 0.8);
  --player-glass-blur: blur(10px);
}
```

## 🔒 Security Implementation

### Res54 Integration

The video player extends the existing Res54 encryption system:

```typescript
// Stream encrypted video chunks
const stream = await streamFileWithRes54(fileId, onChunk, onProgress);

// Range-based decryption for seeking
const rangeData = await downloadFileRangeWithRes54(fileId, start, end);

// Create secure blob URLs
const videoUrl = await createVideoStreamUrl(fileId);
```

### Signed URL Generation

```typescript
// Server-side URL signing
const signedUrl = await signUrlParams({
  fileId: 'uuid',
  quality: '720p',
  userId: 'uuid',
  sessionId: 'uuid',
  expiry: Date.now() + 3600 // 1 hour TTL
});
```

## 📱 Mobile Support

### iOS Optimizations
- Native video controls integration
- AirPlay support
- Picture-in-Picture
- Background audio playback
- Optimized touch handling

### Android Optimizations
- Chrome custom video controls
- Hardware acceleration
- Full-screen gesture navigation
- Adaptive quality based on network

## 🚀 Performance Monitoring

### Key Metrics
- **Startup Time**: Time to first frame
- **Rebuffer Rate**: Frequency of buffering events
- **Quality Switches**: Adaptive bitrate efficiency
- **Error Rate**: Playback failure percentage
- **Bandwidth Efficiency**: Data usage optimization

### Monitoring Setup

```typescript
// Enable performance monitoring
const analytics = useVideoAnalytics({
  fileId: file.id,
  enableQualityMetrics: true,
});

// Custom performance tracking
analytics.recordQualityMetrics({
  quality: '720p',
  bandwidth: 3000000,
  bufferLevel: 5.2,
  startupTime: 2.1,
  droppedFrames: 0
});
```

## 🛠️ Development & Testing

### Local Development

```bash
# Start development server
npm run dev

# Run Supabase locally
supabase start

# Deploy functions locally
supabase functions serve
```

### Testing

```bash
# Run component tests
npm test

# Test video streaming
npm run test:streaming

# Load testing
npm run test:load
```

### Debug Mode

Enable debug overlays and verbose logging:

```typescript
<cbVideoPlayer
  // ... other props
  debug={true}
  onMetrics={(metrics) => console.log(metrics)}
/>
```

## 📋 Troubleshooting

### Common Issues

**Video Won't Play**
- Check file encryption and Res54 compatibility
- Verify user permissions and file access
- Ensure network connectivity for chunk downloads

**Poor Quality/Buffering**
- Monitor bandwidth and connection quality
- Check HLS transcoding status
- Verify CDN configuration

**Analytics Not Working**
- Verify database permissions and RLS policies
- Check authentication tokens
- Monitor edge function logs

### Debug Tools

```typescript
// Enable detailed logging
VideoAnalyticsService.setLogLevel('debug');

// Check streaming status
const status = await VideoStreamingService.getStreamingStatus(fileId);

// Validate file support
const isSupported = VideoStreamingService.isVideoFile(file);
```

## 🚀 Deployment

### Production Checklist

- [ ] Configure secure STREAM_SIGNING_SECRET
- [ ] Set up CDN for HLS content delivery
- [ ] Enable analytics data retention policies
- [ ] Configure monitoring and alerting
- [ ] Test cross-browser compatibility
- [ ] Verify mobile device support
- [ ] Set up error tracking and reporting

### Scaling Considerations

- **CDN Integration**: Cache HLS segments globally
- **Worker Scaling**: Auto-scale transcoding workers
- **Database Optimization**: Index analytics tables
- **Monitoring**: Real-time performance tracking

## 📚 API Reference

See [VIDEO_PLAYER_API.md](./VIDEO_PLAYER_API.md) for complete API documentation.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## 📄 License

This video player system is part of the SquidCloud storage platform and follows the same licensing terms.

## 🎯 Roadmap

### Upcoming Features
- [ ] Live streaming support
- [ ] Advanced caption handling
- [ ] Multi-angle video support
- [ ] AI-powered content analysis
- [ ] Enhanced offline capabilities
- [ ] WebRTC peer-to-peer streaming
- [ ] Advanced DRM integration
- [ ] 360° video support

### Performance Improvements
- [ ] WebAssembly decryption
- [ ] Service Worker caching
- [ ] Progressive Web App features
- [ ] Advanced prefetching algorithms

---

Built with ❤️ for the SquidCloud ecosystem