import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { 
  Play, Pause, Maximize, Minimize, Loader, Volume2, VolumeX, 
  RotateCcw, RotateCw, Settings, PictureInPicture, AlertCircle, RefreshCw, Cpu, FileVideo,
  Wifi, WifiOff, Subtitles, Languages, Gauge, Film
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
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

const CBVideoPlayer: React.FC<CBVideoPlayerProps> = ({
  file, poster, autoPlay = false, className, shareId
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<NodeJS.Timeout>();
  const ffmpegRef = useRef<any>(null);
  const retryTimerRef = useRef<NodeJS.Timeout>();

  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
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
  const [bufferHealth, setBufferHealth] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(false);
  const [showSubtitlesMenu, setShowSubtitlesMenu] = useState(false);
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [activeAudioTrack, setActiveAudioTrack] = useState<number>(-1);
  const [activeTextTrack, setActiveTextTrack] = useState<number>(-1);
  const [audioTracks, setAudioTracks] = useState<{ index: number; language: string; label: string }[]>([]);
  const [textTracks, setTextTracks] = useState<{ index: number; language: string; label: string }[]>([]);
  const [chapters, setChapters] = useState<{ time: number; label: string }[]>([]);
  const [currentChapter, setCurrentChapter] = useState(-1);
  const [stats, setStats] = useState({ fps: 0, resolution: '', codec: '', bitrate: '' });
  const lastFrameTimeRef = useRef(performance.now());
  
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState(0);
  const [seekAnimation, setSeekAnimation] = useState<'left' | 'right' | null>(null);

  const isUnsupportedContainer = useMemo(() => {
    return /\.(avi|wmv|flv)$/i.test(file.name);
  }, [file.name]);

  const isLargeFile = useMemo(() => file.size > 50 * 1024 * 1024, [file.size]);

  const [transcodeState, setTranscodeState] = useState<'idle' | 'loading_engine' | 'transcoding' | 'ready'>('idle');
  const [transcodeProgress, setTranscodeProgress] = useState(0);
  const [transcodeMessage, setTranscodeMessage] = useState('Initializing WebAssembly Engine...');
  const [transcodedUrl, setTranscodedUrl] = useState<string | null>(null);
  const [streamReady, setStreamReady] = useState(false);
  const streamReadyRef = useRef(false);

  useEffect(() => {
    StreamDecryptorService.initListener(shareId);
    let cancelled = false;
    StreamDecryptorService.seedFileMeta(file.id, shareId).then(() => {
      if (!cancelled) {
        streamReadyRef.current = true;
        setStreamReady(true);
        if (hasErrorRef.current) {
          setHasErrorTracked(false);
          setBuffering(true);
          setRetryCount(r => r + 1);
        }
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

  useEffect(() => {
    return () => {
      if (transcodedUrl) URL.revokeObjectURL(transcodedUrl);
      clearTimeout(retryTimerRef.current);
    };
  }, [transcodedUrl]);

  useEffect(() => {
    return () => {
      clearTimeout(retryTimerRef.current);
    };
  }, []);

  const startLocalTranscoding = async () => {
    try {
      setHasErrorTracked(false);
      setTranscodeState('loading_engine');
      setTranscodeMessage('Loading FFmpeg WebAssembly Core...');
      
      const { FFmpeg } = await import('@ffmpeg/ffmpeg');
      const { fetchFile, toBlobURL } = await import('@ffmpeg/util');

      if (!ffmpegRef.current) {
        ffmpegRef.current = new FFmpeg();
      }
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
      const inputExtension = file.name.split('.').pop() || 'avi';
      const inputName = `input.${inputExtension}`;
      const outputName = 'output.mp4';

      await ffmpeg.writeFile(inputName, await fetchFile(virtualStreamUrl));

      setTranscodeMessage('Running ultrafast local video conversion...');
      setTranscodeProgress(15);

      await ffmpeg.exec([
        '-i', inputName,
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '28',
        '-c:a', 'aac',
        outputName
      ]);

      const fileData = await ffmpeg.readFile(outputName);
      const dataArray = new Uint8Array(fileData as ArrayBuffer);
      const videoBlob = new Blob([dataArray.buffer], { type: 'video/mp4' });
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

  const wakeControls = useCallback(() => {
    setControlsVisible(true);
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (!videoRef.current?.paused && !showSettings) {
        setControlsVisible(false);
      }
    }, 2800);
  }, [showSettings]);

  useEffect(() => {
    wakeControls();
    return () => clearTimeout(hideTimerRef.current);
  }, [playing, wakeControls]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!videoRef.current || (transcodeState !== 'ready' && isUnsupportedContainer)) return;
      wakeControls();
      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'arrowright':
        case 'l':
          triggerSeek('right', 10);
          break;
        case 'arrowleft':
        case 'j':
          triggerSeek('left', -10);
          break;
        case 'm':
          toggleMute();
          break;
        case 'f':
          toggleFs();
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [duration, wakeControls, transcodeState, isUnsupportedContainer]);

  const togglePlay = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
    } else {
      videoRef.current.pause();
    }
  };

  const triggerSeek = (direction: 'left' | 'right', seconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + seconds));
    setSeekAnimation(direction);
    setTimeout(() => setSeekAnimation(null), 600);
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    if (clickX < rect.width / 3) {
      triggerSeek('left', -10);
    } else if (clickX > (rect.width * 2) / 3) {
      triggerSeek('right', 10);
    } else {
      toggleFs();
    }
  };

  const toggleFs = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
      setFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setFullscreen(false);
    }
  };

  const toggleMute = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!videoRef.current) return;
    videoRef.current.muted = !muted;
    setMuted(!muted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const val = parseFloat(e.target.value);
    if (!videoRef.current) return;
    videoRef.current.volume = val;
    setVolume(val);
    if (val > 0 && muted) {
      videoRef.current.muted = false;
      setMuted(false);
    }
  };

  const changeSpeed = (speed: number) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = speed;
    setPlaybackSpeed(speed);
    setShowSettings(false);
  };

  const togglePiP = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (videoRef.current) {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (err) {
      console.error('PiP Error:', err);
    }
  };

  const handleProgressScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !duration) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    if (videoRef.current) videoRef.current.currentTime = pos * duration;
  };

  const handleProgressHover = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !duration) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverPosition(e.clientX - rect.left);
    setHoverTime(pos * duration);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const retryWithBackoff = useCallback(() => {
    const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
    setErrorMessage(`Retrying in ${Math.round(delay / 1000)}s...`);
    retryTimerRef.current = setTimeout(() => {
      setHasErrorTracked(false);
      setBuffering(true);
      setLoadPhase('connecting');
      setRetryCount(r => r + 1);
    }, delay);
  }, [retryCount]);

  const handleRetry = (clearTimer = true) => {
    if (clearTimer) clearTimeout(retryTimerRef.current);
    setHasErrorTracked(false);
    setBuffering(true);
    setLoadPhase('connecting');
    setRetryCount(r => r + 1);
  };

  const activeVideoSource = !streamReady
    ? null
    : isUnsupportedContainer 
      ? transcodedUrl 
      : `/virtual-stream/${file.id}?retry=${retryCount}`;

  if (hasError) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full bg-[#0a0a0f] p-6 text-center border border-neutral-800 rounded-2xl space-y-4 select-none">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <AlertCircle className="w-7 h-7 text-red-400" />
        </div>
        <div className="space-y-1 max-w-md">
          <p className="text-sm font-semibold text-white">Stream Interrupted</p>
            <p className="text-xs text-neutral-400">
              {errorMessage || 'The encrypted video stream could not be loaded after multiple attempts.'}
            </p>
          {isLargeFile && (
            <p className="text-[10px] text-neutral-500 mt-1">
              Large file: {formatFileSize(file.size)} — chunked decryption in progress
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={handleRetry}
            size="sm" 
            className="bg-red-600 hover:bg-red-500 text-white gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Retry
          </Button>
          <Button 
            onClick={retryWithBackoff}
            size="sm" 
            variant="outline"
            className="border-neutral-700 text-neutral-300 gap-2"
          >
            <Wifi className="w-4 h-4" /> Auto Retry
          </Button>
        </div>
        {retryCount > 0 && (
          <p className="text-[10px] text-neutral-500">Attempt {retryCount + 1}</p>
        )}
      </div>
    );
  }

  if (isUnsupportedContainer && transcodeState !== 'ready') {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full bg-[#0a0a0f] p-8 text-center border border-neutral-800 rounded-2xl space-y-6 select-none">
        <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
          <Cpu className="w-8 h-8 animate-pulse" />
        </div>
        
        <div className="space-y-2 max-w-md">
          <h3 className="text-base font-bold text-white flex items-center justify-center gap-2">
            <FileVideo className="w-4 h-4 text-neutral-400" />
            Client-Side Video Transcoding
          </h3>
          <p className="text-xs text-neutral-400 leading-relaxed font-sans">
            Web browsers do not natively support <span className="text-white font-mono font-medium">{file.name.split('.').pop()?.toUpperCase()}</span> files. Squidcloud can safely convert this video inside your local device memory using zero-knowledge WebAssembly.
          </p>
        </div>

        {transcodeState === 'idle' ? (
          <Button 
            onClick={startLocalTranscoding}
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 h-11 rounded-xl shadow-lg shadow-blue-600/20 gap-2"
          >
            <Cpu className="w-4 h-4" /> Transcode & Stream Locally
          </Button>
        ) : (
          <div className="w-full max-w-sm space-y-3 bg-neutral-900/80 p-5 rounded-2xl border border-neutral-800">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-neutral-300 truncate pr-4">{transcodeMessage}</span>
              <span className="text-blue-400 font-bold">{transcodeProgress}%</span>
            </div>
            <Progress value={transcodeProgress} className="h-2 bg-neutral-950" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div 
      ref={containerRef} 
      className={cn(
        "relative w-full h-full bg-black overflow-hidden rounded-xl select-none group",
        className, 
        !controlsVisible && playing && "cursor-none"
      )}
      onMouseMove={wakeControls}
      onTouchStart={wakeControls}
      onDoubleClick={handleDoubleClick}
      onClick={togglePlay}
    >
      {activeVideoSource && (
        <video
          key={activeVideoSource}
          ref={videoRef}
          src={activeVideoSource}
          className="absolute inset-0 w-full h-full object-contain"
          poster={poster}
          playsInline
          preload="auto"
          autoPlay={autoPlay}
          onError={(e) => {
            console.error("Video playback error:", e);
            if (streamReadyRef.current) {
              if (retryCount < 8) {
                const delay = Math.min(500 * Math.pow(1.5, retryCount), 5000);
                retryTimerRef.current = setTimeout(() => {
                  handleRetry(false);
                }, delay);
              } else {
                setHasErrorTracked(true);
                setBuffering(false);
                setLoadPhase('error');
              }
            }
          }}
          onLoadedMetadata={() => {
            setDuration(videoRef.current?.duration || 0);
            if (videoRef.current && videoRef.current.readyState >= 2) {
              setBuffering(false);
              setLoadPhase('ready');
            }
            const v = videoRef.current;
            if (v) {
              const at: { index: number; language: string; label: string }[] = [];
              for (let i = 0; i < (v.audioTracks?.length || 0); i++) {
                const t = v.audioTracks![i];
                at.push({ index: i, language: t.language || 'und', label: t.label || t.language || `Track ${i + 1}` });
              }
              setAudioTracks(at);

              const tt: { index: number; language: string; label: string }[] = [];
              for (let i = 0; i < (v.textTracks?.length || 0); i++) {
                const t = v.textTracks![i];
                tt.push({ index: i, language: t.language || 'und', label: t.label || t.language || `Sub ${i + 1}` });
              }
              setTextTracks(tt);

              const w = v.videoWidth;
              const h = v.videoHeight;
              setStats(s => ({ ...s, resolution: w && h ? `${w}×${h}` : 'N/A' }));
            }
          }}
          onLoadedData={() => {
            setBuffering(false);
            setLoadPhase('ready');
          }}
          onCanPlay={() => {
            setBuffering(false);
            setLoadPhase('ready');
          }}
          onCanPlayThrough={() => {
            setBuffering(false);
            setLoadPhase('ready');
          }}
          onTimeUpdate={() => {
            const current = videoRef.current?.currentTime || 0;
            setCurrentTime(current);
            if (videoRef.current) {
              const buffered = videoRef.current.buffered;
              if (buffered.length > 0) {
                const end = buffered.end(buffered.length - 1);
                setBufferHealth(end - current);
              }
            }
            if (current > 0 && buffering) {
              setBuffering(false);
              setLoadPhase('ready');
            }
            const now = performance.now();
            const delta = now - lastFrameTimeRef.current;
            if (delta > 0) {
              setStats(s => ({ ...s, fps: Math.round(1000 / delta) }));
            }
            lastFrameTimeRef.current = now;
            if (chapters.length > 0) {
              for (let i = chapters.length - 1; i >= 0; i--) {
                if (current >= chapters[i].time) {
                  if (currentChapter !== i) setCurrentChapter(i);
                  break;
                }
              }
            }
          }}
          onProgress={() => {
            if (videoRef.current && isLargeFile) {
              const buffered = videoRef.current.buffered;
              if (buffered.length > 0 && duration > 0) {
                const end = buffered.end(buffered.length - 1);
                const pct = Math.min(100, Math.round((end / duration) * 100));
                setLoadProgress(pct);
              }
            }
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => { setPlaying(false); setControlsVisible(true); }}
          onWaiting={() => {
            if (videoRef.current && videoRef.current.readyState < 3) {
              setBuffering(true);
            }
          }}
          onSeeking={() => setBuffering(true)}
          onSeeked={() => setBuffering(false)}
        />
      )}

      {/* Double Tap Seek Animations */}
      {seekAnimation === 'left' && (
        <div className="absolute left-12 top-1/2 -translate-y-1/2 bg-black/70 backdrop-blur-md px-6 py-4 rounded-full flex flex-col items-center animate-pulse z-10 pointer-events-none">
          <RotateCcw className="w-8 h-8 text-white" />
          <span className="text-xs text-white font-semibold mt-1">-10s</span>
        </div>
      )}
      {seekAnimation === 'right' && (
        <div className="absolute right-12 top-1/2 -translate-y-1/2 bg-black/70 backdrop-blur-md px-6 py-4 rounded-full flex flex-col items-center animate-pulse z-10 pointer-events-none">
          <RotateCw className="w-8 h-8 text-white" />
          <span className="text-xs text-white font-semibold mt-1">+10s</span>
        </div>
      )}

      {/* Loading / Buffering Overlay */}
      {buffering && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10 bg-black/30 backdrop-blur-[2px] transition-opacity duration-500">
          <div className="relative">
            <Loader className="w-12 h-12 text-white/80 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-6 h-6 rounded-full border-2 border-white/20 border-t-white/80 animate-spin" />
            </div>
          </div>
          {isLargeFile && loadPhase !== 'ready' && (
            <div className="mt-4 space-y-2 text-center">
              <p className="text-xs text-white/60 font-medium">
                {loadPhase === 'connecting' && 'Establishing encrypted stream...'}
                {loadPhase === 'decrypting' && 'Decrypting video chunks...'}
                {loadPhase === 'buffering' && 'Buffering for smooth playback...'}
              </p>
              {loadProgress > 0 && (
                <div className="w-48 mx-auto">
                  <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-white/50 rounded-full transition-all duration-300"
                      style={{ width: `${loadProgress}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-white/40 mt-1">{loadProgress}% buffered</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Buffer Health Indicator (large files) */}
      {isLargeFile && playing && bufferHealth > 0 && !buffering && (
        <div className="absolute top-3 right-3 z-10 pointer-events-none">
          <div className={cn(
            "px-2 py-0.5 rounded-full text-[10px] font-mono backdrop-blur-sm transition-all duration-300",
            bufferHealth > 30 ? "bg-green-500/20 text-green-300/80" :
            bufferHealth > 10 ? "bg-yellow-500/20 text-yellow-300/80" :
            "bg-red-500/20 text-red-300/80"
          )}>
            {bufferHealth.toFixed(1)}s buffered
          </div>
        </div>
      )}

      {/* Netflix-style Subtitle Overlay */}
      {subtitlesEnabled && (() => {
        const tracks = videoRef.current?.textTracks;
        if (!tracks) return null;
        const active = Array.from(tracks).find((t: any) => t.mode === 'showing' && t.activeCues && t.activeCues.length > 0);
        if (!active || !active.activeCues) return null;
        const cue = active.activeCues[0] as VTTCue;
        return (
          <div className="absolute bottom-24 inset-x-0 flex justify-center z-15 pointer-events-none px-4">
            <span className="bg-black/80 text-white text-lg md:text-2xl font-semibold px-4 py-2 rounded-md max-w-[80%] text-center leading-snug" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.9)' }}>
              {cue.text}
            </span>
          </div>
        );
      })()}

      {/* Chapter Indicator */}
      {chapters.length > 1 && currentChapter >= 0 && playing && (
        <div className="absolute top-3 left-3 z-10 pointer-events-none">
          <div className="bg-black/60 backdrop-blur-sm text-white text-[11px] font-medium px-2.5 py-1 rounded-md">
            {chapters[currentChapter]?.label}
          </div>
        </div>
      )}

      {/* Control Bar Overlay */}
      <div 
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "absolute bottom-0 inset-x-0 px-6 pb-6 pt-16 bg-gradient-to-t from-black via-black/70 to-transparent flex flex-col gap-3 z-20 transition-all duration-300",
          controlsVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
        )}
      >
        {/* Scrubbing Timeline Bar */}
        <div 
          ref={progressBarRef}
          onClick={handleProgressScrub}
          onMouseMove={handleProgressHover}
          onMouseLeave={() => setHoverTime(null)}
          className="w-full h-1.5 hover:h-2.5 bg-white/20 rounded-full relative cursor-pointer transition-all duration-150 py-1"
        >
          {isLargeFile && (
            <div 
              className="absolute top-1/2 -translate-y-1/2 h-1.5 bg-white/10 rounded-full"
              style={{ width: `${(loadProgress / 100) * 100}%` }}
            />
          )}
          {chapters.length > 1 && chapters.map((ch, i) => (
            i > 0 && (
              <div
                key={i}
                className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 bg-white/50 rounded-full pointer-events-none"
                style={{ left: `${(ch.time / (duration || 1)) * 100}%` }}
                title={ch.label}
              />
            )
          ))}
          {hoverTime !== null && (
            <div 
              className="absolute -top-9 bg-neutral-900 border border-neutral-700 px-2 py-1 rounded text-xs font-mono text-white shadow-lg pointer-events-none -translate-x-1/2"
              style={{ left: `${hoverPosition}px` }}
            >
              {formatTime(hoverTime)}
            </div>
          )}
          <div 
            className="absolute top-1/2 -translate-y-1/2 h-1.5 hover:h-2.5 bg-red-600 rounded-full transition-all duration-75" 
            style={{ width: `${(currentTime / (duration || 1)) * 100}%` }} 
          />
          <div 
            className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-red-600 rounded-full scale-0 group-hover:scale-100 transition-transform shadow-md" 
            style={{ left: `calc(${(currentTime / (duration || 1)) * 100}% - 7px)` }} 
          />
        </div>
        
        {/* Controls Row */}
        <div className="flex items-center justify-between text-white text-sm mt-1">
          <div className="flex items-center gap-4">
            <button onClick={togglePlay} className="hover:text-red-500 transition-colors">
              {playing ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current" />}
            </button>
            
            <div className="flex items-center gap-2 group/vol">
              <button onClick={toggleMute} className="hover:text-red-500 transition-colors">
                {muted || volume === 0 ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
              </button>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.05" 
                value={muted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-0 overflow-hidden group-hover/vol:w-20 transition-all duration-300 h-1 accent-red-600 bg-white/30 rounded-full cursor-pointer"
              />
            </div>

            <span className="font-mono text-xs text-neutral-300">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-3 relative">
            {/* Subtitles toggle */}
            {textTracks.length > 0 && (
              <button 
                onClick={(e) => { e.stopPropagation(); setSubtitlesEnabled(!subtitlesEnabled); }}
                className={cn("hover:text-red-500 transition-colors", subtitlesEnabled && "text-red-500")}
                title="Subtitles"
              >
                <Subtitles className="w-5 h-5" />
              </button>
            )}

            {/* Stats for nerds */}
            <button 
              onClick={(e) => { e.stopPropagation(); setShowStats(!showStats); }}
              className={cn("hover:text-red-500 transition-colors", showStats && "text-red-500")}
              title="Stats for Nerds"
            >
              <Gauge className="w-5 h-5" />
            </button>

            <button onClick={togglePiP} className="hover:text-red-500 transition-colors" title="Picture-in-Picture">
              <PictureInPicture className="w-5 h-5" />
            </button>

            {/* Settings panel */}
            <div className="relative flex items-center">
              <button 
                onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings); }} 
                className={cn("hover:text-red-500 transition-colors", showSettings && "text-red-500")}
              >
                <Settings className="w-5 h-5" />
              </button>

              {showSettings && (
                <div className="absolute bottom-9 left-1/2 -translate-x-1/2 bg-neutral-900/95 backdrop-blur-md border border-neutral-800 rounded-xl py-3 px-3 shadow-2xl flex flex-col gap-3 min-w-[180px] z-30 max-h-[60vh] overflow-y-auto">
                  {/* Speed */}
                  <div>
                    <span className="text-[10px] uppercase font-bold text-neutral-400 px-1 block mb-1">Speed</span>
                    <div className="flex gap-1 flex-wrap">
                      {[0.5, 0.75, 1, 1.25, 1.5, 2].map((spd) => (
                        <button
                          key={spd}
                          onClick={() => changeSpeed(spd)}
                          className={cn(
                            "text-[11px] px-2 py-1 rounded transition-colors",
                            playbackSpeed === spd ? "bg-red-600 text-white font-bold" : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                          )}
                        >
                          {spd === 1 ? '1×' : `${spd}x`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Audio Language */}
                  {audioTracks.length > 1 && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-neutral-400 px-1 flex items-center gap-1 mb-1">
                        <Languages className="w-3 h-3" /> Audio
                      </span>
                      <div className="flex flex-col gap-0.5">
                        {audioTracks.map((track) => (
                          <button
                            key={track.index}
                            onClick={() => {
                              if (videoRef.current) {
                                for (let i = 0; i < (videoRef.current?.audioTracks?.length || 0); i++) {
                                  videoRef.current!.audioTracks![i].enabled = i === track.index;
                                }
                                setActiveAudioTrack(track.index);
                              }
                            }}
                            className={cn(
                              "text-left text-[11px] px-2 py-1 rounded transition-colors",
                              activeAudioTrack === track.index ? "text-red-500 font-bold bg-neutral-800" : "text-neutral-300 hover:bg-neutral-800"
                            )}
                          >
                            {track.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Subtitles */}
                  {textTracks.length > 0 && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-neutral-400 px-1 flex items-center gap-1 mb-1">
                        <Subtitles className="w-3 h-3" /> Subtitles
                      </span>
                      <div className="flex flex-col gap-0.5">
                        <button
                          onClick={() => { setSubtitlesEnabled(false); }}
                          className={cn(
                            "text-left text-[11px] px-2 py-1 rounded transition-colors",
                            !subtitlesEnabled ? "text-red-500 font-bold bg-neutral-800" : "text-neutral-300 hover:bg-neutral-800"
                          )}
                        >
                          Off
                        </button>
                        {textTracks.map((track) => (
                          <button
                            key={track.index}
                            onClick={() => {
                              setSubtitlesEnabled(true);
                              setActiveTextTrack(track.index);
                              if (videoRef.current) {
                                for (let i = 0; i < (videoRef.current?.textTracks?.length || 0); i++) {
                                  videoRef.current!.textTracks![i].mode = i === track.index ? 'showing' : 'hidden';
                                }
                              }
                            }}
                            className={cn(
                              "text-left text-[11px] px-2 py-1 rounded transition-colors",
                              subtitlesEnabled && activeTextTrack === track.index ? "text-red-500 font-bold bg-neutral-800" : "text-neutral-300 hover:bg-neutral-800"
                            )}
                          >
                            {track.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Format info */}
                  <div className="border-t border-neutral-800 pt-2">
                    <span className="text-[10px] uppercase font-bold text-neutral-400 px-1 flex items-center gap-1 mb-1">
                      <Film className="w-3 h-3" /> Format
                    </span>
                    <p className="text-[11px] text-neutral-300 px-1 font-mono truncate">{file.name}</p>
                    <p className="text-[10px] text-neutral-500 px-1">{formatFileSize(file.size)} — {file.type || 'unknown'}</p>
                  </div>
                </div>
              )}
            </div>

            <button onClick={toggleFs} className="hover:text-red-500 transition-colors">
              {fullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Stats for Nerds Overlay */}
      {showStats && (
        <div className="absolute top-3 right-3 z-30 bg-black/80 backdrop-blur-sm border border-neutral-700 rounded-lg p-3 min-w-[200px] text-[11px] font-mono text-neutral-300 space-y-1">
          <div className="flex justify-between"><span className="text-neutral-500">Resolution</span><span className="text-white">{stats.resolution || 'N/A'}</span></div>
          <div className="flex justify-between"><span className="text-neutral-500">FPS</span><span className="text-white">{stats.fps || '—'}</span></div>
          <div className="flex justify-between"><span className="text-neutral-500">Buffer</span><span className={cn(bufferHealth > 30 ? "text-green-400" : bufferHealth > 10 ? "text-yellow-400" : "text-red-400")}>{bufferHealth.toFixed(1)}s</span></div>
          <div className="flex justify-between"><span className="text-neutral-500">Time</span><span className="text-white">{formatTime(currentTime)} / {formatTime(duration)}</span></div>
          <div className="flex justify-between"><span className="text-neutral-500">Speed</span><span className="text-white">{playbackSpeed}×</span></div>
          <div className="flex justify-between"><span className="text-neutral-500">Audio</span><span className="text-white">{audioTracks.find(t => t.index === activeAudioTrack)?.label || 'Default'}</span></div>
          <div className="flex justify-between"><span className="text-neutral-500">Subtitles</span><span className="text-white">{subtitlesEnabled ? (textTracks.find(t => t.index === activeTextTrack)?.label || 'On') : 'Off'}</span></div>
          {isLargeFile && <div className="flex justify-between"><span className="text-neutral-500">Load</span><span className="text-white">{loadProgress}%</span></div>}
          <div className="flex justify-between"><span className="text-neutral-500">Retry</span><span className="text-white">{retryCount}</span></div>
        </div>
      )}
    </div>
  );
};

export default CBVideoPlayer;
