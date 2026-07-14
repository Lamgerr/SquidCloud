const fs = require('fs');
const path = require('path');

const root = 'node_modules/@fluentui/react-icons/lib';
const files = [];
function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p);
    else if (f.endsWith('.d.ts')) files.push(p);
  }
}
walk(root);

const names = new Set();
const re = /declare const (\w+):/g;
for (const f of files) {
  const t = fs.readFileSync(f, 'utf8');
  let m;
  while ((m = re.exec(t))) names.add(m[1]);
}
console.log('total fluent exported names:', names.size);

const filledNames = [...names].filter((n) => n.endsWith('Filled'));

function fuzzy(base) {
  const lower = base.toLowerCase();
  let best = null;
  let bestScore = -1;
  for (const n of filledNames) {
    const prefix = n.slice(0, -'Filled'.length).toLowerCase();
    let score = -1;
    if (prefix === lower) score = 1000;
    else if (prefix.startsWith(lower)) score = 500 - (prefix.length - lower.length);
    else if (prefix.includes(lower)) score = 300 - (prefix.length - lower.length);
    else if (lower.includes(prefix) && prefix.length >= 4) score = 200 - (lower.length - prefix.length);
    if (score > bestScore) {
      bestScore = score;
      best = n;
    }
  }
  return bestScore >= 200 ? best : null;
}

const map = {
  Airplay: 'Tv',
  AlignCenterHorizontal: 'AlignCenterHorizontal',
  AlignLeft: 'TextAlignLeft',
  AlignRight: 'TextAlignRight',
  Archive: 'Archive',
  ArrowBendLeftDown: 'ArrowReply',
  ArrowClockwise: 'ArrowClockwise',
  ArrowCounterClockwise: 'ArrowCounterclockwise',
  ArrowDown: 'ArrowDown',
  ArrowDownRight: 'ArrowDownRight',
  ArrowLeft: 'ArrowLeft',
  ArrowLineDown: 'ArrowDown',
  ArrowLineLeft: 'ArrowLeft',
  ArrowLineRight: 'ArrowRight',
  ArrowLineUp: 'ArrowUp',
  ArrowRight: 'ArrowRight',
  ArrowSquareOut: 'Open',
  ArrowUp: 'ArrowUp',
  ArrowUpRight: 'ArrowUpRight',
  ArrowsClockwise: 'ArrowSync',
  ArrowsHorizontal: 'ArrowLeftRight',
  ArrowsIn: 'FullScreenMinimize',
  ArrowsMerge: 'ArrowMerge',
  ArrowsOut: 'FullScreenMaximize',
  ArrowsOutCardinal: 'FullScreenMaximize',
  ArrowsOutLineHorizontal: 'FullScreenMinimize',
  ArrowsSplit: 'ArrowSplit',
  ArrowsVertical: 'ArrowUpDown',
  Asterisk: 'Asterisk',
  Backspace: 'Backspace',
  Bell: 'Alert',
  Binary: 'Code',
  Book: 'Book',
  BookOpen: 'BookOpen',
  BookmarkSimple: 'Bookmark',
  BracketsCurly: 'Code',
  Briefcase: 'Briefcase',
  Bug: 'Bug',
  Calculator: 'Calculator',
  Calendar: 'Calendar',
  Camera: 'Camera',
  CaretDown: 'ChevronDown',
  CaretLeft: 'ChevronLeft',
  CaretRight: 'ChevronRight',
  CaretUp: 'ChevronUp',
  CaretUpDown: 'ChevronUpDown',
  ChartBar: 'DataBarVertical',
  ChartLine: 'DataLine',
  ChartPie: 'DataPie',
  ChatCircle: 'Chat',
  Check: 'Checkmark',
  CheckCircle: 'CheckmarkCircle',
  CheckSquare: 'CheckboxChecked',
  Circle: 'Circle',
  CircleHalf: 'Contrast',
  ClipboardText: 'Clipboard',
  Clock: 'Clock',
  ClockCounterClockwise: 'History',
  ClosedCaptioning: 'ClosedCaption',
  Cloud: 'Cloud',
  Code: 'Code',
  CodeSimple: 'Code',
  Columns: 'TableView',
  Command: 'Command',
  Copy: 'Copy',
  CopySimple: 'Copy',
  Crosshair: 'Crosshair',
  Crown: 'Crown',
  CurrencyDollar: 'Money',
  CursorClick: 'Cursor',
  Database: 'Database',
  DeviceMobile: 'Phone',
  Disc: 'CompactDisc',
  Divide: 'Divide',
  Dot: 'Circle',
  DotsSixVertical: 'Reorder',
  DotsThree: 'MoreHorizontal',
  DotsThreeVertical: 'MoreVertical',
  Download: 'ArrowDownload',
  DownloadSimple: 'ArrowDownload',
  DropHalf: 'Drop',
  Envelope: 'Mail',
  Eraser: 'Eraser',
  Export: 'Share',
  Eye: 'Eye',
  EyeSlash: 'EyeOff',
  File: 'Document',
  FileArchive: 'FolderZip',
  FileArrowDown: 'DocumentArrowDown',
  FileAudio: 'MusicNote',
  FileCode: 'Code',
  FileImage: 'Image',
  FilePlus: 'DocumentAdd',
  FileText: 'DocumentText',
  FileVideo: 'Video',
  FileX: 'DocumentDismiss',
  FileXls: 'Table',
  Files: 'Documents',
  Fingerprint: 'Fingerprint',
  Flask: 'Flask',
  FloppyDisk: 'Save',
  Folder: 'Folder',
  FolderOpen: 'FolderOpen',
  FolderPlus: 'FolderAdd',
  FolderSimple: 'Folder',
  Funnel: 'Filter',
  GameController: 'Game',
  Gauge: 'Gauge',
  Gear: 'Settings',
  GearSix: 'Settings',
  GitBranch: 'BranchFork',
  GitCommit: 'Commit',
  GitFork: 'BranchFork',
  GithubLogo: 'Code',
  GlobeSimple: 'Globe',
  GridFour: 'GridView',
  Hand: 'Hand',
  HardDrives: 'HardDrive',
  Hash: 'NumberSymbol',
  Highlighter: 'Highlight',
  House: 'Home',
  Image: 'Image',
  Info: 'Info',
  Key: 'Key',
  Keyboard: 'Keyboard',
  Layout: 'Board',
  Lightning: 'Flash',
  LineSegment: 'Line',
  Link: 'Link',
  LinkSimple: 'Link',
  List: 'List',
  ListBullets: 'TextBulletList',
  ListChecks: 'TaskList',
  ListNumbers: 'TextNumberList',
  Lock: 'Lock',
  LockOpen: 'LockOpen',
  MagicWand: 'Wand',
  Magnet: 'Magnet',
  MagnifyingGlass: 'Search',
  MagnifyingGlassMinus: 'ZoomOut',
  MagnifyingGlassPlus: 'ZoomIn',
  MapPin: 'Location',
  MathOperations: 'MathFormat',
  Minus: 'Subtract',
  Monitor: 'Desktop',
  Moon: 'WeatherMoon',
  MusicNote: 'MusicNote',
  Network: 'Network',
  Package: 'Box',
  Palette: 'Color',
  PaperPlaneRight: 'Send',
  Pause: 'Pause',
  Pen: 'Pen',
  PencilSimple: 'Edit',
  PencilSimpleLine: 'Edit',
  PictureInPicture: 'PictureInPicture',
  Play: 'Play',
  Plus: 'Add',
  Power: 'Power',
  Presentation: 'Present',
  Printer: 'Print',
  Prohibit: 'Prohibited',
  PushPin: 'Pin',
  Question: 'QuestionCircle',
  Quotes: 'Quote',
  Rows: 'Table',
  Share: 'Share',
  ShareNetwork: 'Share',
  Shield: 'Shield',
  ShieldCheck: 'ShieldCheckmark',
  ShieldWarning: 'ShieldAlert',
  Shuffle: 'Shuffle',
  Sidebar: 'PanelLeft',
  SidebarSimple: 'PanelLeft',
  Sigma: 'Sigma',
  SignOut: 'SignOut',
  SkipBack: 'Previous',
  SkipForward: 'Next',
  Sliders: 'Slider',
  SortAscending: 'ArrowSortUp',
  SortDescending: 'ArrowSortDown',
  Sparkle: 'Sparkle',
  SpeakerHigh: 'Speaker',
  SpeakerX: 'SpeakerMute',
  Spinner: 'SpinnerIos',
  SpinnerGap: 'SpinnerIos',
  Square: 'Square',
  SquaresFour: 'GridView',
  Stack: 'Stack',
  Star: 'Star',
  Sun: 'WeatherSunny',
  Table: 'Table',
  Tag: 'Tag',
  Terminal: 'Terminal',
  TerminalWindow: 'Terminal',
  TextAa: 'Text',
  TextB: 'TextBold',
  TextColumns: 'TextColumnOne',
  TextItalic: 'TextItalic',
  TextStrikethrough: 'TextStrikethrough',
  TextT: 'TextT',
  TextUnderline: 'TextUnderline',
  Translate: 'Translate',
  Trash: 'Delete',
  Tray: 'Tray',
  TrendDown: 'TrendDown',
  TrendUp: 'TrendUp',
  Triangle: 'Triangle',
  Trophy: 'Trophy',
  Upload: 'ArrowUpload',
  User: 'Person',
  UserCheck: 'PersonCheck',
  UserGear: 'PersonSettings',
  UserMinus: 'PersonRemove',
  UserPlus: 'PersonAdd',
  Users: 'People',
  Video: 'Video',
  Warning: 'Warning',
  WarningCircle: 'ErrorCircle',
  WifiHigh: 'Wifi',
  WifiSlash: 'WifiOff',
  X: 'Dismiss',
  XCircle: 'ErrorCircle',
};

// keyed by the FLUENT BASE (map value) that failed to resolve
const OVERRIDE = {
  ArrowLeftRight: 'ArrowSwap',
  ArrowMerge: 'ArrowJoin',
  ArrowUpDown: 'ArrowBidirectionalUpDown',
  Contrast: 'WeatherSunny',
  TableView: 'Table',
  Crosshair: 'Target',
  CompactDisc: 'MusicNote2',
  Documents: 'DocumentMultiple',
  Flask: 'Beaker',
  Commit: 'BranchFork',
  GridView: 'Grid',
  Hand: 'HandLeft',
  ShieldAlert: 'Warning',
  Slider: 'SlideLayout',
  Speaker: 'Speaker1',
  Text: 'FontSize',
  TrendDown: 'ArrowTrendingDown',
  TrendUp: 'ArrowTrending',
  Terminal: 'WindowConsole',
  PersonCheck: 'PersonSquareCheckmark',
  PersonRemove: 'PersonDelete',
  Lock: 'LockClosed',
  Divide: 'MathFormatLinear',
  MusicNote: 'MusicNote1',
  Network: 'Globe',
  Present: 'Presenter',
  Quote: 'TextQuote',
  Shuffle: 'ArrowShuffle',
  Tray: 'TrayItemAdd',
  Wifi: 'Wifi1',
  TaskList: 'TaskListAdd',
  TextNumberList: 'TextNumberListLtr',
  MathFormat: 'MathFormula',
  Game: 'Games',
  Command: 'KeyCommand',
  Asterisk: 'TextAsterisk',
  Magnet: 'Attach',
  Sigma: 'MathFormula',
};

function resolve(base) {
  const b = OVERRIDE[base] || base;
  if (names.has(b + 'Filled')) return b + 'Filled';
  if (names.has(b + 'Regular')) return b + 'Regular';
  return fuzzy(b);
}

const used = new Map();
const needed = [];
function componentFor(base) {
  const resolved = resolve(base);
  if (!resolved) return null;
  if (!used.has(resolved)) {
    used.set(resolved, resolved);
    needed.push(resolved);
  }
  return used.get(resolved);
}

const pLines = [];
const report = [];
for (const [key, base] of Object.entries(map)) {
  const comp = componentFor(base);
  const exp = OVERRIDE[base] || base;
  if (!comp) report.push(`${key} -> ${base} (NONE -> CircleFilled)`);
  else if (comp !== exp + 'Filled' && comp !== exp + 'Regular') report.push(`${key} -> ${base} (resolved: ${comp})`);
  pLines.push(`  ${key}: wrap(${comp || 'CircleFilled'}),`);
}

if (!names.has('CircleFilled')) {
  console.error('ERROR: CircleFilled not found in Fluent!');
  process.exit(1);
}
if (!needed.includes('CircleFilled')) needed.push('CircleFilled');

console.log('adjusted mappings:');
report.forEach((r) => console.log('  ', r));

const importLine = `import { ${needed.join(', ')} } from '@fluentui/react-icons';`;
const header = `import React from 'react';\nimport './icons.css';\n\n`;
const helpers = `const wrap = (C: any) =>
  function Icon({ size = 24, color, className = '', ...rest }: { size?: number; color?: string; className?: string; weight?: string }) {
    const Comp = C || CircleFilled;
    return <Comp size={size} color={color} className={\`sc-icon \${className}\`} {...rest} />;
  };

const P = {
${pLines.join('\n')}
};

export { P };
`;

const srcPath = 'src/lib/icon-map.tsx';
let src = fs.readFileSync(srcPath, 'utf8');
const tailIdx = src.indexOf('export type Icon');
if (tailIdx === -1) {
  console.error('tail marker not found');
  process.exit(1);
}
const tail = src.slice(tailIdx);
fs.writeFileSync(srcPath, header + importLine + '\n\n' + helpers + '\n' + tail);
console.log('wrote icon-map.tsx with', needed.length, 'imported icons');
