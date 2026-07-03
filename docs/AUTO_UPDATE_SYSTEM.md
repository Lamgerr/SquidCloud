# SquidCloud Auto-Update System

This system ensures users automatically receive updates without manually clearing their cache.

## How It Works

### 1. **Version Management**
- Automatic version bumping on each deployment
- Timestamp-based cache busting
- Service worker cache name updates

### 2. **Cache Busting Strategies**
- **Service Worker**: Dynamic cache names with timestamps
- **Static Assets**: Cache-busted URLs with version parameters
- **API Requests**: No-cache headers and timestamp parameters
- **Version Checking**: Regular polling for updates

### 3. **Update Detection**
- Checks for updates every 2 minutes
- Checks when user returns to the app (visibility change)
- Checks when app regains focus
- Service worker update notifications

## Deployment Process

### Automatic (Recommended)
```bash
# Run before pushing to trigger deployment
./scripts/deploy.sh
```

### Manual
```bash
# Update version and cache-busting info
node scripts/update-version.js

# Build (if needed)
npm run build

# Deploy to Vercel
git add . && git commit -m "Version bump" && git push
```

## Key Files

- **`scripts/update-version.js`**: Updates version, timestamp, and service worker
- **`scripts/deploy.sh`**: Complete deployment preparation script
- **`public/service-worker.js`**: Enhanced with cache busting and update handling
- **`src/components/VersionChecker.tsx`**: Client-side update detection
- **`src/utils/cacheManager.ts`**: Cache management utilities
- **`public/version.json`**: Version and timestamp information
- **`vercel.json`**: Proper cache headers configuration

## Cache Headers Configuration

### No Cache (Always Fresh)
- `index.html`
- `version.json`
- `service-worker.js`

### Long Cache (Immutable)
- `/assets/*` (1 year cache with immutable flag)

### API Cache
- Short-lived cache for API responses (5 minutes)
- Network-first strategy

## User Experience

1. **Silent Updates**: Users get updates automatically without interruption
2. **Background Checking**: App checks for updates periodically
3. **Visual Feedback**: Toast notifications when updates are applied
4. **Fallback**: Manual refresh still works if automatic update fails

## Troubleshooting

### Force Update
```javascript
// In browser console
window.location.href = window.location.href + '?cache_bust=' + Date.now()
```

### Clear All Caches
```javascript
// In browser console
caches.keys().then(names => Promise.all(names.map(name => caches.delete(name))))
```

### Check Version
```javascript
// In browser console
fetch('/version.json?t=' + Date.now()).then(r => r.json()).then(console.log)
```

## Development

For development, the auto-update system is less aggressive to avoid interrupting work:
- Version checking interval is longer
- No automatic reloads during development

## Production Deployment

The system is optimized for production with:
- Aggressive cache busting
- Immediate update application
- Comprehensive fallback strategies
- Performance-optimized asset caching