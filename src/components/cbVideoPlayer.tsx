/**
 * CBVideoPlayer — QuickTime-style floating glass HUD for video + audio.
 *
 *   desktop:  centred HUD   [vol ──]   ⟲10  ▶  10⟳   [pip][full][»]
 *                           00:02  ━━━━━━●────────────  −03:41
 *   mobile:   centred  ⟲10  ◉▶  10⟳  over the picture, scrubber capsule at the bottom,
 *             glass buttons top-right (iOS-style).
 *
 * Streaming / decryption / transcode / retry logic is unchanged from the previous player.
 * Audio files (type audio/* or known extensions) get an ambient artwork stage instead of a picture
 * and keep the HUD pinned. Motion: springs only; buttons squash, the scrubber thumb stretches with
 * pointer velocity like a liquid drop, menus pop out of their anchor.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useSpring, useTransform,
  type MotionValue,
} from 'framer-motion';
import { cn } from '@/lib/utils';
import { StreamDecryptorService } from '@/lib/videoStreamer';

interface CBVideoPlayerProps {
  file: { id: string; name: string; type: string; size: number };
  poster?: string;
  autoPlay?: boolean;
  className?: string;
  shareId?: string;
}

type LoadPhase = 'connecting' | 'decrypting' | 'buffering' | 'ready' | 'error';
type MenuPage = 'root' | 'speed' | 'audio' | 'subs' | 'quality';
type Track = { index: number; language: string; label: string };

const JELLY = { type: 'spring' as const, stiffness: 520, damping: 15, mass: 0.8 };
const POP = { type: 'spring' as const, stiffness: 380, damping: 17, mass: 0.9 };
const SOFT = { type: 'spring' as const, stiffness: 300, damping: 26, mass: 0.9 };
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const QUALITIES = ['Auto', '1080p', '720p', '480p', '360p'] as const;
type Quality = typeof QUALITIES[number];
const AUDIO_RE = /\.(mp3|m4a|aac|flac|wav|ogg|oga|opus|weba|wma|aiff?)$/i;
const qualityOf = (w: number, h: number) => {
  if (!w || !h) return 'Source';
  const q = Math.min(w, h);
  return q >= 2160 ? '4K' : q >= 1080 ? '1080p' : q >= 720 ? '720p' : q >= 480 ? '480p' : 'SD';
};

const fmt = (s: number) => {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  const p = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(sec)}` : `${p(m)}:${p(sec)}`;
};
const fmtSize = (b: number) =>
  b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : b < 1073741824 ? `${(b / 1048576).toFixed(1)} MB` : `${(b / 1073741824).toFixed(2)} GB`;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const stop = (e: React.SyntheticEvent) => e.stopPropagation();

/* ── Icons: 24px grid, 1.7 stroke, currentColor (same language as the dashboard dock) ── */
const Svg: React.FC<{ size?: number; children: React.ReactNode }> = ({ size = 22, children }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
type IP = { size?: number };
const Ic = {
  Play: (p: IP) => <Svg {...p}><path fill="currentColor" stroke="none" d="M8.2 5.3v13.4c0 .8.9 1.3 1.6.8l10.2-6.7c.6-.4.6-1.2 0-1.6L9.8 4.5c-.7-.5-1.6 0-1.6.8z" /></Svg>,
  Pause: (p: IP) => <Svg {...p}><rect x="6.4" y="5" width="3.8" height="14" rx="1.3" fill="currentColor" stroke="none" /><rect x="13.8" y="5" width="3.8" height="14" rx="1.3" fill="currentColor" stroke="none" /></Svg>,
  Back: (p: IP) => <Svg {...p}><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" /><path d="M4.5 4.5v4h4" /><text x="12" y="15.2" fontSize="7.2" fontWeight="600" textAnchor="middle" fill="currentColor" stroke="none">10</text></Svg>,
  Fwd: (p: IP) => <Svg {...p}><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" /><path d="M19.5 4.5v4h-4" /><text x="12" y="15.2" fontSize="7.2" fontWeight="600" textAnchor="middle" fill="currentColor" stroke="none">10</text></Svg>,
  Vol: ({ level, ...p }: IP & { level: 0 | 1 | 2 | 3 }) => (
    <Svg {...p}><path d="M4 9.6h3l4.4-3.6v12L7 14.4H4z" />
      {level === 0 && <path d="m15.6 9.6 5 4.8M20.6 9.6l-5 4.8" />}
      {level >= 1 && <path d="M15 9.4a3.7 3.7 0 0 1 0 5.2" />}
      {level >= 2 && <path d="M17.4 7a7 7 0 0 1 0 10" />}
      {level >= 3 && <path d="M19.7 4.8a10.2 10.2 0 0 1 0 14.4" />}</Svg>),
  Pip: (p: IP) => <Svg {...p}><path d="M4 12.5v-5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-5" /><rect x="4" y="13.5" width="8" height="5" rx="1.5" /></Svg>,
  Full: (p: IP) => <Svg {...p}><path d="M9 4.5H4.5V9M15 4.5h4.5V9M9 19.5H4.5V15M15 19.5h4.5V15" /></Svg>,
  Exit: (p: IP) => <Svg {...p}><path d="M9 4.5V9H4.5M15 4.5V9h4.5M9 19.5V15H4.5M15 19.5V15h4.5" /></Svg>,
  More: (p: IP) => <Svg {...p}><path d="M6.5 6.5 11 12l-4.5 5.5M12.5 6.5 17 12l-4.5 5.5" /></Svg>,
  Check: (p: IP) => <Svg {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></Svg>,
  ChevR: (p: IP) => <Svg {...p}><path d="m9.5 5.5 6.5 6.5-6.5 6.5" /></Svg>,
  ChevL: (p: IP) => <Svg {...p}><path d="m14.5 5.5-6.5 6.5 6.5 6.5" /></Svg>,
  Alert: (p: IP) => <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 8v4.5M12 15.8h.01" /></Svg>,
  Chip: (p: IP) => <Svg {...p}><rect x="6.5" y="6.5" width="11" height="11" rx="2.5" /><path d="M9.5 3.5v3M14.5 3.5v3M9.5 17.5v3M14.5 17.5v3M3.5 9.5h3M3.5 14.5h3M17.5 9.5h3M17.5 14.5h3" /></Svg>,
  Retry: (p: IP) => <Svg {...p}><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" /><path d="M19.5 4.5v4h-4" /></Svg>,
  Cc: (p: IP) => <Svg {...p}><rect x="2.8" y="5.5" width="18.4" height="13" rx="3" /><path d="M10 10.2a2.6 2.6 0 1 0 0 3.6M18 10.2a2.6 2.6 0 1 0 0 3.6" /></Svg>,
  Wave: (p: IP) => <Svg {...p}><path d="M4 10v4M8 7v10M12 4.5v15M16 8v8M20 10.5v3" /></Svg>,
  Gauge: (p: IP) => <Svg {...p}><path d="M4 17a8 8 0 1 1 16 0" /><path d="m12 17 4-5" /><circle cx="12" cy="17" r="1.2" fill="currentColor" stroke="none" /></Svg>,
  Sun: (p: IP) => <Svg {...p}><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" /></Svg>,
  Zoom: (p: IP) => <Svg {...p}><circle cx="10.5" cy="10.5" r="6" /><path d="m15 15 5 5M10.5 8v5M8 10.5h5" /></Svg>,
  FileUp: (p: IP) => <Svg {...p}><path d="M12 16V5M8 9l4-4 4 4" /><path d="M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" /></Svg>,
};

/* ── Liquid slider: used for the scrubber and the volume. The thumb is a droplet: it stretches with
      pointer velocity and wobbles back on release; the track swells on touch. ── */
interface SliderProps {
  value: MotionValue<number>; onChange: (f: number, final: boolean) => void; label: string;
  thick: number; hit: number; reduce: boolean; buffered?: number; ticks?: number[]; step?: number;
  tip?: (f: number) => string;
}
const JellySlider: React.FC<SliderProps> = ({ value, onChange, label, thick, hit, reduce, buffered, ticks, step = 0.05, tip }) => {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef(false);
  const last = useRef({ x: 0, t: 0 });
  const [hot, setHot] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const vel = useMotionValue(0);
  const stretch = useSpring(useTransform(vel, (v) => 1 + Math.min(Math.abs(v) / 1600, 0.85)), { stiffness: 260, damping: 12 });
  const squash = useTransform(stretch, (s) => 1 / Math.sqrt(s));
  const left = useTransform(value, (v) => `${clamp01(v) * 100}%`);
  const fill = useTransform(value, clamp01);
  const T = reduce ? { duration: 0.01 } : JELLY;
  const frac = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return clamp01((e.clientX - r.left) / r.width);
  };
  return (
    <div ref={ref} className="cbp-slider" role="slider" tabIndex={0} aria-label={label} aria-valuemin={0} aria-valuemax={100}
      aria-valuenow={Math.round(value.get() * 100)} style={{ height: hit }}
      onPointerDown={(e) => {
        e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = true; setHot(true); last.current = { x: e.clientX, t: performance.now() };
        onChange(frac(e), false);
      }}
      onPointerMove={(e) => {
        const f = frac(e);
        if (e.pointerType === 'mouse') { setHot(true); setHover(f); }
        if (!drag.current) return;
        onChange(f, false);
        const now = performance.now(), dt = now - last.current.t;
        if (dt > 0) vel.set(((e.clientX - last.current.x) / dt) * 1000);
        last.current = { x: e.clientX, t: now };
      }}
      onPointerUp={(e) => {
        if (!drag.current) return;
        drag.current = false; onChange(frac(e), true); vel.set(0);
        if (e.pointerType !== 'mouse') setHot(false);
      }}
      onPointerCancel={() => { drag.current = false; vel.set(0); setHot(false); }}
      onPointerLeave={() => { if (!drag.current) { setHot(false); setHover(null); } }}
      onKeyDown={(e) => {
        const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
        if (!d) return;
        e.preventDefault(); e.stopPropagation(); onChange(clamp01(value.get() + d * step), true);
      }}
      onClick={stop}>
      <motion.div className="cbp-track" animate={{ height: hot ? thick * 1.8 : thick }} transition={T}>
        {buffered !== undefined && <span className="cbp-buf" style={{ width: `${clamp01(buffered) * 100}%` }} />}
        {ticks?.map((t, i) => <span key={i} className="cbp-tick" style={{ left: `${t * 100}%` }} />)}
        <motion.span className="cbp-fill" style={{ scaleX: fill }} />
      </motion.div>
      <motion.div className="cbp-thumbpos" style={{ left }}>
        <motion.span style={{ scaleX: stretch, scaleY: squash, display: 'block' }}>
          <motion.span className="cbp-thumb" initial={false} animate={{ scale: hot ? 1 : 0, opacity: hot ? 1 : 0 }} transition={T} />
        </motion.span>
      </motion.div>
      <AnimatePresence>
        {tip && hover !== null && (
          <motion.div className="cbp-tip" style={{ left: `${hover * 100}%` }}
            initial={{ opacity: 0, y: 6, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 4, scale: 0.9 }} transition={T}>
            {tip(hover)}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ── Round glass-less button: squashes on press, swells on hover ── */
const Btn: React.FC<{ label: string; onClick: (e: React.MouseEvent) => void; size?: number; reduce: boolean; on?: boolean; children: React.ReactNode }> =
  ({ label, onClick, size = 40, reduce, on, children }) => (
    <motion.button type="button" className="cbp-btn" data-on={on} aria-label={label} title={label}
      style={{ width: size, height: size }} onClick={(e) => { e.stopPropagation(); onClick(e); }} onDoubleClick={stop}
      whileHover={reduce ? undefined : { scale: 1.1 }} whileTap={reduce ? undefined : { scaleX: 0.88, scaleY: 0.8 }}
      transition={reduce ? { duration: 0.01 } : JELLY}>
      {children}
    </motion.button>
  );

/* ── »-menu: QuickTime-style pages (speed / audio / subtitles) that slide, inside a container that springs its height ── */
interface MenuProps {
  page: MenuPage; dir: number; go: (p: MenuPage) => void; compact: boolean; reduce: boolean;
  speed: number; setSpeed: (n: number) => void;
  quality: Quality; setQuality: (q: Quality) => void; sourceQuality: string;
  audioTracks: Track[]; activeAudio: number; setAudio: (i: number) => void;
  textTracks: Track[]; activeText: number; setText: (i: number) => void; onLoadSubs: () => void;
  canPip: boolean; onPip: () => void; stats: boolean; toggleStats: () => void;
}
const Row: React.FC<{ label: string; value?: string; checked?: boolean; slot?: boolean; chevron?: boolean; icon?: React.ReactNode; onClick: () => void }> =
  ({ label, value, checked, slot, chevron, icon, onClick }) => (
    <button type="button" role="menuitem" className="cbp-row" onClick={onClick}>
      {slot && <span className="cbp-rowchk">{checked && <Ic.Check size={16} />}</span>}
      {icon && !slot && <span className="cbp-rowico">{icon}</span>}
      <span className="cbp-rowlab">{label}</span>
      {value && <span className="cbp-rowval">{value}</span>}
      {chevron && <Ic.ChevR size={15} />}
    </button>
  );
const MENU_TITLE: Record<MenuPage, string> = { root: 'Options', speed: 'Playback Speed', audio: 'Audio Track', subs: 'Subtitles', quality: 'Quality' };
const Menu: React.FC<MenuProps> = (m) => {
  const T = m.reduce ? { duration: 0.01 } : { type: 'spring' as const, stiffness: 520, damping: 34 };
  return (
    <motion.div layout className="cbp-menu cbp-glass" data-cbp-menu role="menu" data-compact={m.compact} data-cbp-ui
      initial={m.reduce ? false : { opacity: 0, scale: 0.84, y: m.compact ? -10 : 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: m.compact ? -6 : 8 }}
      transition={m.reduce ? { duration: 0.01 } : POP}
      style={{ transformOrigin: m.compact ? 'top right' : 'bottom right' }}
      onClick={stop} onDoubleClick={stop} onPointerDown={stop}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={m.page} initial={{ opacity: 0, x: 14 * m.dir }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -14 * m.dir }} transition={T}>
          {m.page === 'root' ? (
            <>
              <Row icon={<Ic.Gauge size={16} />} label="Quality" value={m.quality === 'Auto' ? `Auto · ${m.sourceQuality}` : m.quality} chevron onClick={() => m.go('quality')} />
              <Row icon={<Ic.Wave size={16} />} label="Audio Track" value={m.audioTracks.length > 1 ? (m.audioTracks.find((t) => t.index === m.activeAudio)?.label || 'Default') : 'Default'} chevron onClick={() => m.go('audio')} />
              <Row icon={<Ic.Cc size={16} />} label="Subtitles" value={m.activeText >= 0 ? (m.textTracks.find((t) => t.index === m.activeText)?.label || 'On') : 'Off'} chevron onClick={() => m.go('subs')} />
              <Row icon={<Svg size={16}><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3 2" /></Svg>} label="Playback Speed" value={m.speed === 1 ? 'Normal' : `${m.speed}×`} chevron onClick={() => m.go('speed')} />
              <div className="cbp-sep" />
              {m.canPip && <Row icon={<Ic.Pip size={16} />} label="Picture in Picture" onClick={m.onPip} />}
              <Row icon={<Ic.Chip size={16} />} label="Playback Info" checked={m.stats} onClick={m.toggleStats} value={m.stats ? 'On' : undefined} />
            </>
          ) : (
            <>
              <button type="button" className="cbp-row cbp-back" onClick={() => m.go('root')}><Ic.ChevL size={15} /><span className="cbp-rowlab">{MENU_TITLE[m.page]}</span></button>
              <div className="cbp-sep" />
              {m.page === 'speed' && SPEEDS.map((s) => <Row key={s} slot label={s === 1 ? '1× (Normal)' : `${s}×`} checked={m.speed === s} onClick={() => m.setSpeed(s)} />)}
              {m.page === 'quality' && (<>
                <div className="cbp-note">Source · {m.sourceQuality}{m.quality === 'Auto' ? '' : ` · playing as ${m.quality}`}</div>
                {QUALITIES.map((q) => <Row key={q} slot label={q === 'Auto' ? `Auto (${m.sourceQuality})` : q} checked={m.quality === q} onClick={() => m.setQuality(q)} />)}
              </>)}
              {m.page === 'audio' && (<>
                <Row slot label="Default" checked={m.activeAudio < 0} onClick={() => m.setAudio(-1)} />
                {m.audioTracks.map((t) => <Row key={t.index} slot label={t.label} checked={m.activeAudio === t.index} onClick={() => m.setAudio(t.index)} />)}
              </>)}
              {m.page === 'subs' && (<>
                <Row slot label="Off" checked={m.activeText < 0} onClick={() => m.setText(-1)} />
                {m.textTracks.map((t) => <Row key={t.index} slot label={t.label} checked={m.activeText === t.index} onClick={() => m.setText(t.index)} />)}
                <div className="cbp-sep" />
                <Row icon={<Ic.FileUp size={16} />} label="Load subtitle file…" onClick={m.onLoadSubs} />
              </>)}
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
};


const Stage: React.FC<{ className?: string; reduce: boolean; children: React.ReactNode }> = ({ className, reduce, children }) => (
  <div className={cn('cbp-root cbp-stage', className)}>
    <style>{CSS}</style>
    <motion.div className="cbp-card cbp-glass" initial={reduce ? false : { opacity: 0, scale: 0.88, y: 14 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={POP}>{children}</motion.div>
  </div>
);

/* ═════════════════════════ Player ═════════════════════════ */

const CBVideoPlayer: React.FC<CBVideoPlayerProps> = ({ file, poster, autoPlay = false, className, shareId }) => {
  const reduce = !!useReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [rootEl, setRootEl] = useState<HTMLDivElement | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const ffmpegRef = useRef<any>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const tapTimer = useRef<ReturnType<typeof setTimeout>>();
  const lastTap = useRef(0);
  const scrubRef = useRef(false);
  const lastSeek = useRef(0);
  const fxId = useRef(0);
  const touch = useRef({ id: -1, x: 0, y: 0, startX: 0, startY: 0, t: 0, mode: '' as 'none' | 'seek' | 'volume' | 'brightness' | 'pinch', startVol: 1, startBright: 1, startSec: 0, moved: false, pinch: 0, pinchStart: 1 });
  const subsInput = useRef<HTMLInputElement>(null);
  const resumeAt = useRef(0);

  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [buffering, setBuffering] = useState(true);
  const [hasError, setHasError] = useState(false);
  const hasErrorRef = useRef(false);
  const setHasErrorTracked = useCallback((v: boolean | ((prev: boolean) => boolean)) => {
    setHasError(v);
    hasErrorRef.current = typeof v === 'function' ? v(hasErrorRef.current) : v;
  }, []);
  const [retryCount, setRetryCount] = useState(0);
  const [loadPhase, setLoadPhase] = useState<LoadPhase>('connecting');
  const [loadProgress, setLoadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [quality, setQualityState] = useState<Quality>('Auto');
  const [brightness, setBrightness] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [gesture, setGesture] = useState<{ kind: string; value: string; id: number } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPage, setMenuPage] = useState<MenuPage>('root');
  const menuDir = useRef(1);
  const [showStats, setShowStats] = useState(false);
  const [activeAudioTrack, setActiveAudioTrack] = useState(-1);
  const [activeTextTrack, setActiveTextTrack] = useState(-1);
  const activeTextRef = useRef(-1);
  const [audioTracks, setAudioTracks] = useState<Track[]>([]);
  const [textTracks, setTextTracks] = useState<Track[]>([]);
  const [chapters] = useState<{ time: number; label: string }[]>([]);
  const [stats, setStats] = useState({ resolution: '', dropped: 0, width: 0, height: 0 });
  const [cue, setCue] = useState('');
  const [showTotal, setShowTotal] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const [seekFx, setSeekFx] = useState<{ side: 'left' | 'right'; id: number } | null>(null);
  const [flash, setFlash] = useState<{ playing: boolean; id: number } | null>(null);

  const prog = useMotionValue(0);
  const volMV = useMotionValue(1);
  const energy = useMotionValue(0);
  const orbScale = useSpring(useTransform(energy, (e) => 1 + e * 0.32), { stiffness: 180, damping: 14 });
  const audioGraph = useRef<{ el: HTMLMediaElement; an: AnalyserNode; ctx: AudioContext } | null>(null);

  const setRoot = useCallback((el: HTMLDivElement | null) => { containerRef.current = el; setRootEl(el); }, []);
  const compact = useCompact(rootEl);
  const isAudio = useMemo(() => /^audio\//i.test(file.type || '') || AUDIO_RE.test(file.name), [file.type, file.name]);
  const isUnsupportedContainer = useMemo(() => /\.(avi|wmv|flv)$/i.test(file.name), [file.name]);
  const isLargeFile = useMemo(() => file.size > 50 * 1024 * 1024, [file.size]);
  const title = useMemo(() => file.name.replace(/\.[^.]+$/, ''), [file.name]);

  const [transcodeState, setTranscodeState] = useState<'idle' | 'loading_engine' | 'transcoding' | 'ready'>('idle');
  const [transcodeProgress, setTranscodeProgress] = useState(0);
  const [transcodeMessage, setTranscodeMessage] = useState('Initializing WebAssembly Engine...');
  const [transcodedUrl, setTranscodedUrl] = useState<string | null>(null);
  const [streamReady, setStreamReady] = useState(false);
  const streamReadyRef = useRef(false);

  /* ── stream prep / transcode / retry: unchanged logic ── */
  useEffect(() => {
    StreamDecryptorService.initListener(shareId);
    let cancelled = false;
    StreamDecryptorService.seedFileMeta(file.id, shareId).then(() => {
      if (!cancelled) {
        streamReadyRef.current = true;
        setStreamReady(true);
        if (hasErrorRef.current) { setHasErrorTracked(false); setBuffering(true); setRetryCount((r) => r + 1); }
      }
    }).catch((err) => {
      console.error('[Player] Seed failed:', err);
      if (!cancelled) {
        streamReadyRef.current = true;
        setStreamReady(true);
        setHasErrorTracked(true);
        setErrorMessage('Failed to prepare video stream: ' + (err?.message || 'unknown'));
      }
    });
    return () => { cancelled = true; };
  }, [shareId, file.id, setHasErrorTracked]);

  useEffect(() => () => { if (transcodedUrl) URL.revokeObjectURL(transcodedUrl); clearTimeout(retryTimerRef.current); }, [transcodedUrl]);
  useEffect(() => () => { clearTimeout(retryTimerRef.current); clearTimeout(tapTimer.current); audioGraph.current?.ctx.close?.().catch(() => {}); }, []);

  const startLocalTranscoding = async () => {
    try {
      setHasErrorTracked(false);
      setTranscodeState('loading_engine');
      setTranscodeMessage('Loading FFmpeg WebAssembly Core...');
      const { FFmpeg } = await import('@ffmpeg/ffmpeg');
      const { fetchFile, toBlobURL } = await import('@ffmpeg/util');
      if (!ffmpegRef.current) ffmpegRef.current = new FFmpeg();
      const ffmpeg = ffmpegRef.current;
      ffmpeg.on('progress', ({ progress }: { progress: number }) => {
        const pct = Math.min(100, Math.max(0, Math.round(progress * 100)));
        setTranscodeProgress(pct);
        setTranscodeMessage(`Transcoding to MP4... ${pct}%`);
      });
      if (!ffmpeg.loaded) {
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
        await ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
      }
      setTranscodeState('transcoding');
      setTranscodeMessage('Reading decrypted stream into local memory...');
      setTranscodeProgress(5);
      const virtualStreamUrl = `/virtual-stream/${file.id}`;
      const inputName = `input.${file.name.split('.').pop() || 'avi'}`;
      const outputName = 'output.mp4';
      await ffmpeg.writeFile(inputName, await fetchFile(virtualStreamUrl));
      setTranscodeMessage('Running ultrafast local video conversion...');
      setTranscodeProgress(15);
      await ffmpeg.exec(['-i', inputName, '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28', '-c:a', 'aac', outputName]);
      const fileData = await ffmpeg.readFile(outputName);
      const videoBlob = new Blob([new Uint8Array(fileData as ArrayBuffer).buffer], { type: 'video/mp4' });
      const createdUrl = URL.createObjectURL(videoBlob);
      await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile(outputName);
      setTranscodedUrl(createdUrl);
      setTranscodeState('ready');
      setBuffering(false);
    } catch (err: any) {
      console.error('[WASM Transcoder Error]:', err);
      setHasErrorTracked(true);
      setTranscodeState('idle');
    }
  };

  const retryWithBackoff = useCallback(() => {
    const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
    setErrorMessage(`Retrying in ${Math.round(delay / 1000)}s...`);
    retryTimerRef.current = setTimeout(() => {
      setHasErrorTracked(false); setBuffering(true); setLoadPhase('connecting'); setRetryCount((r) => r + 1);
    }, delay);
  }, [retryCount, setHasErrorTracked]);

  const handleRetry = (clearTimer = true) => {
    if (clearTimer) clearTimeout(retryTimerRef.current);
    setHasErrorTracked(false); setBuffering(true); setLoadPhase('connecting'); setRetryCount((r) => r + 1);
  };

  const activeVideoSource = !streamReady ? null : isUnsupportedContainer ? transcodedUrl : `/virtual-stream/${file.id}?retry=${retryCount}&q=${encodeURIComponent(quality)}`;

  /* ── transport ── */
  const ui = isAudio || controlsVisible || !playing || menuOpen || scrubbing;
  const uiRef = useRef(ui); uiRef.current = ui;
  const menuOpenRef = useRef(menuOpen); menuOpenRef.current = menuOpen;

  const wakeControls = useCallback(() => {
    setControlsVisible(true);
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (!videoRef.current?.paused && !menuOpenRef.current && !scrubRef.current) setControlsVisible(false);
    }, 2800);
  }, []);
  useEffect(() => { wakeControls(); return () => clearTimeout(hideTimerRef.current); }, [playing, wakeControls]);

  const togglePlay = useCallback((showFlash = false) => {
    const v = videoRef.current; if (!v) return;
    if (showFlash && !compact) setFlash({ playing: v.paused, id: ++fxId.current });
    if (v.paused) v.play().catch(() => {}); else v.pause();
  }, [compact]);

  const seekBy = useCallback((s: number) => {
    const v = videoRef.current; if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + s));
    setSeekFx({ side: s < 0 ? 'left' : 'right', id: ++fxId.current });
  }, []);

  const toggleFs = useCallback(() => {
    const el = containerRef.current;
    if (!document.fullscreenElement) {
      if (el?.requestFullscreen) el.requestFullscreen().catch(() => {});
      else (videoRef.current as any)?.webkitEnterFullscreen?.();          // iOS Safari: video-only fullscreen
    } else document.exitFullscreen().catch(() => {});
  }, []);
  useEffect(() => {
    const f = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', f);
    return () => document.removeEventListener('fullscreenchange', f);
  }, []);

  const setVol = useCallback((f: number) => {
    const v = videoRef.current; if (!v) return;
    v.volume = f; setVolume(f); volMV.set(f);
    if (f > 0 && v.muted) { v.muted = false; setMuted(false); }
  }, [volMV]);
  const toggleMute = useCallback(() => {
    const v = videoRef.current; if (!v) return;
    v.muted = !v.muted; setMuted(v.muted); volMV.set(v.muted ? 0 : v.volume);
  }, [volMV]);

  const setSpeed = (s: number) => { if (videoRef.current) videoRef.current.playbackRate = s; setPlaybackSpeed(s); };
  const canPip = !isAudio && typeof document !== 'undefined' && !!(document as any).pictureInPictureEnabled;
  const togglePiP = async () => {
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await videoRef.current?.requestPictureInPicture();
    } catch (err) { console.error('PiP Error:', err); }
    setMenuOpen(false);
  };
  const setAudio = (i: number) => {
    const v: any = videoRef.current;
    if (v?.audioTracks) for (let k = 0; k < v.audioTracks.length; k++) v.audioTracks[k].enabled = i < 0 ? k === 0 : k === i;
    setActiveAudioTrack(i);
  };
  const setQuality = (q: Quality) => {
    resumeAt.current = videoRef.current?.currentTime || 0;
    setQualityState(q);
    setGesture({ kind: 'quality', value: q, id: ++fxId.current });
    go('root');
  };
  const sourceQuality = qualityOf(stats.resolution.width, stats.resolution.height);

  /* load an external .srt / .vtt into a real text track (cues are rendered by us) */
  const loadSubtitles = async (fileList: FileList | null) => {
    const f = fileList?.[0]; if (!f) return;
    const v = videoRef.current; if (!v) return;
    try {
      const raw = await f.text();
      const stamp = (s: string) => {
        const p = s.trim().replace(',', '.').split(':');
        if (p.length === 3) return parseInt(p[0], 10) * 3600 + parseInt(p[1], 10) * 60 + parseFloat(p[2]);
        return 0;
      };
      const cues: { start: number; end: number; text: string }[] = [];
      const blocks = raw.replace(/^\uFEFF/, '').split(/\r?\n\r?\n/);
      blocks.forEach((b) => {
        const lines = b.split(/\r?\n/);
        const n = lines.findIndex((l) => l.includes('-->'));
        if (n < 0) return;
        const [a, z] = lines[n].split('-->');
        cues.push({ start: stamp(a), end: stamp(z?.split(/\s/)[0] || ''), text: lines.slice(n + 1).join('\n') });
      });
      const tr = v.addTextTrack('subtitles', f.name.replace(/\.(srt|vtt)$/i, ''), 'und');
      cues.forEach(({ start, end, text }) => {
        try { tr.addCue(new (window as any).VTTCue(start, end, text)); } catch { /* older browser */ }
      });
      tr.mode = 'hidden';
      tr.addEventListener('cuechange', updateCue);
      const idx = v.textTracks.length - 1;
      setTextTracks((list) => [...list, { index: idx, language: 'und', label: f.name.replace(/\.(srt|vtt)$/i, '') }]);
      setText(idx);
      setGesture({ kind: 'subs', value: f.name, id: ++fxId.current });
    } catch { setGesture({ kind: 'subs', value: 'Could not read file', id: ++fxId.current }); }
    if (subsInput.current) subsInput.current.value = '';
  };
  const updateCue = useCallback(() => {
    const v = videoRef.current; const i = activeTextRef.current;
    const t = v && i >= 0 ? v.textTracks[i] : null;
    const text = t && t.activeCues && t.activeCues.length ? Array.from(t.activeCues as any).map((c: any) => c.text).join('\n') : '';
    setCue((c) => (c === text ? c : text));
  }, []);
  const setText = (i: number) => {
    const v = videoRef.current; if (!v) return;
    for (let k = 0; k < v.textTracks.length; k++) v.textTracks[k].mode = 'hidden';   // we render cues ourselves
    activeTextRef.current = i; setActiveTextTrack(i); updateCue();
  };
  const go = (p: MenuPage) => { menuDir.current = p === 'root' ? -1 : 1; setMenuPage(p); };
  const toggleMenu = () => { menuDir.current = 1; setMenuPage('root'); setMenuOpen((o) => !o); };

  const onScrub = (f: number, final: boolean) => {
    const v = videoRef.current; if (!v || !duration) return;
    scrubRef.current = !final; setScrubbing(!final);
    prog.set(f); setCurrentTime(f * duration);
    const now = performance.now();
    if (final || now - lastSeek.current > 140) { v.currentTime = f * duration; lastSeek.current = now; }   // live-seek, throttled
  };

  /* smooth 60fps progress without re-rendering the tree */
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const v = videoRef.current;
      if (v && v.duration && !scrubRef.current) prog.set(v.currentTime / v.duration);
      raf = requestAnimationFrame(loop);
    };
    if (playing) loop();
    return () => cancelAnimationFrame(raf);
  }, [playing, prog, activeVideoSource]);

  /* audio artwork reacts to the real signal; if WebAudio is unavailable the orb just idles */
  useEffect(() => {
    if (!isAudio || !playing || reduce) { energy.set(0); return; }
    const v = videoRef.current; if (!v) return;
    let raf = 0;
    try {
      if (!audioGraph.current || audioGraph.current.el !== v) {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const src = ctx.createMediaElementSource(v);
        const an = ctx.createAnalyser(); an.fftSize = 256; an.smoothingTimeConstant = 0.82;
        src.connect(an); an.connect(ctx.destination);
        audioGraph.current = { el: v, an, ctx };
      }
      audioGraph.current.ctx.resume?.();
      const { an } = audioGraph.current; const data = new Uint8Array(an.frequencyBinCount);
      const tick = () => { an.getByteFrequencyData(data); let s = 0; for (let i = 0; i < 10; i++) s += data[i]; energy.set(s / 10 / 255); raf = requestAnimationFrame(tick); };
      tick();
    } catch { /* idle */ }
    return () => cancelAnimationFrame(raf);
  }, [isAudio, playing, reduce, energy, activeVideoSource]);

  /* keyboard. Plain ←/→ stay free for the modal's previous/next file; J/L or Shift+arrow seek. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && menuOpenRef.current) { e.preventDefault(); e.stopPropagation(); setMenuOpen(false); return; }
      const el = e.target as HTMLElement | null;
      if (!videoRef.current || (transcodeState !== 'ready' && isUnsupportedContainer)) return;
      if (el?.closest('input, textarea, [contenteditable="true"]')) return;
      const k = e.key.toLowerCase();
      const onControl = !!el?.closest('button, [role="slider"], [role="menuitem"]');
      if ((k === ' ' && onControl) || (k === 'enter' && onControl)) return;
      wakeControls();
      if (k === ' ' || k === 'k') { e.preventDefault(); togglePlay(true); }
      else if (k === 'l' || (k === 'arrowright' && e.shiftKey)) { e.preventDefault(); seekBy(10); }
      else if (k === 'j' || (k === 'arrowleft' && e.shiftKey)) { e.preventDefault(); seekBy(-10); }
      else if (k === 'arrowup') { e.preventDefault(); setVol(clamp01((videoRef.current?.volume ?? 1) + 0.05)); }
      else if (k === 'arrowdown') { e.preventDefault(); setVol(clamp01((videoRef.current?.volume ?? 1) - 0.05)); }
      else if (k === 'm') toggleMute();
      else if (k === 'f' && !isAudio) toggleFs();
      else if (k === 'c') { e.preventDefault(); setText(activeTextRef.current >= 0 ? -1 : (textTracks[0]?.index ?? -1)); }
      else if (k === 'i') { e.preventDefault(); setShowStats((s) => !s); }
      else if (k === 'p' && canPip) { e.preventDefault(); togglePiP(); }
      else if (k === '[' || k === '<') { e.preventDefault(); setSpeed(SPEEDS[Math.max(0, SPEEDS.indexOf(playbackSpeed) - 1)]); }
      else if (k === ']' || k === '>') { e.preventDefault(); setSpeed(SPEEDS[Math.min(SPEEDS.length - 1, SPEEDS.indexOf(playbackSpeed) + 1)]); }
      else if (k === 'home') { e.preventDefault(); if (videoRef.current) videoRef.current.currentTime = 0; }
      else if (k === 'end') { e.preventDefault(); if (videoRef.current?.duration) videoRef.current.currentTime = videoRef.current.duration; }
      else if (/^[0-9]$/.test(k) && videoRef.current?.duration) { e.preventDefault(); videoRef.current.currentTime = (Number(k) / 10) * videoRef.current.duration; }
    };
    window.addEventListener('keydown', onKey, true);   // capture: lets an open menu swallow Esc before the modal sees it
    return () => window.removeEventListener('keydown', onKey, true);
  }, [wakeControls, togglePlay, seekBy, setVol, toggleMute, toggleFs, transcodeState, isUnsupportedContainer, isAudio, textTracks, playbackSpeed, canPip]);

  /* ── Surface input ──
     mouse: click = play/pause, double-click = zone seek.
     touch: tap = UI, double-tap = zone seek / play, horizontal drag = scrub,
            vertical drag left = brightness / right = volume, pinch = zoom. */
  const zoneAction = (x: number, w: number) => {
    if (x < w / 3) seekBy(-10);
    else if (x > (w * 2) / 3) seekBy(10);
    else if (isAudio) togglePlay(true);
    else toggleFs();
  };
  const onSurfaceClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const pt = (e.nativeEvent as PointerEvent).pointerType;
    if (pt === 'touch' || pt === 'pen') return;
    if (menuOpen) { setMenuOpen(false); return; }
    clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => togglePlay(true), 210);
  };
  const onSurfaceDouble = (e: React.MouseEvent<HTMLDivElement>) => {
    const pt = (e.nativeEvent as PointerEvent).pointerType;
    if (pt === 'touch' || pt === 'pen') return;
    clearTimeout(tapTimer.current);
    const r = e.currentTarget.getBoundingClientRect();
    zoneAction(e.clientX - r.left, r.width);
  };
  const onControl = (t: EventTarget | null) => !!(t as HTMLElement)?.closest?.('button, [role="slider"], [role="menuitem"], [data-cbp-ui]');
  const showGesture = (kind: string, value: string) => setGesture({ kind, value, id: ++fxId.current });
  const clearGesture = () => window.setTimeout(() => setGesture(null), 700);
  const pendingSeek = useRef(0);
  const uiAtDown = useRef(false);

  const onTouchDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' || onControl(e.target) || menuOpen) return;
    // Remember whether the chrome was already up BEFORE wakeControls flips it —
    // the tap handler uses this to decide show vs hide. Reading uiRef later
    // (after the state update) always sees "visible" and made the HUD flash.
    uiAtDown.current = uiRef.current;
    wakeControls();
    const t = touch.current, r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    if (t.id !== -1) {                               // second finger → pinch
      t.mode = 'pinch'; t.pinch = Math.max(20, Math.hypot(px - t.x, py - t.y)); t.pinchStart = zoom;
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* noop */ }
      return;
    }
    t.id = e.pointerId; t.startX = t.x = px; t.startY = t.y = py; t.t = performance.now();
    t.mode = 'none'; t.moved = false; t.startVol = volume; t.startBright = brightness;
    t.startSec = videoRef.current?.currentTime || 0;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* noop */ }
  };
  const onTouchMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const t = touch.current; if (t.id === -1 || e.pointerType === 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    if (t.mode === 'pinch') {
      const z = Math.min(3, Math.max(1, (Math.hypot(px - t.x, py - t.y) / t.pinch) * t.pinchStart));
      setZoom(z); showGesture('zoom', `${z.toFixed(1)}×`); return;
    }
    const dx = px - t.startX, dy = py - t.startY;
    if (!t.moved && Math.hypot(dx, dy) > 14) {
      t.moved = true;
      t.mode = Math.abs(dx) > Math.abs(dy) * 1.1 ? 'seek' : (t.startX < r.width / 2 ? 'brightness' : 'volume');
    }
    if (t.mode === 'seek') {
      const target = Math.max(0, Math.min(duration || 0, t.startSec + (dx / r.width) * (duration || 0) * 1.5));
      pendingSeek.current = target; showGesture('seek', `${fmt(target)} / ${fmt(duration)}`);
    } else if (t.mode === 'volume') {
      const v = Math.max(0, Math.min(1, t.startVol - dy / 180));
      setVol(v); showGesture('volume', `${Math.round(v * 100)}%`);
    } else if (t.mode === 'brightness') {
      const b = Math.max(0.2, Math.min(1, t.startBright - dy / 220));
      setBrightness(b); showGesture('brightness', `${Math.round(b * 100)}%`);
    }
  };
  const onTouchUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const t = touch.current; if (t.id === -1 || e.pointerType === 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    if (t.mode === 'pinch') { if (zoom < 1.4) setZoom(1); clearGesture(); t.id = -1; return; }
    if (t.moved) {
      if (t.mode === 'seek' && pendingSeek.current) {
        const v = videoRef.current; if (v) v.currentTime = pendingSeek.current;
        showGesture('seek', fmt(pendingSeek.current)); pendingSeek.current = 0;
      }
      clearGesture(); t.id = -1; return;
    }
    t.id = -1;
    const x = e.clientX - r.left, now = performance.now();
    if (now - lastTap.current < 300) {
      clearTimeout(tapTimer.current); lastTap.current = 0;
      if (zoom > 1.4) setZoom(1); else zoneAction(x, r.width);
      return;
    }
    lastTap.current = now;
    if (uiAtDown.current && playing) {
      clearTimeout(hideTimerRef.current);
      setControlsVisible(false);
    } else {
      wakeControls();
    }
  };

  useEffect(() => { if (!flash) return; const t = setTimeout(() => setFlash(null), 650); return () => clearTimeout(t); }, [flash]);
  useEffect(() => { if (!seekFx) return; const t = setTimeout(() => setSeekFx(null), 650); return () => clearTimeout(t); }, [seekFx]);
  useEffect(() => {   // outside click closes the menu
    if (!menuOpen) return;
    const f = (e: PointerEvent) => { if (!(e.target as HTMLElement).closest('[data-cbp-menu], [data-cbp-more]')) setMenuOpen(false); };
    window.addEventListener('pointerdown', f, true);
    return () => window.removeEventListener('pointerdown', f, true);
  }, [menuOpen]);

  const onHudMove = (e: React.PointerEvent<HTMLElement>) => {   // specular highlight follows the pointer
    if (e.pointerType === 'touch') return;
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
    e.currentTarget.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
  };

  /* ── error / transcode stages ── */
  if (hasError) {
    return (
      <Stage className={className} reduce={reduce}>
        <span className="cbp-card-ico"><Ic.Alert size={26} /></span>
        <h3>Stream interrupted</h3>
        <p>{errorMessage || 'The encrypted stream could not be loaded after multiple attempts.'}</p>
        {isLargeFile && <p className="cbp-dim">Large file · {fmtSize(file.size)} · chunked decryption</p>}
        <div className="cbp-actions">
          <button type="button" className="cbp-pill" onClick={() => handleRetry()}><Ic.Retry size={17} />Retry</button>
          <button type="button" className="cbp-pill cbp-quiet" onClick={retryWithBackoff}>Auto retry</button>
        </div>
        {retryCount > 0 && <p className="cbp-dim">Attempt {retryCount + 1}</p>}
      </Stage>
    );
  }
  if (isUnsupportedContainer && transcodeState !== 'ready') {
    return (
      <Stage className={className} reduce={reduce}>
        <span className="cbp-card-ico"><Ic.Chip size={26} /></span>
        <h3>Convert to play</h3>
        <p>Browsers can’t play <b>{file.name.split('.').pop()?.toUpperCase()}</b> natively. SquidCloud can convert it on this device with WebAssembly — nothing leaves your machine.</p>
        {transcodeState === 'idle' ? (
          <div className="cbp-actions"><button type="button" className="cbp-pill" onClick={startLocalTranscoding}>Convert &amp; play</button></div>
        ) : (
          <div className="cbp-prog">
            <div className="cbp-prog-top"><span>{transcodeMessage}</span><b>{transcodeProgress}%</b></div>
            <div className="cbp-prog-bar"><motion.span animate={{ scaleX: transcodeProgress / 100 }} transition={SOFT} /></div>
          </div>
        )}
      </Stage>
    );
  }

  const volLevel: 0 | 1 | 2 | 3 = muted || volume === 0 ? 0 : volume < 0.34 ? 1 : volume < 0.67 ? 2 : 3;
  const T = reduce ? { duration: 0.01 } : JELLY;
  const ticks = chapters.length > 1 && duration ? chapters.slice(1).map((c) => c.time / duration) : undefined;
  const bufFrac = duration ? bufferedEnd / duration : 0;
  const tip = (f: number) => {
    const t = f * duration; const ch = chapters.length > 1 ? [...chapters].reverse().find((c) => t >= c.time) : null;
    return ch ? `${fmt(t)} · ${ch.label}` : fmt(t);
  };
  const menuEl = menuOpen && (
    <Menu page={menuPage} dir={menuDir.current} go={go} compact={compact} reduce={reduce}
      speed={playbackSpeed} setSpeed={(s) => { setSpeed(s); go('root'); }}
      quality={quality} setQuality={setQuality} sourceQuality={sourceQuality}
      audioTracks={audioTracks} activeAudio={activeAudioTrack} setAudio={(i) => { setAudio(i); go('root'); }}
      textTracks={textTracks} activeText={activeTextTrack} setText={(i) => { setText(i); go('root'); }} onLoadSubs={() => subsInput.current?.click()}
      canPip={canPip} onPip={togglePiP} stats={showStats} toggleStats={() => setShowStats((s) => !s)} />
  );
  const playGlyph = (size: number) => (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span key={playing ? 'p' : 'q'} style={{ display: 'grid' }} initial={reduce ? false : { scale: 0.5, rotate: -25, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={T}>
        {playing ? <Ic.Pause size={size} /> : <Ic.Play size={size} />}
      </motion.span>
    </AnimatePresence>
  );

  return (
    <div ref={setRoot}
      className={cn('cbp-root', isAudio && 'cbp-audio', !ui && playing && 'cbp-idle', className)}
      data-compact={compact} onPointerMove={(e) => { if (e.pointerType === 'mouse') wakeControls(); }}
      onPointerDown={onTouchDown} onPointerMoveCapture={onTouchMove} onPointerUp={onTouchUp} onPointerCancel={onTouchUp}
      onClick={onSurfaceClick} onDoubleClick={onSurfaceDouble}>
      <style>{CSS}</style>
      <input ref={subsInput} type="file" accept=".srt,.vtt,text/vtt,application/x-subrip" className="cbp-file" tabIndex={-1}
        onChange={(e) => loadSubtitles(e.target.files)} />

      {activeVideoSource && (
        <video key={activeVideoSource} ref={videoRef} src={activeVideoSource} className="cbp-video"
          style={{ ...(isAudio ? { opacity: 0 } : {}), transform: `scale(${zoom})` }}
          poster={isAudio ? undefined : poster} playsInline preload="auto" autoPlay={autoPlay}
          onError={(e) => {
            console.error('Video playback error:', e);
            if (streamReadyRef.current) {
              if (retryCount < 8) {
                const delay = Math.min(500 * Math.pow(1.5, retryCount), 5000);
                retryTimerRef.current = setTimeout(() => handleRetry(false), delay);
              } else { setHasErrorTracked(true); setBuffering(false); setLoadPhase('error'); }
            }
          }}
          onLoadedMetadata={() => {
            const v = videoRef.current; if (!v) return;
            setDuration(v.duration || 0);
            if (resumeAt.current > 0) { try { v.currentTime = resumeAt.current; } catch { /* not seekable yet */ } resumeAt.current = 0; }
            if (v.readyState >= 2) { setBuffering(false); setLoadPhase('ready'); }
            const at: Track[] = []; const a: any = (v as any).audioTracks;
            for (let i = 0; i < (a?.length || 0); i++) at.push({ index: i, language: a[i].language || 'und', label: a[i].label || a[i].language || `Track ${i + 1}` });
            setAudioTracks(at);
            const tt: Track[] = [];
            for (let i = 0; i < v.textTracks.length; i++) {
              const t = v.textTracks[i];
              tt.push({ index: i, language: t.language || 'und', label: t.label || t.language || `Subtitle ${i + 1}` });
              t.mode = 'hidden'; t.addEventListener('cuechange', updateCue);
            }
            setTextTracks(tt);
            setStats((s) => ({ ...s, resolution: v.videoWidth && v.videoHeight ? `${v.videoWidth}×${v.videoHeight}` : 'N/A', width: v.videoWidth || 0, height: v.videoHeight || 0 }));
          }}
          onLoadedData={() => { setBuffering(false); setLoadPhase('ready'); }}
          onCanPlay={() => { setBuffering(false); setLoadPhase('ready'); }}
          onCanPlayThrough={() => { setBuffering(false); setLoadPhase('ready'); }}
          onTimeUpdate={() => {
            const v = videoRef.current; if (!v) return;
            setCurrentTime(v.currentTime);
            if (!scrubRef.current && v.duration) prog.set(v.currentTime / v.duration);
            if (v.buffered.length) setBufferedEnd(v.buffered.end(v.buffered.length - 1));
            if (v.currentTime > 0 && buffering) { setBuffering(false); setLoadPhase('ready'); }
            const q = (v as any).getVideoPlaybackQuality?.();
            if (q && showStats) setStats((s) => (s.dropped === q.droppedVideoFrames ? s : { ...s, dropped: q.droppedVideoFrames }));
          }}
          onProgress={() => {
            const v = videoRef.current; if (!v || !v.buffered.length) return;
            const end = v.buffered.end(v.buffered.length - 1);
            setBufferedEnd(end);
            if (isLargeFile && duration > 0) setLoadProgress(Math.min(100, Math.round((end / duration) * 100)));
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => { setPlaying(false); setControlsVisible(true); }}
          onWaiting={() => { if (videoRef.current && videoRef.current.readyState < 3) setBuffering(true); }}
          onSeeking={() => setBuffering(true)}
          onSeeked={() => setBuffering(false)}
          onVolumeChange={() => { const v = videoRef.current; if (v) { setMuted(v.muted); setVolume(v.volume); volMV.set(v.muted ? 0 : v.volume); } }}
        />
      )}

      {/* audio stage: ambient glass orb that breathes with the signal */}
      {isAudio && (
        <div className="cbp-art" aria-hidden="true">
          <motion.div className="cbp-orb" style={{ scale: orbScale }} data-playing={playing}>
            <span className="cbp-orb-a" /><span className="cbp-orb-b" />
            {poster && <img src={poster} alt="" draggable={false} />}
          </motion.div>
        </div>
      )}
      {isAudio && (
        <div className="cbp-meta">
          <motion.h2 key={title} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={SOFT}>{title}</motion.h2>
          <p>{(file.type?.split('/')[1] || file.name.split('.').pop() || 'audio').toUpperCase()} · {fmtSize(file.size)}</p>
        </div>
      )}

      {/* soft scrim so the glass stays legible over bright frames */}
      {!isAudio && <motion.div className="cbp-scrim" initial={false} animate={{ opacity: ui ? 1 : 0 }} transition={{ duration: 0.35 }} />}
      {/* brightness veil — vertical swipe on the left half */}
      {brightness < 1 && <div className="cbp-bright" style={{ opacity: 1 - brightness }} />}

      {/* gesture readout */}
      <AnimatePresence>
        {gesture && (
          <motion.div key={gesture.id} className="cbp-gesture cbp-glass" data-kind={gesture.kind}
            initial={{ opacity: 0, scale: 0.82, x: '-50%', y: '-50%' }} animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }} exit={{ opacity: 0, scale: 0.9, x: '-50%', y: '-50%' }} transition={POP}>
            {gesture.kind === 'seek' && <Ic.Wave size={17} />}
            {gesture.kind === 'volume' && <Ic.Vol level={3} size={18} />}
            {gesture.kind === 'brightness' && <Ic.Sun size={18} />}
            {gesture.kind === 'zoom' && <Ic.Zoom size={18} />}
            {gesture.kind === 'quality' && <Ic.Gauge size={18} />}
            {gesture.kind === 'subs' && <Ic.Cc size={18} />}
            <span>{gesture.value}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* buffering: a small glass droplet with a ring */}
      <AnimatePresence>
        {buffering && (
          <motion.div className="cbp-wait" initial={{ opacity: 0, scale: 0.6, x: '-50%', y: '-50%' }} animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }} exit={{ opacity: 0, scale: 0.7, x: '-50%', y: '-50%' }} transition={T}>
            <span className="cbp-spin cbp-glass"><svg viewBox="0 0 40 40" width="40" height="40"><circle cx="20" cy="20" r="14" /></svg></span>
            {isLargeFile && loadPhase !== 'ready' && (
              <span className="cbp-waitlab">
                {loadPhase === 'decrypting' ? 'Decrypting' : loadPhase === 'buffering' ? 'Buffering' : 'Opening encrypted stream'}
                {loadProgress > 0 ? ` · ${loadProgress}%` : ''}
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* gesture feedback */}
      <AnimatePresence>
        {flash && !buffering && (
          <motion.div key={flash.id} className="cbp-flash cbp-glass" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.35 }} transition={POP}>
            {flash.playing ? <Ic.Play size={34} /> : <Ic.Pause size={34} />}
          </motion.div>
        )}
        {seekFx && (
          <motion.div key={seekFx.id} className={cn('cbp-seekfx cbp-glass')} data-side={seekFx.side}
            initial={{ opacity: 0, scale: 0.6, x: seekFx.side === 'left' ? 16 : -16 }} animate={{ opacity: 1, scale: 1, x: 0 }} exit={{ opacity: 0, scale: 0.8 }} transition={POP}>
            {seekFx.side === 'left' ? <Ic.Back size={30} /> : <Ic.Fwd size={30} />}
          </motion.div>
        )}
      </AnimatePresence>

      {/* subtitles: soft white, no box; ride above the HUD while it is visible */}
      <AnimatePresence>
        {cue && (
          <motion.div className="cbp-cue" initial={{ opacity: 0 }} animate={{ opacity: 1, bottom: ui ? (compact ? 112 : 148) : 36 }} exit={{ opacity: 0 }} transition={SOFT}>
            <span>{cue}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* playback info */}
      <AnimatePresence>
        {showStats && (
          <motion.div className="cbp-stats cbp-glass" data-compact={compact} onClick={stop} onDoubleClick={stop}
            initial={{ opacity: 0, scale: 0.9, y: -8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92 }} transition={POP}>
            {([
              ['Resolution', stats.resolution || '—'], ['Dropped frames', String(stats.dropped)],
              ['Buffered', `${Math.max(0, bufferedEnd - currentTime).toFixed(1)}s ahead`], ['Speed', `${playbackSpeed}×`],
              ['Audio', audioTracks.find((t) => t.index === activeAudioTrack)?.label || 'Default'],
              ['Subtitles', activeTextTrack >= 0 ? textTracks.find((t) => t.index === activeTextTrack)?.label || 'On' : 'Off'],
              ['Retries', String(retryCount)],
            ] as const).map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── mobile: glass buttons top-right + centred transport ── */}
      {compact && (
        <>
          <AnimatePresence>
            {ui && (
              <motion.div className="cbp-top" data-cbp-ui onClick={stop} onDoubleClick={stop}
                initial={reduce ? false : { opacity: 0, y: -14, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.94 }} transition={T}>
                <div className="cbp-topbar cbp-glass" data-cbp-ui onPointerMove={onHudMove}>
                  {!isAudio && <Btn reduce={reduce} label={fullscreen ? 'Exit full screen' : 'Full screen'} onClick={toggleFs}>{fullscreen ? <Ic.Exit size={20} /> : <Ic.Full size={20} />}</Btn>}
                  <span data-cbp-more><Btn reduce={reduce} label="More" on={menuOpen} onClick={toggleMenu}><Ic.More size={20} /></Btn></span>
                </div>
                <AnimatePresence>{menuEl}</AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {ui && !buffering && (
              <motion.div className="cbp-center" data-cbp-ui onClick={stop} onDoubleClick={stop} initial="h" animate="s" exit="h"
                variants={{ h: { opacity: 0, scale: 0.7, x: '-50%', y: '-50%' }, s: { opacity: 1, scale: 1, x: '-50%', y: '-50%', transition: { staggerChildren: 0.04 } } }} transition={T}>
                <motion.span variants={{ h: { x: 18, opacity: 0 }, s: { x: 0, opacity: 1 } }} transition={T}><Btn reduce={reduce} size={56} label="Back 10 seconds" onClick={() => seekBy(-10)}><Ic.Back size={34} /></Btn></motion.span>
                <motion.span variants={{ h: { scale: 0.6, opacity: 0 }, s: { scale: 1, opacity: 1 } }} transition={T}>
                  <motion.button type="button" className="cbp-bigplay cbp-glass" aria-label={playing ? 'Pause' : 'Play'} onPointerMove={onHudMove}
                    onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                    whileTap={reduce ? undefined : { scaleX: 0.9, scaleY: 0.82 }} transition={T}>{playGlyph(34)}</motion.button>
                </motion.span>
                <motion.span variants={{ h: { x: -18, opacity: 0 }, s: { x: 0, opacity: 1 } }} transition={T}><Btn reduce={reduce} size={56} label="Forward 10 seconds" onClick={() => seekBy(10)}><Ic.Fwd size={34} /></Btn></motion.span>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* ── bottom: QuickTime HUD (desktop) / scrubber capsule (mobile) ── */}
      <AnimatePresence>
        {ui && (
          <motion.div className="cbp-bottom" data-cbp-ui onClick={stop} onDoubleClick={stop}
            initial={reduce ? false : { opacity: 0, y: 30, scaleX: 0.94, scaleY: 0.8 }} animate={{ opacity: 1, y: 0, scaleX: 1, scaleY: 1 }}
            exit={{ opacity: 0, y: 22, scaleX: 0.96, scaleY: 0.88 }} transition={T} style={{ transformOrigin: '50% 100%' }}>
            <div className="cbp-stack">
              {!compact && <AnimatePresence>{menuEl}</AnimatePresence>}
              {compact && <div className="cbp-title">{title}</div>}
              <div className="cbp-hud cbp-glass" data-cbp-ui onPointerMove={onHudMove}>
                {!compact && (
                  <div className="cbp-row1">
                    <div className="cbp-left">
                      <Btn reduce={reduce} label={muted ? 'Unmute' : 'Mute'} size={34} onClick={toggleMute}><Ic.Vol level={volLevel} size={21} /></Btn>
                      <div className="cbp-vol"><JellySlider value={volMV} onChange={(f) => setVol(f)} label="Volume" thick={4} hit={28} reduce={reduce} /></div>
                    </div>
                    <div className="cbp-mid">
                      <Btn reduce={reduce} label="Back 10 seconds" onClick={() => seekBy(-10)}><Ic.Back size={26} /></Btn>
                      <Btn reduce={reduce} label={playing ? 'Pause' : 'Play'} size={46} onClick={() => togglePlay()}>{playGlyph(28)}</Btn>
                      <Btn reduce={reduce} label="Forward 10 seconds" onClick={() => seekBy(10)}><Ic.Fwd size={26} /></Btn>
                    </div>
                    <div className="cbp-right">
                      {canPip && <Btn reduce={reduce} label="Picture in Picture" size={36} onClick={togglePiP}><Ic.Pip size={21} /></Btn>}
                      {!isAudio && <Btn reduce={reduce} label={fullscreen ? 'Exit full screen' : 'Full screen'} size={36} onClick={toggleFs}>{fullscreen ? <Ic.Exit size={21} /> : <Ic.Full size={21} />}</Btn>}
                      <span data-cbp-more><Btn reduce={reduce} label="More" size={36} on={menuOpen} onClick={toggleMenu}><Ic.More size={21} /></Btn></span>
                    </div>
                  </div>
                )}
                <div className="cbp-row2">
                  <span className="cbp-time">{fmt(currentTime)}</span>
                  <JellySlider value={prog} onChange={onScrub} label="Seek" thick={compact ? 5 : 5} hit={compact ? 36 : 28} reduce={reduce}
                    buffered={bufFrac} ticks={ticks} tip={compact ? undefined : tip} step={duration ? 5 / duration : 0.02} />
                  <button type="button" className="cbp-time cbp-remain" title="Toggle remaining / total" onClick={(e) => { e.stopPropagation(); setShowTotal((s) => !s); }}>
                    {showTotal ? fmt(duration) : `−${fmt(Math.max(0, duration - currentTime))}`}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

function useCompact(el: HTMLElement | null) {
  const [c, setC] = useState(false);
  useEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setC(e.contentRect.width < 640));
    ro.observe(el); setC(el.clientWidth < 640);
    return () => ro.disconnect();
  }, [el]);
  return c;
}

/* ── Styles: liquid glass = translucent fill + heavy blur/saturation + inner highlights + pointer specular ── */
const CSS = `
.cbp-root { --ink: #e8e7e1; --ink-dim: rgba(232,231,225,.58); position: relative; width: 100%; height: 100%; overflow: hidden; background: #000;
  color: var(--ink); font-family: var(--sa-f, 'Hanken Grotesk', system-ui, -apple-system, sans-serif); -webkit-font-smoothing: antialiased;
  user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent; touch-action: none; }
.cbp-root.cbp-idle { cursor: none; }
.cbp-stage { display: grid; place-items: center; padding: 24px; background: var(--sa-bg, #0b0c0a); }
.cbp-video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; background: #000; }
.cbp-audio { background: radial-gradient(120% 90% at 50% 0%, #1b1d18 0%, #0b0c0a 70%); }

/* neutral dock glass: clean frosted surface, no sheen and no grain */
.cbp-glass { position: relative; isolation: isolate;
  background: linear-gradient(180deg, rgba(38,39,35,.8), rgba(14,15,12,.88));
  -webkit-backdrop-filter: blur(30px) saturate(150%); backdrop-filter: blur(30px) saturate(150%);
  box-shadow: inset 0 1px 0 rgba(232,231,225,.12), inset 0 -1px 0 rgba(0,0,0,.4), inset 0 0 0 1px rgba(232,231,225,.06),
    0 20px 50px -18px rgba(0,0,0,.78), 0 2px 8px rgba(0,0,0,.3); }
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) { .cbp-glass { background: rgba(18,19,16,.94); } }

.cbp-scrim { position: absolute; inset: 0; pointer-events: none; background: linear-gradient(0deg, rgba(0,0,0,.5), transparent 38%), linear-gradient(180deg, rgba(0,0,0,.28), transparent 22%); }
.cbp-root[data-compact="true"] .cbp-scrim { background: rgba(0,0,0,.3); }

/* bottom HUD */
.cbp-bottom { position: absolute; left: 0; right: 0; bottom: max(18px, env(safe-area-inset-bottom)); display: flex; justify-content: center; padding: 0 16px; pointer-events: none; z-index: 20; }
.cbp-stack { position: relative; width: min(640px, 100%); pointer-events: auto; }
.cbp-hud { border-radius: 24px; padding: 12px 18px 8px; }
.cbp-root[data-compact="true"] .cbp-hud { border-radius: 22px; padding: 4px 16px; }
.cbp-row1 { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; }
.cbp-left { display: flex; align-items: center; gap: 6px; }
.cbp-mid { display: flex; align-items: center; gap: 10px; }
.cbp-right { display: flex; align-items: center; justify-content: flex-end; gap: 2px; }
.cbp-vol { width: 84px; }
.cbp-row2 { display: flex; align-items: center; gap: 12px; }
.cbp-time { flex: none; min-width: 44px; font: 500 12px/1 var(--sa-f, 'Hanken Grotesk', system-ui, sans-serif); font-variant-numeric: tabular-nums; color: var(--ink-dim); letter-spacing: .01em; }
.cbp-remain { padding: 6px 0; border: 0; background: none; text-align: right; cursor: pointer; transition: color .2s; }
.cbp-remain:hover { color: var(--ink); }
.cbp-title { margin: 0 6px 10px; font: 600 15px/1.25 inherit; letter-spacing: -.01em; text-shadow: 0 1px 12px rgba(0,0,0,.6); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; pointer-events: none; }

/* buttons */
.cbp-btn { display: grid; place-items: center; flex: none; padding: 0; border: 0; border-radius: 999px; background: transparent; color: var(--ink); cursor: pointer;
  transition: background .2s, color .2s; scale: none; }
.cbp-btn:hover { background: rgba(232,231,225,.11); }
.cbp-btn[data-on="true"] { background: rgba(232,231,225,.17); }
.cbp-btn:focus-visible, .cbp-row:focus-visible, .cbp-pill:focus-visible, .cbp-slider:focus-visible, .cbp-remain:focus-visible, .cbp-bigplay:focus-visible { outline: 2px solid rgba(232,231,225,.85); outline-offset: 2px; }

/* slider */
.cbp-slider { position: relative; flex: 1; min-width: 0; display: flex; align-items: center; cursor: pointer; touch-action: none; outline: none; }
.cbp-track { position: relative; width: 100%; border-radius: 999px; background: rgba(232,231,225,.18); overflow: hidden; }
.cbp-buf { position: absolute; inset: 0 auto 0 0; background: rgba(232,231,225,.16); }
.cbp-fill { position: absolute; inset: 0; transform-origin: left; background: rgba(232,231,225,.82); border-radius: inherit; }
.cbp-tick { position: absolute; top: 0; bottom: 0; width: 2px; background: rgba(0,0,0,.45); }
.cbp-thumbpos { position: absolute; top: 50%; width: 0; height: 0; }
.cbp-thumb { display: block; width: 16px; height: 16px; margin: -8px 0 0 -8px; border-radius: 999px; background: #e8e7e1; box-shadow: 0 2px 8px rgba(0,0,0,.45), inset 0 -1px 2px rgba(0,0,0,.12); }
.cbp-root[data-compact="true"] .cbp-thumb { width: 20px; height: 20px; margin: -10px 0 0 -10px; }
.cbp-tip { position: absolute; bottom: calc(100% + 6px); transform: translateX(-50%); padding: 6px 10px; border-radius: 999px; white-space: nowrap; pointer-events: none;
  font: 500 12px/1 var(--sa-f, system-ui, sans-serif); font-variant-numeric: tabular-nums; background: rgba(26,27,24,.92); box-shadow: inset 0 1px 0 rgba(232,231,225,.14), 0 8px 20px -8px rgba(0,0,0,.7); }

/* menu */
.cbp-menu { position: absolute; z-index: 5; min-width: 232px; padding: 6px; border-radius: 18px; }
.cbp-menu:not([data-compact="true"]) { right: 0; bottom: calc(100% + 12px); }
.cbp-menu[data-compact="true"] { position: relative; min-width: 224px; }
.cbp-row { display: flex; align-items: center; gap: 8px; width: 100%; height: 36px; padding: 0 10px 0 8px; border: 0; border-radius: 11px; background: none; color: var(--ink); font: 500 13.5px/1 inherit; text-align: left; cursor: pointer; transition: background .15s; }
.cbp-root[data-compact="true"] .cbp-row { height: 44px; font-size: 15px; }
.cbp-row:hover { background: rgba(232,231,225,.11); }
.cbp-rowchk { display: grid; place-items: center; width: 18px; flex: none; }
.cbp-rowico { display: grid; place-items: center; width: 20px; flex: none; color: var(--ink-dim); }
.cbp-rowlab { flex: 1; padding-left: 4px; }
.cbp-rowchk + .cbp-rowlab { padding-left: 0; }
.cbp-rowval { color: var(--ink-dim); font-size: 12.5px; }
.cbp-row svg { flex: none; opacity: .8; }
.cbp-note { padding: 4px 10px 6px; font: 400 10.5px/1.4 var(--sa-mono, ui-monospace, monospace); color: var(--ink-dim); }
.cbp-back { font-weight: 600; }
.cbp-back .cbp-rowlab { padding-left: 2px; }
.cbp-sep { height: 1px; margin: 5px 8px; background: rgba(232,231,225,.1); }

/* mobile chrome */
.cbp-top { position: absolute; top: max(14px, env(safe-area-inset-top)); right: max(14px, env(safe-area-inset-right)); z-index: 20; display: flex; flex-direction: column; align-items: flex-end; gap: 10px; }
.cbp-topbar { display: flex; gap: 2px; padding: 4px; border-radius: 999px; }
.cbp-center { position: absolute; left: 50%; top: 50%; z-index: 15; display: flex; align-items: center; gap: 22px; }
.cbp-center > span { display: grid; }
.cbp-bigplay { display: grid; place-items: center; width: 76px; height: 76px; padding: 0; border: 0; border-radius: 999px; color: var(--ink); cursor: pointer; }

/* feedback */
.cbp-wait { position: absolute; left: 50%; top: 50%; z-index: 12; display: grid; justify-items: center; gap: 12px; pointer-events: none; }
.cbp-spin { display: grid; place-items: center; width: 64px; height: 64px; border-radius: 999px; }
.cbp-spin svg { animation: cbp-rot 1s linear infinite; }
.cbp-spin circle { fill: none; stroke: #e8e7e1; stroke-width: 2.4; stroke-linecap: round; stroke-dasharray: 56 88; }
@keyframes cbp-rot { to { transform: rotate(360deg); } }
.cbp-waitlab { font: 500 12px/1 inherit; color: var(--ink-dim); text-shadow: 0 1px 8px rgba(0,0,0,.6); }
.cbp-flash { position: absolute; left: 50%; top: 50%; z-index: 14; display: grid; place-items: center; width: 92px; height: 92px; margin: -46px 0 0 -46px; border-radius: 999px; pointer-events: none; }
.cbp-seekfx { position: absolute; top: 50%; z-index: 14; display: grid; place-items: center; width: 84px; height: 84px; margin-top: -42px; border-radius: 999px; pointer-events: none; }
.cbp-seekfx[data-side="left"] { left: 14%; } .cbp-seekfx[data-side="right"] { right: 14%; }
.cbp-bright { position: absolute; inset: 0; z-index: 4; pointer-events: none; background: #000; transition: opacity .08s linear; }
.cbp-gesture { position: absolute; left: 50%; top: 24%; z-index: 26; display: flex; align-items: center; gap: 10px;
  padding: 10px 16px; border-radius: 999px; pointer-events: none;
  font: 500 13px/1 var(--sa-f, system-ui, sans-serif); font-variant-numeric: tabular-nums; white-space: nowrap; }
.cbp-gesture svg { opacity: .8; }
.cbp-file { display: none; }
.cbp-cue { position: absolute; left: 0; right: 0; z-index: 10; display: flex; justify-content: center; padding: 0 6%; pointer-events: none; }
.cbp-cue span { max-width: 880px; text-align: center; white-space: pre-line; font: 600 clamp(16px, 2.3vw, 26px)/1.3 inherit; color: #e8e7e1;
  text-shadow: 0 1px 2px rgba(0,0,0,.9), 0 2px 14px rgba(0,0,0,.75); }
.cbp-stats { position: absolute; top: max(16px, env(safe-area-inset-top)); left: 16px; z-index: 25; min-width: 220px; padding: 12px 14px; border-radius: 16px; display: grid; gap: 7px; font-size: 12px; }
.cbp-stats[data-compact="true"] { top: auto; bottom: 120px; }
.cbp-stats > div { display: flex; justify-content: space-between; gap: 16px; }
.cbp-stats span { color: var(--ink-dim); } .cbp-stats b { font-weight: 500; font-variant-numeric: tabular-nums; }

/* audio stage */
.cbp-art { position: absolute; inset: 0; display: grid; place-items: center; padding-bottom: 12%; pointer-events: none; }
.cbp-orb { position: relative; width: min(46vmin, 340px); aspect-ratio: 1; border-radius: 32%; overflow: hidden; background: #151613;
  box-shadow: inset 0 1px 0 rgba(232,231,225,.16), 0 40px 90px -30px rgba(0,0,0,.9), 0 0 120px -34px rgba(190,195,205,.22); }
.cbp-orb-a, .cbp-orb-b { position: absolute; inset: -30%; border-radius: 50%; filter: blur(38px); opacity: .8; }
.cbp-orb-a { background: radial-gradient(circle at 30% 30%, #92958e 0, transparent 55%), radial-gradient(circle at 75% 70%, #b8b5ad 0, transparent 50%); animation: cbp-drift 14s ease-in-out infinite alternate paused; }
.cbp-orb-b { background: radial-gradient(circle at 70% 25%, #6f7580 0, transparent 50%), radial-gradient(circle at 25% 80%, #9a939c 0, transparent 52%); mix-blend-mode: screen; opacity: .5; animation: cbp-drift 19s ease-in-out infinite alternate-reverse paused; }
.cbp-orb[data-playing="true"] .cbp-orb-a, .cbp-orb[data-playing="true"] .cbp-orb-b { animation-play-state: running; }
.cbp-orb img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
@keyframes cbp-drift { from { transform: translate(-6%, -4%) rotate(0deg) scale(1); } to { transform: translate(7%, 5%) rotate(40deg) scale(1.18); } }
.cbp-meta { position: absolute; left: 0; right: 0; top: calc(50% + min(23vmin, 170px) + 22px); padding: 0 24px; text-align: center; pointer-events: none; }
.cbp-meta h2 { margin: 0; font: 600 clamp(18px, 2.6vw, 26px)/1.2 inherit; letter-spacing: -.015em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cbp-meta p { margin: 8px 0 0; font-size: 12.5px; color: var(--ink-dim); letter-spacing: .04em; }
.cbp-root[data-compact="true"].cbp-audio .cbp-center { top: 62%; }

/* error / transcode card */
.cbp-card { display: grid; justify-items: center; gap: 12px; width: min(420px, 100%); padding: 28px 26px 24px; border-radius: 26px; text-align: center; }
.cbp-card h3 { margin: 4px 0 0; font: 600 17px/1.2 inherit; letter-spacing: -.01em; }
.cbp-card p { margin: 0; font-size: 13px; line-height: 1.5; color: var(--ink-dim); }
.cbp-card p b { color: var(--ink); font-weight: 600; }
.cbp-dim { font-size: 11.5px !important; opacity: .75; }
.cbp-card-ico { display: grid; place-items: center; width: 56px; height: 56px; border-radius: 999px; background: rgba(232,231,225,.08); box-shadow: inset 0 1px 0 rgba(232,231,225,.16); }
.cbp-actions { display: flex; gap: 10px; margin-top: 6px; }
.cbp-pill { display: inline-flex; align-items: center; gap: 8px; height: 44px; padding: 0 22px; border: 1px solid rgba(232,231,225,.12); border-radius: 999px; background: rgba(232,231,225,.88); color: #10110f; font: 600 14px/1 inherit; cursor: pointer;
  transition: transform .5s cubic-bezier(.34,1.56,.64,1), background .2s; }
.cbp-pill:hover { transform: scale(1.04); } .cbp-pill:active { transform: scale(.94, .88); }
.cbp-pill.cbp-quiet { background: rgba(232,231,225,.1); color: var(--ink); }
.cbp-prog { width: 100%; display: grid; gap: 10px; margin-top: 6px; }
.cbp-prog-top { display: flex; justify-content: space-between; gap: 12px; font-size: 12px; color: var(--ink-dim); } .cbp-prog-top b { color: var(--ink); font-weight: 600; font-variant-numeric: tabular-nums; }
.cbp-prog-top span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cbp-prog-bar { height: 5px; border-radius: 999px; background: rgba(232,231,225,.14); overflow: hidden; }
.cbp-prog-bar span { display: block; height: 100%; transform-origin: left; background: #e8e7e1; border-radius: inherit; }

@media (prefers-reduced-motion: reduce) { .cbp-spin svg, .cbp-orb-a, .cbp-orb-b { animation: none !important; } .cbp-pill { transition-duration: .01ms; } }
`;

export default CBVideoPlayer;
