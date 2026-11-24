# 🎨 Preview Modal - Quick Visual Reference

## 📐 Layout Structure

```
┌─────────────────────────────────────────────────────────────┐
│ ╔═══════════════════════════════════════════════════════╗ │
│ ║  🎨 GLASSMORPHIC HEADER (backdrop-blur-xl)           ║ │
│ ║                                                       ║ │
│ ║  [📄] Document.pdf                          [ℹ️] [⬇️] [🔗] [❌] │
│ ║  ├─ PDF │ 2.4 MB │ 🔒 Encrypted                    ║ │
│ ║                                                       ║ │
│ ║  ┌─────────────────────────────────────────────────┐ ║ │
│ ║  │ 📊 FILE INFORMATION (collapsible)               │ ║ │
│ ║  │ Size: 2.4 MB        Type: application/pdf       │ ║ │
│ ║  │ Modified: 11/12/25  Created: 11/11/25           │ ║ │
│ ║  │ File ID: abc123...                              │ ║ │
│ ║  └─────────────────────────────────────────────────┘ ║ │
│ ╚═══════════════════════════════════════════════════════╝ │
│                                                             │
│ ┌───────────────────────────────────────────────────────┐ │
│ │                                                       │ │
│ │              📄 FILE PREVIEW CONTENT                  │ │
│ │                                                       │ │
│ │         (Images, Videos, PDFs, Text, etc.)           │ │
│ │                                                       │ │
│ │                                                       │ │
│ └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 🎯 Key Features

### Header Components

```
┌─────────────────────────────────────────────────────────┐
│ [Icon] Filename                    [Info] [DL] [Share] [X] │
│        ├─ Type │ Size │ Status                            │
└─────────────────────────────────────────────────────────┘
```

**File Type Icons:**
- 📄 Text files
- 🖼️ Images
- 🎥 Videos
- 🎵 Audio
- 📊 Spreadsheets
- 📑 PDFs

**Status Badges:**
- `Type` - File category (e.g., "PDF", "Image", "Video")
- `Size` - Formatted size (e.g., "2.4 MB", "156 KB")
- `🔒 Encrypted` - Shows when file is encrypted

### Action Buttons

| Button | Icon | Keyboard | Tooltip |
|--------|------|----------|---------|
| Info | ℹ️ | `I` | File Information |
| Download | ⬇️ | `Ctrl+D` | Download file |
| Share | 🔗 | `Ctrl+S` | Share file link |
| Close | ❌ | `Esc` | Close modal |

## 🎨 Visual States

### 1. Loading State
```
┌─────────────────────────────────┐
│                                 │
│        ⏳ [Large Loader]        │
│                                 │
│      Decrypting file...         │
│ This may take a moment for      │
│        large files              │
│                                 │
└─────────────────────────────────┘
```

### 2. Error State
```
┌─────────────────────────────────┐
│                                 │
│        🔴 [Alert Circle]        │
│                                 │
│     Unable to Load File         │
│  Network error while            │
│  downloading file               │
│                                 │
│     [🔄 Try Again]              │
│                                 │
└─────────────────────────────────┘
```

### 3. Info Panel (Collapsed)
```
[Icon] Document.pdf              [ℹ️] [⬇️] [🔗] [❌]
       ├─ PDF │ 2.4 MB │ 🔒 Encrypted
```

### 4. Info Panel (Expanded)
```
[Icon] Document.pdf              [ℹ️] [⬇️] [🔗] [❌]
       ├─ PDF │ 2.4 MB │ 🔒 Encrypted
       
┌────────────────────────────────────────────┐
│ 📊 FILE INFORMATION                        │
│                                            │
│ Size: 2.4 MB          Type: application/pdf│
│ Modified: 11/12/25    Created: 11/11/25   │
│ File ID: `abc123...`                       │
└────────────────────────────────────────────┘
```

## 🎭 Animations

### Entrance
- **Modal**: Zoom in + Fade in (300ms)
- **Backdrop**: Fade in with blur
- **Content**: Fade in (500ms)

### Info Panel
- **Expand**: Slide down + Fade in (300ms)
- **Collapse**: Slide up + Fade out (300ms)

### Interactions
- **Buttons**: Hover scale (subtle)
- **Tooltips**: Fade in (150ms)

## 🎨 Color Palette

### Backgrounds
```css
Header:    gradient + backdrop-blur-xl
Backdrop:  bg-black/60 + backdrop-blur-sm
Content:   bg-background/50
Info Panel: bg-muted/50 + border
```

### Badges
```css
Type Badge:       bg-secondary
Size Badge:       bg-outline
Encrypted Badge:  bg-green-500/10 (text-green-700)
```

### Buttons
```css
Default:      hover:bg-primary/10
Destructive:  hover:bg-destructive/10 + hover:text-destructive
Active:       bg-primary/20
```

## ⌨️ Keyboard Shortcuts Reference

```
┌──────────────────────────────────────────┐
│  Keyboard Shortcuts                      │
├──────────────────────────────────────────┤
│  Esc          Close modal                │
│  Ctrl+D       Download file              │
│  Ctrl+S       Share file                 │
│  I            Toggle file info           │
└──────────────────────────────────────────┘
```

## 📱 Responsive Behavior

### Desktop (≥768px)
- Full button text visible
- 2-column info grid
- Larger spacing
- Keyboard shortcuts enabled

### Mobile (<768px)
- Icon-only buttons (text hidden)
- Single column info grid
- Compact spacing
- Touch-optimized targets

## 🎯 File Type Specific Views

### Image Preview
```
┌─────────────────────────────────┐
│ [🖼️] photo.jpg     [ℹ️] [⬇️] [🔗] [❌] │
│      ├─ Image │ 3.2 MB          │
├─────────────────────────────────┤
│                                 │
│      [Advanced Image Viewer]    │
│      - Zoom controls            │
│      - Pan support              │
│      - Full screen              │
│                                 │
└─────────────────────────────────┘
```

### Video Preview
```
┌─────────────────────────────────┐
│                        [❌]      │  (Floating close)
│                                 │
│      [CBVideoPlayer]            │
│      - Built-in controls        │
│      - Quality selection        │
│      - Resume playback          │
│                                 │
└─────────────────────────────────┘
```

### Text/Code Preview
```
┌─────────────────────────────────┐
│                        [❌]      │  (Floating close)
│                                 │
│   [Enhanced Text Editor]        │
│   - Syntax highlighting         │
│   - Line numbers                │
│   - Save functionality          │
│                                 │
└─────────────────────────────────┘
```

### PDF Preview
```
┌─────────────────────────────────┐
│ [📑] report.pdf     [ℹ️] [⬇️] [🔗] [❌] │
│      ├─ PDF │ 1.8 MB              │
├─────────────────────────────────┤
│                                 │
│   [Enhanced PDF Viewer]         │
│   - Page navigation             │
│   - Zoom controls               │
│   - Search functionality        │
│                                 │
└─────────────────────────────────┘
```

## ✅ Testing Checklist

- [ ] Image files show image icon and viewer
- [ ] Video files show video icon and player
- [ ] PDF files show PDF icon and viewer
- [ ] Text files show text icon and editor
- [ ] Spreadsheet files show spreadsheet icon and viewer
- [ ] Encrypted files show lock badge
- [ ] Info panel toggles correctly
- [ ] All tooltips appear on hover
- [ ] Keyboard shortcuts work
- [ ] Loading state displays properly
- [ ] Error state shows with retry button
- [ ] Mobile responsive layout works
- [ ] Download button functions
- [ ] Share button copies link
- [ ] Close button/Esc key works

## 🚀 Performance Notes

- **Lazy Loading**: File content only loads when modal opens
- **Cleanup**: Blob URLs revoked on unmount
- **Memoization**: Callbacks optimized to prevent re-renders
- **Animations**: GPU-accelerated transforms
- **Event Listeners**: Properly cleaned up on unmount

---

**Quick Tips:**
- Press `I` to quickly check file metadata
- Use `Ctrl+D` for fast downloads
- `Esc` closes the modal instantly
- Hover over any button for helpful tooltips
