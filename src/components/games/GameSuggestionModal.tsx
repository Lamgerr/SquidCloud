import React, { useState, useEffect } from 'react';
import { Dialog, DialogOverlay, DialogPortal } from '@/components/ui/dialog';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { BottomSheet, BottomSheetContent } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { 
  Gamepad2, 
  Sparkles, 
  Trophy, 
  Zap, 
  X, 
  Keyboard, 
  ArrowRight, 
  Flame, 
  Ghost, 
  Rocket,
  Smartphone
} from 'lucide-react';

interface CustomDialogContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Popup> {
  isMobile?: boolean;
}

const CustomDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Popup>,
  CustomDialogContentProps
>(({ className, children, isMobile, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay className="z-[70] bg-black/85 backdrop-blur-xl animate-in fade-in duration-200" />
    <DialogPrimitive.Popup
      ref={ref}
      className={cn(
        isMobile
          ? 'fixed inset-x-0 bottom-0 z-[70] mx-auto w-full max-w-full rounded-t-[28px] border border-white/15 border-b-0 bg-[#0a0a0f] text-white shadow-[0_-10px_80px_rgba(255,255,255,0.08)] animate-in slide-in-from-bottom duration-300 ease-out focus:outline-none'
          : 'fixed left-1/2 top-1/2 z-[70] grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-0 overflow-hidden rounded-[28px] border border-white/15 bg-[#0a0a0f] text-white shadow-[0_0_80px_rgba(255,255,255,0.08)] animate-in fade-in zoom-in-95 duration-200 ease-out focus:outline-none',
        className
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Popup>
  </DialogPortal>
));
CustomDialogContent.displayName = 'CustomDialogContent';

interface GameSuggestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlayNow: () => void;
  transferType?: 'uploading' | 'downloading';
  fileName?: string;
  onPreferenceChange?: (alwaysShow: boolean) => void;
}

const FEATURED_GAMES = [
  { id: 'snake', name: 'Cyber Snake', tag: 'CLASSIC', icon: Ghost, score: '10.4K High Score' },
  { id: 'tetris', name: 'Neon Blocks', tag: 'PUZZLE', icon: Gamepad2, score: 'Level 18 Max' },
  { id: 'invaders', name: 'Space Raid', tag: 'ARCADE', icon: Rocket, score: 'Boss Arena' },
];

export const GameSuggestionModal: React.FC<GameSuggestionModalProps> = ({
  isOpen,
  onClose,
  onPlayNow,
  transferType = 'uploading',
  fileName,
  onPreferenceChange,
}) => {
  const isMobile = useIsMobile();
  const [alwaysShow, setAlwaysShow] = useState(true);
  const [activeGameIndex, setActiveGameIndex] = useState(0);

  // Auto-cycle featured game teaser
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setActiveGameIndex((prev) => (prev + 1) % FEATURED_GAMES.length);
    }, 2800);
    return () => clearInterval(interval);
  }, [isOpen]);

  const handleCheckboxChange = (checked: boolean) => {
    setAlwaysShow(checked);
    onPreferenceChange?.(checked);
  };

  const handlePlayAction = () => {
    onPreferenceChange?.(alwaysShow);
    onPlayNow();
  };

  // Global shortcut (Cmd/Ctrl + Shift + G) interceptor when popup is visible
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        if (isOpen) handlePlayAction();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, alwaysShow]);

  const content = (
    <>
      {/* Decorative Top Banner */}
      <div className={cn(
        'relative w-full bg-gradient-to-b from-neutral-900 via-[#13131a] to-[#0a0a0f] overflow-hidden border-b border-white/10 flex items-center justify-center',
        isMobile ? 'h-24' : 'h-32'
      )}>
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:20px_20px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
         
        <div className="relative z-10 flex items-center gap-3 bg-white/5 border border-white/15 px-4 py-2 rounded-full backdrop-blur-md shadow-2xl animate-bounce-subtle">
          <div className="w-7 h-7 rounded-full bg-white text-black flex items-center justify-center font-bold">
            {isMobile ? (
              <Smartphone className="w-4 h-4" />
            ) : (
              <Gamepad2 className="w-4 h-4 animate-spin-slow" />
            )}
          </div>
          <span className="text-xs font-mono tracking-widest uppercase font-bold text-white/90">
            Arcade Lounge
          </span>
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
        </div>

        <button
          onClick={onClose}
          className={cn(
            "absolute z-20 rounded-full bg-black/50 border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors",
            isMobile ? "top-3 right-3 h-9 w-9" : "top-4 right-4 h-8 w-8"
          )}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Content Body */}
      <div className={cn(isMobile ? 'px-5 pt-3 pb-8' : 'px-7 pt-4 pb-6', 'space-y-5')}>
        {/* Friendly Conversational Hook */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] font-medium text-neutral-300">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>While your transfer finishes...</span>
          </div>
          <h2 className={cn("font-bold tracking-tight text-white", isMobile ? "text-xl" : "text-2xl")}>
            Why stare at a progress bar?
          </h2>
          <p className={cn("text-neutral-400 leading-relaxed", isMobile ? "text-xs" : "text-sm max-w-sm mx-auto")}>
            Hey friend! {fileName ? <span className="text-white font-medium">"{fileName}"</span> : 'Your file'} is currently {transferType}. Jump into our retro arcade and crush a high score while you wait!
          </p>
        </div>

        {/* Rotating Game Teaser Card */}
        <div className="relative rounded-2xl bg-gradient-to-br from-neutral-900/90 to-neutral-950/90 border border-white/10 p-4 transition-all duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-white text-black flex items-center justify-center shadow-lg transform -rotate-3 transition-transform group-hover:rotate-0">
                {React.createElement(FEATURED_GAMES[activeGameIndex].icon, { className: "w-6 h-6" })}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className={cn("font-bold text-white", isMobile ? "text-sm" : "text-base")}>
                    {FEATURED_GAMES[activeGameIndex].name}
                  </span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-neutral-300 border border-white/10">
                    {FEATURED_GAMES[activeGameIndex].tag}
                  </span>
                </div>
                <p className="text-xs text-neutral-400 flex items-center gap-1 mt-0.5 font-mono">
                  <Trophy className="w-3 h-3 text-amber-400" />
                  {FEATURED_GAMES[activeGameIndex].score}
                </p>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1">
              <span className="text-[10px] uppercase font-mono text-emerald-400 flex items-center gap-1 font-semibold">
                <Flame className="w-3 h-3" /> Ready
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 pt-1">
          <Button
            onClick={handlePlayAction}
            className={cn(
              "w-full rounded-xl bg-white hover:bg-neutral-200 text-black font-bold tracking-wide transition-all active:scale-[0.98]",
              isMobile ? "h-13 text-sm gap-2" : "h-12 text-sm shadow-[0_0_25px_rgba(255,255,255,0.25)] hover:shadow-[0_0_35px_rgba(255,255,255,0.35)] gap-2.5"
            )}
          >
            <Gamepad2 className="w-5 h-5" />
            Launch Arcade Now
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>

          {isMobile ? (
            <div className="flex items-center justify-center">
              <Button
                variant="ghost"
                onClick={onClose}
                className="h-11 px-6 text-neutral-400 hover:text-white hover:bg-white/5 rounded-xl text-sm"
              >
                No thanks, I'll wait
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between text-xs text-neutral-400 px-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 px-3 text-neutral-400 hover:text-white hover:bg-white/5 rounded-lg text-xs"
              >
                No thanks, I'll wait
              </Button>

              <div className="flex items-center gap-1.5 font-mono bg-white/5 border border-white/10 px-2.5 py-1 rounded-md text-[11px] text-neutral-300">
                <Keyboard className="w-3 h-3 text-neutral-400" />
                <span>Open anytime:</span>
                <kbd className="bg-white/10 px-1 rounded text-white font-bold">⌘/Ctrl + Shift + B</kbd>
              </div>
            </div>
          )}
        </div>

        {/* User Preference Opt-Out Checkbox */}
        <div className="pt-3 border-t border-white/10 flex items-center justify-center gap-2.5">
          <Checkbox
            id="always-suggest-games"
            checked={alwaysShow}
            onCheckedChange={(checked) => handleCheckboxChange(checked as boolean)}
            className="border-white/30 data-[state=checked]:bg-white data-[state=checked]:text-black rounded"
          />
          <Label
            htmlFor="always-suggest-games"
            className={cn(
              "text-neutral-400 cursor-pointer hover:text-neutral-300 select-none font-normal",
              isMobile ? "text-[11px]" : "text-xs"
            )}
          >
            Suggest games during file transfers
          </Label>
        </div>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <BottomSheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <BottomSheetContent hideHandle hideClose className="bg-[#0a0a0f] rounded-t-[28px] p-0 select-none text-white">
          {content}
        </BottomSheetContent>
      </BottomSheet>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <CustomDialogContent className="p-0 select-none">
        {content}
      </CustomDialogContent>
    </Dialog>
  );
};
