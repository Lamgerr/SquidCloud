# Theme Switcher Guide

## Overview
CloudBliss Storage now features two UI design systems that you can switch between:

1. **Default Theme** - Clean, minimal interface with standard components
2. **Squidset Design** - Professional design system with modern depth, glassmorphism, and smooth animations

## How to Switch Themes

### Via Dashboard Settings

1. Open your **Dashboard**
2. Click on the **Settings** tab (bottom of sidebar or menu)
3. Scroll to the **"UI Design System"** section
4. Choose your preferred theme:
   - **Default Theme**: Standard clean interface
   - **Squidset Design**: Premium professional design with enhanced visuals

Your choice is automatically saved and will persist across sessions.

## Theme Features

### Default Theme
- Clean and minimal interface
- Standard component styling
- Familiar shadcn/ui components
- Fast and lightweight
- Perfect for productivity-focused users

### Squidset Design ✨
- **3D Depth**: Multi-layer shadows and elevation
- **Glassmorphism**: Frosted glass effects with backdrop blur
- **Smooth Animations**: Fluid transitions and micro-interactions
- **Modern Aesthetics**: Rounded corners (16px+), gradients, and professional styling
- **Enhanced Visual Hierarchy**: Clear component separation and focus states
- **Premium Feel**: Google Material Design 3-inspired patterns

## Technical Details

### For Developers

The theme system is powered by:
- **Context API**: `SquidsetThemeContext` manages theme state
- **Local Storage**: Theme preference persists across sessions
- **CSS Variables**: Squidset color palette defined in `index.css`
- **Conditional Rendering**: Components switch based on `themeMode`

### Theme Colors (Squidset)

```css
/* Blue Palette */
--squid-blue-50 to --squid-blue-900

/* Gray Palette */
--squid-gray-50 to --squid-gray-900

/* Semantic Colors */
--squid-error: #EF4444
--squid-success: #10B981
--squid-warning: #F59E0B
```

### Using Themed Components (For Developers)

```tsx
import { useSquidsetTheme } from '@/contexts/SquidsetThemeContext';

function MyComponent() {
  const { themeMode } = useSquidsetTheme();
  
  return (
    <div className={themeMode === 'squidset' ? 'premium-styles' : 'default-styles'}>
      Content
    </div>
  );
}
```

## Browser Compatibility

Both themes work on:
- ✅ Chrome/Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

**Note**: Glassmorphism effects in Squidset Design require `backdrop-filter` support (available in all modern browsers).

## Performance

- **Default Theme**: Minimal overhead, fastest rendering
- **Squidset Design**: Optimized animations with GPU acceleration, minimal performance impact on modern devices

## FAQs

**Q: Will switching themes reset my settings?**  
A: No, only the visual appearance changes. All your data and preferences remain intact.

**Q: Can I switch themes on mobile?**  
A: Yes! The theme switcher works identically on all devices.

**Q: Does Squidset Design slow down the app?**  
A: No significant impact. Animations use GPU acceleration and are optimized for performance.

**Q: Can I customize the colors?**  
A: Currently, predefined color schemes are used. Custom themes may be added in future updates.

## Roadmap

Future enhancements planned:
- [ ] More theme variants (Ocean, Sunset, Midnight)
- [ ] Per-component theme customization
- [ ] Custom color picker
- [ ] Theme presets for accessibility (High Contrast, Low Vision)

---

**Version**: CloudBliss v8.5 (Squidset Update)  
**Last Updated**: October 2025
