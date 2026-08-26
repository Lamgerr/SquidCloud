import { useState } from 'react';
import { ShieldAlert, Clock, FileWarning } from 'lucide-react';

/**
 * Platform-wide blackout notice.
 * Shows on every page load for every user. Dismissing hides it only for the
 * current session — a refresh or reopen brings it back until the incident
 * flag below is cleared.
 */

// Flip to null (or remove the component) when service is restored.
export const BLACKOUT_ACTIVE = false;

export default function BlackoutOverlay() {
  const [dismissed, setDismissed] = useState(false);
  if (!BLACKOUT_ACTIVE || dismissed) return null;

  return (
    <div className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0b0b0d] p-8 shadow-2xl text-zinc-200">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-red-500/15">
            <ShieldAlert className="h-6 w-6 text-red-400" />
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">SquidCloud is temporarily down</h1>
            <p className="text-xs font-medium uppercase tracking-wider text-red-400">Severe service blackout</p>
          </div>
        </div>

        <p className="mt-5 text-sm leading-relaxed text-zinc-300">
          We're sorry — a key-management fault has taken parts of SquidCloud offline.
          Our team is working on it right now and we expect full service to be
          restored within the next few hours.
        </p>

        <div className="mt-5 space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm">
          <p className="flex gap-2.5">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <span>
              <strong className="text-white">ETA:</strong> a few hours. No action is needed
              from you, and your data is safe.
            </span>
          </p>
          <p className="flex gap-2.5">
            <FileWarning className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <span>
              <strong className="text-white">Affected files:</strong> items encrypted{' '}
              <strong className="text-white">before 22 August 2026 (UTC)</strong> can't be
              decrypted until the fix ships. Everything uploaded after that date works normally.
            </span>
          </p>
        </div>

        <button
          onClick={() => setDismissed(true)}
          className="mt-6 w-full rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition-colors hover:bg-zinc-200"
        >
          I understand — continue anyway
        </button>
        <p className="mt-3 text-center text-[11px] text-zinc-500">
          This notice will reappear on refresh until service is fully restored. Thank you for your patience.
        </p>
      </div>
    </div>
  );
}
