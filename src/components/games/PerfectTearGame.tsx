import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { 
  Scissors, 
  RotateCcw, 
  Volume2, 
  VolumeX, 
  Trophy, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle,
  ArrowRight
} from 'lucide-react';

interface Point {
  x: number;
  y: number;
}

interface PerfectTearGameProps {
  onClose?: () => void;
  onScoreSubmit?: (score: number) => void;
}

type ShapeType = 'circle' | 'wave' | 'zigzag' | 'crown' | 'arch';

export const PerfectTearGame: React.FC<PerfectTearGameProps> = ({ onClose, onScoreSubmit }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isCutting, setIsCutting] = useState(false);
  const [userPath, setUserPath] = useState<Point[]>([]);
  const [targetPath, setTargetPath] = useState<Point[]>([]);
  const [score, setScore] = useState<number | null>(null);
  const [highScore, setHighScore] = useState<number>(0);
  const [combo, setCombo] = useState<number>(0);
  const [currentShape, setCurrentShape] = useState<ShapeType>('wave');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [paperColor, setPaperColor] = useState<string>('#f3e5ab'); // Classic matte parchment

  // Web Audio Engine Ref for ASMR Paper Tearing Sound
  const audioCtxRef = useRef<AudioContext | null>(null);
  const noiseNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const lastPointRef = useRef<Point | null>(null);

  // Initialize Web Audio API
  const initAudio = () => {
    if (isMuted || audioCtxRef.current) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new AudioContextClass();
    } catch (e) {
      console.warn('Web Audio API not supported');
    }
  };

  // Play dynamic tearing sound based on movement speed
  const playTearSound = (velocity: number) => {
    if (isMuted || !audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();

    // Create 0.1s white noise buffer for realistic paper texture tear
    const bufferSize = ctx.sampleRate * 0.08;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    // Filter to give it a warm acoustic paper frequency
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = Math.min(800 + velocity * 40, 2400);
    filter.Q.value = 1.5;

    const gain = ctx.createGain();
    const volume = Math.min(velocity * 0.04, 0.35);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start();
  };

  // Generate target cutting shape based on canvas dimensions
  const generateShape = useCallback((shape: ShapeType, width: number, height: number): Point[] => {
    const points: Point[] = [];
    const padding = Math.min(width, height) * 0.18;
    const effW = width - padding * 2;
    const effH = height - padding * 2;
    const steps = 120;

    switch (shape) {
      case 'circle': {
        const radius = Math.min(effW, effH) * 0.42;
        const cx = width / 2;
        const cy = height / 2;
        for (let i = 0; i <= steps; i++) {
          const angle = (i / steps) * Math.PI * 2;
          points.push({
            x: cx + Math.cos(angle) * radius,
            y: cy + Math.sin(angle) * radius,
          });
        }
        break;
      }
      case 'wave': {
        const startX = padding;
        const startY = height / 2;
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          points.push({
            x: startX + t * effW,
            y: startY + Math.sin(t * Math.PI * 3) * (effH * 0.32),
          });
        }
        break;
      }
      case 'zigzag': {
        const segs = 6;
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const currentSeg = Math.floor(t * segs);
          const segT = (t * segs) % 1;
          const isUp = currentSeg % 2 === 0;
          points.push({
            x: padding + t * effW,
            y: height / 2 + (isUp ? segT - 0.5 : 0.5 - segT) * (effH * 0.65),
          });
        }
        break;
      }
      case 'crown': {
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const wave = Math.abs(Math.sin(t * Math.PI * 2.5));
          points.push({
            x: padding + t * effW,
            y: height * 0.75 - wave * (effH * 0.6),
          });
        }
        break;
      }
      case 'arch': {
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          points.push({
            x: padding + t * effW,
            y: height * 0.8 - Math.sin(t * Math.PI) * (effH * 0.7),
          });
        }
        break;
      }
    }
    return points;
  }, []);

  // Initialize Canvas and draw paper texture
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // 1. Draw Matte Paper Background
    ctx.fillStyle = paperColor;
    ctx.fillRect(0, 0, width, height);

    // 2. Draw subtle paper fiber grain texture
    ctx.fillStyle = 'rgba(0, 0, 0, 0.025)';
    for (let i = 0; i < width; i += 6) {
      for (let j = 0; j < height; j += 6) {
        if (Math.random() > 0.5) ctx.fillRect(i, j, 2, 2);
      }
    }

    // 3. Draw Target Perforated Cut Line
    if (targetPath.length > 1) {
      ctx.beginPath();
      ctx.setLineDash([8, 8]);
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.38)';
      ctx.moveTo(targetPath[0].x, targetPath[0].y);
      for (let i = 1; i < targetPath.length; i++) {
        ctx.lineTo(targetPath[i].x, targetPath[i].y);
      }
      ctx.stroke();

      // Draw start scissors indicator
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(targetPath[0].x, targetPath[0].y, 7, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Draw User Tearing Cut Line (Jagged Paper Edge Effect)
    if (userPath.length > 1) {
      ctx.beginPath();
      ctx.setLineDash([]);
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#1e293b'; // Dark shadow of torn seam
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(userPath[0].x, userPath[0].y);
      for (let i = 1; i < userPath.length; i++) {
        // Add slight procedural jaggedness to look like real paper fibers
        const jagsX = (Math.random() - 0.5) * 1.8;
        const jagsY = (Math.random() - 0.5) * 1.8;
        ctx.lineTo(userPath[i].x + jagsX, userPath[i].y + jagsY);
      }
      ctx.stroke();

      // Inside white fiber tear highlight
      ctx.beginPath();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#ffffff';
      ctx.moveTo(userPath[0].x, userPath[0].y);
      for (let i = 1; i < userPath.length; i++) {
        ctx.lineTo(userPath[i].x, userPath[i].y);
      }
      ctx.stroke();
    }
  }, [paperColor, targetPath, userPath]);

  // Handle window resizing cleanly
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const updateSize = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
        setTargetPath(generateShape(currentShape, canvas.width, canvas.height));
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [currentShape, generateShape]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // Compute Accuracy Score Algorithm
  const calculateScore = (user: Point[], target: Point[]) => {
    if (user.length < 15) return 0; // Too short

    let totalError = 0;
    const sampleCount = Math.min(user.length, 100);
    const step = Math.max(1, Math.floor(user.length / sampleCount));

    for (let i = 0; i < user.length; i += step) {
      const uPt = user[i];
      // Find closest point on target line
      let minDist = Infinity;
      for (const tPt of target) {
        const d = Math.hypot(uPt.x - tPt.x, uPt.y - tPt.y);
        if (d < minDist) minDist = d;
      }
      totalError += minDist;
    }

    const avgError = totalError / (user.length / step);
    const maxTolerance = 45; // Pixels off line that give 0 points
    const rawScore = Math.max(0, 100 * (1 - avgError / maxTolerance));
    return Math.round(rawScore * 10) / 10;
  };

  // Pointer Handlers (Works on Mouse & Touch seamlessly)
  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (score !== null) return;
    initAudio();
    setIsCutting(true);
    const pt = getCanvasPoint(e);
    setUserPath([pt]);
    lastPointRef.current = pt;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isCutting) return;
    const pt = getCanvasPoint(e);

    if (lastPointRef.current) {
      const dist = Math.hypot(pt.x - lastPointRef.current.x, pt.y - lastPointRef.current.y);
      if (dist > 3) {
        playTearSound(dist);
        setUserPath((prev) => [...prev, pt]);
        lastPointRef.current = pt;
      }
    }
  };

  const handlePointerUp = () => {
    if (!isCutting) return;
    setIsCutting(false);

    const finalScore = calculateScore(userPath, targetPath);
    setScore(finalScore);

    if (finalScore > highScore) setHighScore(finalScore);
    if (finalScore >= 90) setCombo((c) => c + 1);
    else setCombo(0);

    onScoreSubmit?.(finalScore);
  };

  const resetRound = (nextShape?: ShapeType) => {
    const shapeToUse = nextShape || currentShape;
    if (nextShape) setCurrentShape(nextShape);
    setUserPath([]);
    setScore(null);
    if (canvasRef.current) {
      setTargetPath(generateShape(shapeToUse, canvasRef.current.width, canvasRef.current.height));
    }
  };

  const cycleShape = () => {
    const shapes: ShapeType[] = ['wave', 'circle', 'zigzag', 'crown', 'arch'];
    const nextIdx = (shapes.indexOf(currentShape) + 1) % shapes.length;
    resetRound(shapes[nextIdx]);
  };

  return (
    <div className="flex flex-col w-full h-[520px] max-h-[85vh] bg-[#0f172a] text-white rounded-3xl border border-white/10 shadow-2xl overflow-hidden select-none">
      {/* Top Controls Bar */}
      <div className="flex items-center justify-between px-5 h-14 bg-neutral-900/90 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
            <Scissors className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-tight">The Perfect Tear</h3>
            <p className="text-[10px] text-neutral-400 font-mono">ASMR Paper Craft</p>
          </div>
        </div>

        {/* Stats Pills */}
        <div className="flex items-center gap-2">
          {combo > 1 && (
            <div className="px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-bold animate-bounce">
              {combo}x Flawless Streak!
            </div>
          )}
          <div className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-xs font-mono">
            Best: <span className="text-amber-400 font-bold">{highScore}%</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMuted(!isMuted)}
            className="h-8 w-8 text-neutral-400 hover:text-white rounded-lg"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Interactive Paper Canvas Viewport */}
      <div className="relative flex-1 w-full h-full overflow-hidden bg-neutral-950 flex items-center justify-center">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className={cn(
            'w-full h-full touch-none',
            isCutting ? 'cursor-none' : score !== null ? 'cursor-default' : 'cursor-crosshair'
          )}
        />

        {/* Score Overlay Banner */}
        {score !== null && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-neutral-900 border border-white/15 p-6 rounded-2xl max-w-xs w-full text-center shadow-2xl space-y-4">
              <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center bg-white/5 border border-white/10">
                {score >= 90 ? (
                  <Sparkles className="w-7 h-7 text-amber-400" />
                ) : score >= 70 ? (
                  <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-7 h-7 text-neutral-400" />
                )}
              </div>

              <div>
                <span className="text-3xl font-black font-mono text-white tracking-tight">
                  {score}%
                </span>
                <p className="text-xs text-neutral-400 mt-1 font-medium">
                  {score >= 95 ? 'Flawless Master Cut!' : score >= 85 ? 'Satisfying Clean Tear!' : score >= 70 ? 'Good trace, slightly jagged.' : 'Off the line! Try again.'}
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={() => resetRound()}
                  className="flex-1 bg-white hover:bg-neutral-200 text-black font-bold text-xs h-10 rounded-xl"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Retry
                </Button>
                <Button
                  onClick={cycleShape}
                  variant="outline"
                  className="flex-1 border-white/15 hover:bg-white/10 text-white font-bold text-xs h-10 rounded-xl"
                >
                  Next Cut <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Floating Instruction Toast */}
        {userPath.length === 0 && score === null && (
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 pointer-events-none bg-neutral-900/90 border border-white/15 px-4 py-2 rounded-full text-xs font-medium text-neutral-300 shadow-xl flex items-center gap-2">
            <Scissors className="w-3.5 h-3.5 text-amber-400" />
            Click & drag along the dotted line to tear paper
          </div>
        )}
      </div>

      {/* Bottom Shape & Paper Color Switcher */}
      <div className="flex items-center justify-between px-5 h-12 bg-neutral-900 border-t border-white/10 text-xs shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {(['wave', 'circle', 'zigzag', 'crown', 'arch'] as ShapeType[]).map((shape) => (
            <button
              key={shape}
              onClick={() => resetRound(shape)}
              className={cn(
                'px-3 py-1 rounded-md font-medium uppercase text-[10px] tracking-wider transition-colors',
                currentShape === shape
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  : 'text-neutral-400 hover:text-white hover:bg-white/5'
              )}
            >
              {shape}
            </button>
          ))}
        </div>

        {/* Paper Texture Color Options */}
        <div className="flex items-center gap-1.5 pl-2">
          {[
            { name: 'Parchment', color: '#f3e5ab' },
            { name: 'Craft Pink', color: '#ffd1dc' },
            { name: 'Mint Green', color: '#bbf7d0' },
            { name: 'Slate Gray', color: '#cbd5e1' },
          ].map((item) => (
            <button
              key={item.color}
              onClick={() => setPaperColor(item.color)}
              className={cn(
                'w-5 h-5 rounded-full border transition-transform active:scale-95',
                paperColor === item.color ? 'ring-2 ring-white scale-110' : 'opacity-75 hover:opacity-100'
              )}
              style={{ backgroundColor: item.color }}
              title={item.name}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
