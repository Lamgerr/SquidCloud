import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { 
  Play, Pause, Maximize, Minimize, Loader, Volume2, VolumeX, 
  RotateCcw, RotateCw, Settings, PictureInPicture, AlertCircle, RefreshCw, Cpu, FileVideo,
  Wifi, WifiOff
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
  const [retryCount, setRetryCount] = useState(0);
  const [loadPhase, setLoadPhase] = useState<LoadPhase>('connecting');
  const [loadProgress, setLoadProgress] = useState(0);
  const [bufferHealth, setBufferHealth] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState(0);
  const [seekAnimation, setSeekAnimation] = useState<'left' | 'right' | null>(null);

  const isUnsupportedContainer = useMemo(() => {
    return /\.(avi|mkv|wmv|flv|mov)$/i.test(file.name);
  }, [file.name]);

  const isLargeFile = useMemo(() => file.size > 50 * 1024 * 1024, [file.size]);

  const [transcodeState, setTranscodeState] = useState<'idle' | 'loading_engine' | 'transcoding' | 'ready'>('idle');
  const [transcodeProgress, setTranscodeProgress] = useState(0);
  const [transcodeMessage, setTranscodeMessage] = useState('Initializing WebAssembly Engine...');
  const [transcodedUrl, setTranscodedUrl] = useState<string | null>(null);
  const [streamReady, setStreamReady] = useState(false);

  useEffect(() => {
    StreamDecryptorService.initListener(shareId);
    let cancelled = false;
    StreamDecryptorService.seedFileMeta(file.id, shareId).then(() => {
      if (!cancelled) setStreamReady(true);
    }).catch(() => {
      if (!cancelled) setStreamReady(true);
    });
    return () => { cancelled = true; };
  }, [shareId, file.id]);

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
      setHasError(false);
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
      setHasError(true);
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
      setHasError(false);
      setBuffering(true);
      setLoadPhase('connecting');
      setRetryCount(r => r + 1);
    }, delay);
  }, [retryCount]);

  const handleRetry = () => {
    clearTimeout(retryTimerRef.current);
    setHasError(false);
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
            {errorMessage || 'The encrypted video stream could not be loaded. This may be due to a slow connection or large file size.'}
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
            setHasError(true);
            setBuffering(false);
            setLoadPhase('error');
          }}
          onLoadedMetadata={() => {
            setDuration(videoRef.current?.duration || 0);
            if (videoRef.current && videoRef.current.readyState >= 2) {
              setBuffering(false);
              setLoadPhase('ready');
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

          <div className="flex items-center gap-4 relative">
            <button onClick={togglePiP} className="hover:text-red-500 transition-colors" title="Picture-in-Picture">
              <PictureInPicture className="w-5 h-5" />
            </button>

            <div className="relative">
              <button 
                onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings); }} 
                className={cn("hover:text-red-500 transition-colors", showSettings && "text-red-500")}
              >
                <Settings className="w-5 h-5" />
              </button>

              {showSettings && (
                <div className="absolute bottom-9 right-0 bg-neutral-900 border border-neutral-800 rounded-xl py-2 px-3 shadow-2xl flex flex-col gap-1.5 min-w-[120px] z-30">
                  <span className="text-[10px] uppercase font-bold text-neutral-400 px-2">Speed</span>
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map((spd) => (
                    <button
                      key={spd}
                      onClick={() => changeSpeed(spd)}
                      className={cn(
                        "text-left text-xs px-2 py-1 rounded hover:bg-neutral-800 transition-colors",
                        playbackSpeed === spd ? "text-red-500 font-bold" : "text-neutral-200"
                      )}
                    >
                      {spd === 1 ? 'Normal' : `${spd}x`}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button onClick={toggleFs} className="hover:text-red-500 transition-colors">
              {fullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CBVideoPlayer;
