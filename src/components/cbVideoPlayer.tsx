import React, { useRef, useEffect, useState, useCallback } from 'react';
import { 
  Play, Pause, Maximize, Minimize, Loader, Volume2, VolumeX, 
  RotateCcw, RotateCw, Settings, PictureInPicture, AlertCircle, RefreshCw 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { StreamDecryptorService } from '@/lib/videoStreamer';

interface CBVideoPlayerProps {
  file: { id: string; name: string; type: string; size: number };
  poster?: string;
  autoPlay?: boolean;
  className?: string;
  shareId?: string;
}

const CBVideoPlayer: React.FC<CBVideoPlayerProps> = ({
  file, poster, autoPlay = false, className, shareId
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<NodeJS.Timeout>();

  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [buffering, setBuffering] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  
  // Advanced Controls
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  
  // Scrubbing & Double Tap Feedback
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState(0);
  const [seekAnimation, setSeekAnimation] = useState<'left' | 'right' | null>(null);

  useEffect(() => {
    StreamDecryptorService.initListener(shareId);
  }, [shareId]);

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

  // Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!videoRef.current) return;
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
  }, [duration, wakeControls]);

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

  const virtualUrl = `/virtual-stream/${file.id}?retry=${retryCount}`;

  if (hasError) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full bg-[#0a0a0f] p-6 text-center border border-neutral-800 rounded-2xl space-y-4">
        <AlertCircle className="w-10 h-10 text-red-400 animate-pulse" />
        <div className="space-y-1 max-w-md">
          <p className="text-sm font-semibold text-white">Stream Interrupted</p>
          <p className="text-xs text-neutral-400">The encrypted video chunk timed out or encountered a network error.</p>
        </div>
        <Button 
          onClick={() => { setHasError(false); setBuffering(true); setRetryCount(r => r + 1); }} 
          size="sm" 
          className="bg-red-600 hover:bg-red-500 text-white gap-2"
        >
          <RefreshCw className="w-4 h-4" /> Reload Stream
        </Button>
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
      <video
        key={virtualUrl}
        ref={videoRef}
        src={virtualUrl}
        className="absolute inset-0 w-full h-full object-contain"
        poster={poster}
        playsInline
        autoPlay={autoPlay}
        onError={(e) => {
          console.error("Video element playback error:", e);
          setHasError(true);
        }}
        onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
        onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
        onPlay={() => setPlaying(true)}
        onPause={() => { setPlaying(false); setControlsVisible(true); }}
        onWaiting={() => setBuffering(true)}
        onCanPlay={() => setBuffering(false)}
        onSeeking={() => setBuffering(true)}
        onSeeked={() => setBuffering(false)}
      />

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

      {/* Buffering Spinner */}
      {buffering && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 bg-black/20 backdrop-blur-[1px]">
          <Loader className="w-12 h-12 text-red-600 animate-spin" />
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

            {/* Playback Speed Selector */}
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
