import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Eye, Terminal } from '@/lib/icon-map';
import { Button } from '@/components/ui/button';
import { useSquidGuard } from '@/hooks/useSquidGuard';

export function SquidGuardOverlay() {
  const { devtoolsOpen, warnings, dismissOverlay } = useSquidGuard();
  const [dismissed, setDismissed] = useState(false);

  const show = devtoolsOpen && !dismissed;

  useEffect(() => {
    if (!devtoolsOpen) setDismissed(false);
  }, [devtoolsOpen]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative max-w-lg w-full rounded-2xl border border-border/40 bg-background p-8 shadow-2xl"
          >
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <Eye className="w-8 h-8 text-destructive" />
              </div>

              <h2 className="text-2xl font-bold tracking-tight">Developer Tools Detected</h2>

              <p className="text-sm text-muted-foreground leading-relaxed">
                For your security, some features may be restricted while developer tools are open.
                If someone asked you to paste code into the console, it is a scam.
                <strong className="text-foreground"> SquidCloud will never ask you to do this.</strong>
              </p>

              {warnings.length > 0 && (
                <div className="w-full rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs font-medium mb-1">
                    <Terminal className="w-3.5 h-3.5" />
                    Token Warning
                  </div>
                  <ul className="text-xs text-muted-foreground space-y-0.5">
                    {warnings.map((w, i) => (
                      <li key={i} className="font-mono truncate">{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex gap-3 pt-2 w-full">
                <Button
                  variant="default"
                  className="flex-1"
                  onClick={() => {
                    dismissOverlay();
                    setDismissed(true);
                  }}
                >
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  I Understand
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => window.location.reload()}
                >
                  Reload Page
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
