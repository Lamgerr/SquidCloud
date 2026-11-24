# 🎨 Squidset Design System
## Professional UI/UX Framework for SquidCloud

**Philosophy:** Clean, sophisticated, professional - inspired by enterprise software done right  
**Influences:** Linear, Notion, Stripe, Vercel  
**Focus:** Clarity, efficiency, elegance

---

## 🎯 **Core Principles**

1. **Clarity First** - Every element has purpose
2. **Professional** - Enterprise-grade aesthetics
3. **Consistent** - Predictable patterns throughout
4. **Efficient** - Fast, responsive, no bloat
5. **Accessible** - WCAG AA compliant

---

## 🎨 **Design Tokens**

### Color System - Neutral with Accents

```css
/* Neutrals */
--squid-gray-50: #FAFAFA
--squid-gray-100: #F5F5F5
--squid-gray-200: #E5E5E5
--squid-gray-300: #D4D4D4
--squid-gray-400: #A3A3A3
--squid-gray-500: #737373
--squid-gray-600: #525252
--squid-gray-700: #404040
--squid-gray-800: #262626
--squid-gray-900: #171717

/* Primary (Refined Blue) */
--squid-blue-50: #F0F9FF
--squid-blue-500: #0EA5E9
--squid-blue-600: #0284C7
--squid-blue-700: #0369A1

/* Semantic Colors */
--squid-success: #10B981
--squid-warning: #F59E0B
--squid-error: #EF4444
--squid-info: #3B82F6

/* Surfaces */
--squid-bg-primary: #FFFFFF
--squid-bg-secondary: #FAFAFA
--squid-bg-tertiary: #F5F5F5
--squid-border: #E5E5E5
```

### Typography

```css
/* Font Family */
--squid-font-sans: 'Inter', -apple-system, system-ui, sans-serif
--squid-font-mono: 'JetBrains Mono', 'Fira Code', monospace

/* Font Sizes */
--squid-text-xs: 0.75rem     /* 12px */
--squid-text-sm: 0.875rem    /* 14px */
--squid-text-base: 1rem      /* 16px */
--squid-text-lg: 1.125rem    /* 18px */
--squid-text-xl: 1.25rem     /* 20px */
--squid-text-2xl: 1.5rem     /* 24px */
--squid-text-3xl: 1.875rem   /* 30px */

/* Font Weights */
--squid-weight-normal: 400
--squid-weight-medium: 500
--squid-weight-semibold: 600
--squid-weight-bold: 700

/* Line Heights */
--squid-leading-tight: 1.25
--squid-leading-normal: 1.5
--squid-leading-relaxed: 1.75
```

### Spacing (8px base unit)

```css
--squid-space-1: 0.25rem   /* 4px */
--squid-space-2: 0.5rem    /* 8px */
--squid-space-3: 0.75rem   /* 12px */
--squid-space-4: 1rem      /* 16px */
--squid-space-5: 1.25rem   /* 20px */
--squid-space-6: 1.5rem    /* 24px */
--squid-space-8: 2rem      /* 32px */
--squid-space-10: 2.5rem   /* 40px */
--squid-space-12: 3rem     /* 48px */
--squid-space-16: 4rem     /* 64px */
```

### Shadows - Subtle & Professional

```css
/* Elevation System */
--squid-shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05)
--squid-shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.05)
--squid-shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.05)
--squid-shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.05)

/* Focus Ring */
--squid-ring: 0 0 0 3px rgb(14 165 233 / 0.1)
```

### Border Radius - Minimal

```css
--squid-radius-sm: 0.375rem  /* 6px */
--squid-radius-md: 0.5rem    /* 8px */
--squid-radius-lg: 0.75rem   /* 12px */
--squid-radius-xl: 1rem      /* 16px */
```

---

## 🧩 **Component Library**

### Button System

```tsx
// Primary Button
export const Button = ({ 
  variant = 'primary',
  size = 'md',
  children,
  ...props 
}) => {
  const baseStyles = `
    inline-flex items-center justify-center
    font-medium transition-all duration-150
    focus:outline-none focus:ring-2 focus:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed
  `;
  
  const variants = {
    primary: `
      bg-squid-blue-600 text-white
      hover:bg-squid-blue-700
      focus:ring-squid-blue-500
      active:bg-squid-blue-800
    `,
    secondary: `
      bg-squid-gray-100 text-squid-gray-900
      hover:bg-squid-gray-200
      focus:ring-squid-gray-500
      border border-squid-gray-200
    `,
    ghost: `
      text-squid-gray-700
      hover:bg-squid-gray-100
      focus:ring-squid-gray-500
    `,
    danger: `
      bg-squid-error text-white
      hover:bg-red-600
      focus:ring-squid-error
    `
  };
  
  const sizes = {
    sm: 'px-3 py-1.5 text-sm rounded-md',
    md: 'px-4 py-2 text-sm rounded-md',
    lg: 'px-5 py-2.5 text-base rounded-lg',
  };
  
  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizes[size]}`}
      {...props}
    >
      {children}
    </button>
  );
};
```

### Card Component

```tsx
export const Card = ({ 
  children, 
  hover = false,
  padding = 'md',
  className = '' 
}) => {
  return (
    <div className={`
      bg-white
      border border-squid-gray-200
      rounded-lg
      shadow-sm
      ${hover ? 'hover:shadow-md hover:border-squid-gray-300 transition-all duration-200' : ''}
      ${padding === 'sm' ? 'p-4' : padding === 'md' ? 'p-6' : 'p-8'}
      ${className}
    `}>
      {children}
    </div>
  );
};
```

### Input Component

```tsx
export const Input = ({ 
  label, 
  error, 
  helper,
  icon,
  ...props 
}) => {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-sm font-medium text-squid-gray-700">
          {label}
        </label>
      )}
      
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-squid-gray-400">
            {icon}
          </div>
        )}
        
        <input
          className={`
            w-full px-3 py-2 ${icon ? 'pl-10' : ''}
            text-sm text-squid-gray-900
            bg-white
            border border-squid-gray-300
            rounded-md
            placeholder:text-squid-gray-400
            focus:outline-none focus:ring-2 focus:ring-squid-blue-500 focus:border-transparent
            disabled:bg-squid-gray-50 disabled:cursor-not-allowed
            ${error ? 'border-squid-error focus:ring-squid-error' : ''}
          `}
          {...props}
        />
      </div>
      
      {helper && !error && (
        <p className="text-xs text-squid-gray-500">{helper}</p>
      )}
      
      {error && (
        <p className="text-xs text-squid-error">{error}</p>
      )}
    </div>
  );
};
```

### Badge Component

```tsx
export const Badge = ({ 
  children, 
  variant = 'default',
  size = 'md' 
}) => {
  const variants = {
    default: 'bg-squid-gray-100 text-squid-gray-700',
    primary: 'bg-squid-blue-50 text-squid-blue-700',
    success: 'bg-green-50 text-green-700',
    warning: 'bg-yellow-50 text-yellow-700',
    error: 'bg-red-50 text-red-700',
  };
  
  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-0.5 text-xs',
    lg: 'px-3 py-1 text-sm',
  };
  
  return (
    <span className={`
      inline-flex items-center
      font-medium rounded-md
      ${variants[variant]}
      ${sizes[size]}
    `}>
      {children}
    </span>
  );
};
```

---

## 📐 **Layout Components**

### Professional Sidebar

```tsx
export const Sidebar = ({ children }) => {
  return (
    <aside className="
      fixed left-0 top-0 bottom-0
      w-64
      bg-white
      border-r border-squid-gray-200
      flex flex-col
    ">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-squid-gray-200">
        <h1 className="text-lg font-semibold text-squid-gray-900">
          CloudBliss
        </h1>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {children}
      </nav>
      
      {/* Footer */}
      <div className="p-4 border-t border-squid-gray-200">
        <div className="text-xs text-squid-gray-500">
          Storage: 45 GB / 100 GB
        </div>
        <div className="mt-2 h-1 bg-squid-gray-200 rounded-full overflow-hidden">
          <div className="h-full w-[45%] bg-squid-blue-600 rounded-full" />
        </div>
      </div>
    </aside>
  );
};

export const SidebarItem = ({ 
  icon, 
  label, 
  active = false,
  badge,
  onClick 
}) => {
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 px-3 py-2 rounded-md
        text-sm font-medium
        transition-colors duration-150
        ${active 
          ? 'bg-squid-gray-100 text-squid-gray-900' 
          : 'text-squid-gray-600 hover:bg-squid-gray-50 hover:text-squid-gray-900'
        }
      `}
    >
      <span className="text-squid-gray-400">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {badge && <Badge size="sm">{badge}</Badge>}
    </button>
  );
};
```

### Header/Topbar

```tsx
export const Header = ({ title, actions }) => {
  return (
    <header className="
      sticky top-0 z-10
      h-16 px-6
      bg-white/80 backdrop-blur-sm
      border-b border-squid-gray-200
      flex items-center justify-between
    ">
      <h1 className="text-xl font-semibold text-squid-gray-900">
        {title}
      </h1>
      
      <div className="flex items-center gap-3">
        {actions}
      </div>
    </header>
  );
};
```

### Professional Search Bar

```tsx
export const SearchBar = ({ placeholder, onSearch }) => {
  return (
    <div className="relative">
      <div className="absolute left-3 top-1/2 -translate-y-1/2">
        <svg className="w-4 h-4 text-squid-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      
      <input
        type="text"
        placeholder={placeholder || "Search..."}
        className="
          w-full pl-10 pr-4 py-2
          text-sm text-squid-gray-900
          bg-squid-gray-50
          border border-transparent
          rounded-md
          placeholder:text-squid-gray-400
          focus:outline-none focus:ring-2 focus:ring-squid-blue-500 focus:bg-white focus:border-transparent
          transition-all duration-150
        "
        onChange={(e) => onSearch?.(e.target.value)}
      />
    </div>
  );
};
```

---

## 🎴 **File Management Components**

### File Card - Professional Grid Item

```tsx
export const FileCard = ({ 
  file, 
  onOpen, 
  onDownload, 
  onDelete 
}) => {
  const getFileIcon = (type) => {
    const icons = {
      'pdf': '📄',
      'image': '🖼️',
      'video': '🎥',
      'audio': '🎵',
      'document': '📝',
      'folder': '📁',
    };
    return icons[type] || '📄';
  };
  
  return (
    <Card hover padding="md" className="group cursor-pointer">
      {/* Thumbnail */}
      <div className="
        aspect-video mb-4
        bg-squid-gray-50
        rounded-md
        flex items-center justify-center
        overflow-hidden
      ">
        {file.thumbnail ? (
          <img 
            src={file.thumbnail} 
            alt={file.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-4xl">
            {getFileIcon(file.type)}
          </span>
        )}
      </div>
      
      {/* File info */}
      <div className="space-y-2">
        <h3 className="font-medium text-sm text-squid-gray-900 truncate">
          {file.name}
        </h3>
        
        <div className="flex items-center justify-between text-xs text-squid-gray-500">
          <span>{file.size}</span>
          <span>{file.modified}</span>
        </div>
      </div>
      
      {/* Actions (show on hover) */}
      <div className="
        mt-4 pt-4 border-t border-squid-gray-200
        flex gap-2
        opacity-0 group-hover:opacity-100
        transition-opacity duration-150
      ">
        <Button variant="ghost" size="sm" onClick={onOpen}>
          Open
        </Button>
        <Button variant="ghost" size="sm" onClick={onDownload}>
          Download
        </Button>
        <Button variant="ghost" size="sm" onClick={onDelete}>
          Delete
        </Button>
      </div>
    </Card>
  );
};
```

### File List Item - Table Row Alternative

```tsx
export const FileListItem = ({ file, selected, onSelect }) => {
  return (
    <div className={`
      flex items-center gap-4 px-4 py-3
      border-b border-squid-gray-200
      hover:bg-squid-gray-50
      cursor-pointer
      transition-colors duration-150
      ${selected ? 'bg-squid-blue-50' : ''}
    `}>
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={selected}
        onChange={onSelect}
        className="
          w-4 h-4
          text-squid-blue-600
          border-squid-gray-300
          rounded
          focus:ring-2 focus:ring-squid-blue-500
        "
      />
      
      {/* Icon */}
      <div className="text-2xl">
        {getFileIcon(file.type)}
      </div>
      
      {/* Name */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-squid-gray-900 truncate">
          {file.name}
        </p>
      </div>
      
      {/* Size */}
      <div className="text-sm text-squid-gray-500 w-20">
        {file.size}
      </div>
      
      {/* Modified */}
      <div className="text-sm text-squid-gray-500 w-32">
        {file.modified}
      </div>
      
      {/* Actions */}
      <div className="flex gap-1">
        <button className="p-1.5 hover:bg-squid-gray-100 rounded">
          <MoreVertical className="w-4 h-4 text-squid-gray-400" />
        </button>
      </div>
    </div>
  );
};
```

### Upload Dropzone - Clean & Professional

```tsx
export const UploadDropzone = ({ onUpload, accept }) => {
  const [isDragging, setIsDragging] = useState(false);
  
  return (
    <div
      className={`
        border-2 border-dashed rounded-lg
        p-12
        text-center
        transition-colors duration-200
        ${isDragging 
          ? 'border-squid-blue-500 bg-squid-blue-50' 
          : 'border-squid-gray-300 bg-squid-gray-50'
        }
      `}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        onUpload(e.dataTransfer.files);
      }}
    >
      <div className="space-y-4">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-12 h-12 bg-squid-blue-100 rounded-lg flex items-center justify-center">
            <Upload className="w-6 h-6 text-squid-blue-600" />
          </div>
        </div>
        
        {/* Text */}
        <div>
          <p className="text-sm font-medium text-squid-gray-900">
            Drop files here or click to upload
          </p>
          <p className="text-xs text-squid-gray-500 mt-1">
            {accept || 'All file types supported'}
          </p>
        </div>
        
        {/* Button */}
        <Button variant="secondary" size="sm">
          Choose Files
        </Button>
      </div>
    </div>
  );
};
```

---

## 🎯 **Implementation Priority**

### Phase 1: Core System (This Week)
1. Set up design tokens in Tailwind config
2. Create base components (Button, Input, Card)
3. Implement typography system
4. Add focus states and accessibility

### Phase 2: Layout (Next Week)
5. Build sidebar navigation
6. Create header component
7. Implement search bar
8. Add responsive breakpoints

### Phase 3: File Management (Week 3)
9. File card component
10. File list component
11. Upload dropzone
12. File preview modal

---

**Next Step:** Start implementing in actual components?
