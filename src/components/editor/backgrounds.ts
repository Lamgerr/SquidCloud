import type { BackgroundConfig } from './sqd';

export function backgroundCss(bg: BackgroundConfig): React.CSSProperties {
  const base: React.CSSProperties = {
    backgroundColor: bg.paper,
    backgroundAttachment: 'local',
  };
  const line = bg.line;
  switch (bg.type) {
    case 'ruled':
      return {
        ...base,
        backgroundImage: `linear-gradient(to bottom, transparent 27px, ${line} 28px)`,
        backgroundSize: '100% 28px',
        backgroundPosition: '0 8px',
      };
    case 'dotted':
      return {
        ...base,
        backgroundImage: `radial-gradient(${line} 1.4px, transparent 1.5px)`,
        backgroundSize: '26px 26px',
        backgroundPosition: '0 0',
      };
    case 'grid':
      return {
        ...base,
        backgroundImage: `linear-gradient(${line} 1px, transparent 1px), linear-gradient(90deg, ${line} 1px, transparent 1px)`,
        backgroundSize: '28px 28px',
        backgroundPosition: '0 0',
      };
    case 'plain':
    default:
      return base;
  }
}
