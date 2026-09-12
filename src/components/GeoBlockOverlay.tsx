import React from 'react';
import { Globe, Mail, Lock } from 'lucide-react';

const REGION_LABELS: Record<string, string> = {
  US: 'United States', SG: 'Singapore', AU: 'Australia', CA: 'Canada',
  FR: 'France', GB: 'United Kingdom', DE: 'Germany', IR: 'Iran',
  KP: 'North Korea', IN: 'India',
};

interface Props {
  country?: string;
  reason?: string;
  code?: string;
}

export default function GeoBlockOverlay({ country, reason, code }: Props) {
  const regionName = REGION_LABELS[country ?? ''] ?? country;
  const displayReason = reason || 'Region not supported';

  return (
    <div className="fixed inset-0 z-[9999] bg-[#060607] flex items-center justify-center p-4 font-sans overflow-auto">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-[#f85149]/10 border border-[#f85149]/20 flex items-center justify-center">
          {country ? (
            <Globe className="w-8 h-8 text-[#f85149]" />
          ) : (
            <Lock className="w-8 h-8 text-[#f85149]" />
          )}
        </div>

        <div className="space-y-3">
          <h1 className="text-[22px] font-bold text-white tracking-tight">
            Access Restricted
          </h1>
          <p className="text-[14px] text-[#8b949e] leading-relaxed max-w-xs mx-auto">
            SquidCloud is not available in your region due to regulatory compliance.
          </p>
        </div>

        {country && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#161b22] border border-[#21262d] text-[12px] text-[#c9d1d9]">
            <Globe className="w-3.5 h-3.5 text-[#484f58]" />
            <span className="font-medium">{regionName}</span>
            <span className="text-[#30363d]">&middot;</span>
            <span className="text-[#8b949e]">{displayReason}</span>
          </div>
        )}

        {!country && code && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#161b22] border border-[#21262d] text-[12px] text-[#c9d1d9] font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-[#f85149]" />
            {code}
          </div>
        )}

        <div className="rounded-xl bg-[#0d1117] border border-[#21262d] p-5 text-left">
          <p className="text-[11px] text-[#484f58] uppercase tracking-[0.12em] font-semibold mb-3">
            What to do
          </p>
          <ul className="space-y-2 text-[13px] text-[#8b949e]">
            <li className="flex items-start gap-2">
              <span className="mt-1.5 w-1 h-1 rounded-full bg-[#30363d] shrink-0" />
              Disable any active VPN, proxy, or network anonymizer
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 w-1 h-1 rounded-full bg-[#30363d] shrink-0" />
              Connect from a supported region and refresh
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 w-1 h-1 rounded-full bg-[#30363d] shrink-0" />
              For business access requests, contact support
            </li>
          </ul>
        </div>

        <a
          href="mailto:hellosquidcloud@gmail.com?subject=Access%20Request"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0d1117] border border-[#21262d] text-[13px] text-[#58a6ff] hover:bg-[#161b22] hover:border-[#30363d] transition-colors"
        >
          <Mail className="w-3.5 h-3.5" />
          hellosquidcloud@gmail.com
        </a>
      </div>
    </div>
  );
}
