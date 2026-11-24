# Animation & Segmented Control Quick Reference

## Segmented Control Component

### Basic Usage
```tsx
import { SegmentedControl } from '@/components/ui/segmented-control';

<SegmentedControl
  options={[
    { value: 'option1', label: 'Option 1' },
    { value: 'option2', label: 'Option 2' },
  ]}
  value={selected}
  onChange={setSelected}
/>
```

### SquidCloud Theme Variant
```tsx
<SegmentedControl
  options={options}
  value={selected}
  onChange={setSelected}
  variant="squidcloud"  // Premium gradient theme with cyan-blue accents
  size="md"
/>
```

**SquidCloud Theme Features:**
- Multi-layer gradient backgrounds (slate-900 → slate-800)
- Blue-cyan gradient on active state (blue-600 → blue-500 → cyan-500)
- Animated pulse effect on active buttons
- Shimmer effect on container hover
- Enhanced shadows and glows

### With Icons
```tsx
<SegmentedControl
  options={[
    { value: 'create', label: 'Create', icon: <Plus className="h-4 w-4" /> },
    { value: 'upload', label: 'Upload', icon: <Upload className="h-4 w-4" /> },
  ]}
  value={action}
  onChange={setAction}
  size="md"
  variant="squidcloud"
/>
```

### Sizes
```tsx
size="sm"   // Height: 32px, Text: 12px
size="md"   // Height: 40px, Text: 14px (default)
size="lg"   // Height: 48px, Text: 16px
```

### Full Width
```tsx
<SegmentedControl
  options={options}
  value={value}
  onChange={setValue}
  fullWidth  // Expands to container width
/>
```

## Animation Classes

### Entrance Animations
```tsx
className="animate-fadeIn"        // Simple fade in
className="animate-fadeInUp"      // Fade in from below
className="animate-fadeInDown"    // Fade in from above
className="animate-scaleIn"       // Scale up from 95% to 100%
className="animate-slideInLeft"   // Slide in from left
className="animate-slideInRight"  // Slide in from right
```

### Exit Animations
```tsx
className="animate-fadeOut"       // Simple fade out
className="animate-scaleOut"      // Scale down to 95%
```

### Hover Effects
```tsx
className="hover-lift"            // Lift up 2px with shadow
className="hover-scale"           // Scale to 105%
className="hover-scale-subtle"    // Scale to 102%
```

### Special Effects
```tsx
className="animate-smoothGlow"    // Pulsing glow effect
className="animate-smoothPulse"   // Opacity pulse
className="animate-shimmer"       // Shimmer loading effect
className="animate-smoothRotate"  // 360° rotation
className="animate-bounceSubtle"  // Gentle bounce
```

### List Animations
```tsx
<div className="stagger-animation">
  {items.map(item => (
    <div key={item.id}>
      {/* Each child animates with 50ms delay */}
    </div>
  ))}
</div>
```

### Transition Utilities
```tsx
className="transition-smooth"       // 300ms transitions
className="transition-smooth-slow"  // 500ms transitions
className="transition-smooth-fast"  // 150ms transitions
```

### Glass Morphism
```tsx
className="glass-morphism"    // Frosted glass effect
className="backdrop-smooth"   // Smooth backdrop blur
```

### Scrollbar
```tsx
className="smooth-scrollbar"  // Styled scrollbar
```

## Common Patterns

### Card with Hover Effect
```tsx
<Card className="hover-lift transition-smooth">
  <CardContent>
    {/* Content */}
  </CardContent>
</Card>
```

### Animated Button
```tsx
<Button className="transition-smooth hover-scale-subtle">
  Click Me
</Button>
```

### Staggered Grid
```tsx
<div className="grid grid-cols-3 gap-4 stagger-animation">
  {items.map(item => (
    <Card key={item.id} className="hover-lift">
      {/* Card content */}
    </Card>
  ))}
</div>
```

### Modal Entrance
```tsx
<Dialog>
  <DialogContent className="animate-scaleIn">
    {/* Dialog content */}
  </DialogContent>
</Dialog>
```

### Loading State
```tsx
<div className="animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent">
  {/* Loading skeleton */}
</div>
```

### Page Transition
```tsx
<div className="animate-fadeInUp">
  {/* Page content */}
</div>
```

## Best Practices

### DO ✅
- Use `transition-smooth` for consistent timing
- Combine hover effects with transitions
- Use stagger animations for lists (3+ items)
- Keep animations under 500ms
- Use subtle scale (1.02x) for most hovers

### DON'T ❌
- Don't stack multiple animations
- Avoid animating large lists without stagger
- Don't use bounce/spin without purpose
- Avoid transitions on layout properties (use transform)
- Don't forget `prefers-reduced-motion` support

## Performance Tips

### Use Transform
```tsx
// ✅ Good - GPU accelerated
transform: translateY(-2px)

// ❌ Avoid - triggers layout
top: -2px
```

### Combine Classes
```tsx
// ✅ Good
className="transition-smooth hover-lift hover-scale-subtle"

// ❌ Redundant
className="transition-all duration-300 hover:translate-y-[-2px] hover:scale-105"
```

### Conditional Animations
```tsx
// ✅ Good - only animate when needed
<div className={isVisible ? 'animate-fadeIn' : 'opacity-0'}>
```

## Accessibility

### Reduced Motion Support
The animations automatically respect user preferences:

```css
@media (prefers-reduced-motion: reduce) {
  /* Animations are disabled or simplified */
}
```

### Focus States
All components maintain focus indicators:

```tsx
<SegmentedControl /> // Has built-in focus rings
```

## Debugging

### Check Animation
```tsx
// Add temporary class to test
className="animate-fadeInUp bg-red-500"
```

### Slow Down Animations (Dev Only)
```css
* {
  animation-duration: 3s !important;
  transition-duration: 3s !important;
}
```

---

**Quick Start**: Import animation classes, add to className, done! 🎨
