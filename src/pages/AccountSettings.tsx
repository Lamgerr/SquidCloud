import { PAGES_POLISH } from "@/components/polish/pages-polish.css";
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useShake } from '@/hooks/use-shake';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { Switch } from '@/components/ui/switch';
import { isPasskeyAvailable, registerPasskey, authenticateWithPasskey } from '@/lib/webauthn';
import BiometricSetupDialog from '@/components/BiometricSetupDialog';
import { biometricAuthService } from '@/services/biometricAuthService';
import { BYOKSettingsCard, SDESettingsCard } from '@/components/encryption';
import ApiKeyManagement from '@/components/ApiKeyManagement';
import CliDevicesSection from '@/components/settings/CliDevicesSection';
import { WebhookManager } from '@/components/WebhookManager';
import {
  User, Key, Shield, ShieldAlert, Fingerprint,
  Plus, Lock, Settings, Trash2, Calendar, Code,
  FolderOpen, FileArchive, RefreshCw, Crown,
  Repeat, Book, LogOut, Smartphone,
} from '@/lib/icon-map';
import { swkFetchNotices, swkAppealCase, SwkNotice } from '@/lib/swk-manifest';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import MigrationWizard from '@/components/MigrationWizard';
import CancelSubscriptionFlow from '@/components/CancelSubscriptionFlow';
import { emitSignal } from '@/lib/api';
import { mfaService, MfaFactor } from '@/services/mfa-service';
import {
  AppShell, Spinner, Ico, useHashState, useDocTitle,
} from '@/components/custom/squid-app';
import VaultUnlockDialog from '@/components/VaultUnlockDialog';
import VaultSecurityPanel from '@/components/VaultSecurityPanel';
import VaultRecoveryCard from '@/components/VaultRecoveryCard';
import { isVaultUnlocked, lockVault } from '@/lib/zk-vault-session';

/* ═══════════════════════════════════════════════════════════════
   SQUIDCLOUD · tvOS LIQUID GLASS ACCOUNT SETTINGS
   Single-column stage, bottom floating dock, spring jelly motion,
   deep obsidian glass, zero white tints.
   Place at: src/pages/AccountSettings.tsx
   ═══════════════════════════════════════════════════════════════ */

const SPRING =
  'linear(0, 0.03, 0.107, 0.214, 0.337, 0.464, 0.586, 0.699, 0.797, 0.881, 0.948, 0.999, 1.037, 1.062, 1.077, 1.083, 1.083, 1.078, 1.07, 1.06, 1.05, 1.039, 1.029, 1.02, 1.013, 1.007, 1.002, 0.998, 0.996, 0.994, 0.993, 0.993, 0.993, 0.994, 0.995, 0.995, 0.996, 0.997, 1)';
const JELLY =
  'linear(0, 0.067, 0.235, 0.453, 0.681, 0.885, 1.047, 1.158, 1.218, 1.233, 1.215, 1.174, 1.122, 1.069, 1.022, 0.986, 0.961, 0.948, 0.946, 0.951, 0.961, 0.973, 0.985, 0.996, 1.004, 1.01, 1.012, 1.013, 1.011, 1.009, 1.006, 1.003, 1.001, 0.999, 0.998, 0.997, 0.997, 0.997, 1)';

const RIM_MASK = `
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  mask-composite: exclude;`;

const TV_CSS = `
html.sq-app-root .tv-root {
  --lq-spring: cubic-bezier(0.34, 1.4, 0.64, 1);
  --lq-jelly: cubic-bezier(0.34, 1.56, 0.64, 1);
  --tv-bg: #070807;
  --tv-glass: rgba(13, 14, 13, 0.88);
  --tv-glass-hi: rgba(20, 22, 20, 0.94);
  --tv-well: rgba(8, 9, 8, 0.72);
  --tv-ink: #e8e7e1;
  --tv-ink-2: #a7a8a2;
  --tv-mute: #6c6e68;
  --tv-line: rgba(232, 231, 225, 0.08);
  --tv-rim: rgba(232, 231, 225, 0.15);
  --tv-ok: #86c3a1;
  --tv-warn: #d9ac62;
  --tv-err: #e5796f;
  position: relative;
  min-height: calc(100vh / var(--sa-zoom, 1));
  background:
    radial-gradient(60% 45% at 50% -10%, rgba(28, 32, 29, 0.45), transparent 70%),
    var(--tv-bg);
  color: var(--tv-ink);
  padding: 24px clamp(16px, 4vw, 40px) 132px;
  font-family: var(--sa-f, 'Hanken Grotesk', system-ui, -apple-system, sans-serif);
}
@supports (transition-timing-function: linear(0, 1)) {
  html.sq-app-root .tv-root {
    --lq-spring: ${SPRING};
    --lq-jelly: ${JELLY};
  }
}

/* Force zero white tints across child components & switches */
html.sq-app-root .tv-root :is(.lg-card, .sa-panel, [data-tab-card]) {
  background: var(--tv-glass) !important;
  background-image: none !important;
  border: 1px solid var(--tv-line) !important;
  border-radius: 26px !important;
  -webkit-backdrop-filter: blur(22px) !important;
  backdrop-filter: blur(22px) !important;
  box-shadow: inset 0 1px 0 var(--tv-rim), 0 22px 48px -22px rgba(0, 0, 0, 0.85) !important;
}
html.sq-app-root .tv-root [role="switch"] {
  background: rgba(232, 231, 225, 0.08) !important;
  border: 1px solid var(--tv-line) !important;
  height: 26px !important;
  width: 46px !important;
  border-radius: 999px !important;
  transition: transform 0.55s var(--lq-jelly), background-color 0.2s !important;
}
html.sq-app-root .tv-root [role="switch"][data-state="checked"] {
  background: rgba(134, 195, 161, 0.24) !important;
  border-color: rgba(134, 195, 161, 0.45) !important;
}
html.sq-app-root .tv-root [role="switch"] > span {
  background: var(--tv-ink) !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.6) !important;
  transition: transform 0.55s var(--lq-jelly), scale 0.35s var(--lq-jelly) !important;
}
html.sq-app-root .tv-root [role="switch"]:active {
  transform: scale(0.88) !important;
}
html.sq-app-root .tv-root [role="switch"]:active > span {
  scale: 1.28 0.86;
}

/* Remove left-side content/marketing splits in auth views */
html.sq-app-root :is(.auth-left, .auth-hero, .auth-aside, [data-auth-left]) {
  display: none !important;
}

/* ── Top floating HUD ── */
.tv-hud {
  max-width: 640px;
  margin: 0 auto 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.tv-hud-r {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* ── Centered single-column tvOS stage ── */
.tv-stage {
  max-width: 640px;
  margin: 0 auto;
}
.tv-title-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
  padding: 0 6px;
}
.tv-title {
  margin: 0;
  font: 400 26px/1.15 var(--sa-f);
  letter-spacing: -0.025em;
  color: var(--tv-ink);
}
.tv-stack {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* ── Liquid glass pod ── */
.tv-pod {
  position: relative;
  border-radius: 26px;
  background: var(--tv-glass);
  border: 1px solid var(--tv-line);
  -webkit-backdrop-filter: blur(22px);
  backdrop-filter: blur(22px);
  box-shadow: inset 0 1px 0 var(--tv-rim), 0 22px 48px -22px rgba(0, 0, 0, 0.85);
  overflow: hidden;
  transition: transform 0.65s var(--lq-spring), border-color 0.25s, box-shadow 0.35s;
}
.tv-pod::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 1px;
  pointer-events: none;
  opacity: 0.45;
  background: conic-gradient(from 205deg at 50% 50%, var(--tv-rim), transparent 80deg, transparent 160deg, var(--tv-rim) 220deg, transparent 300deg, var(--tv-rim));
  ${RIM_MASK}
}
.tv-pod:hover, .tv-pod:focus-within {
  border-color: rgba(232, 231, 225, 0.16);
  box-shadow: inset 0 1px 0 rgba(232, 231, 225, 0.22), 0 28px 56px -22px rgba(0, 0, 0, 0.92);
}
.tv-pod.danger {
  border-color: rgba(229, 121, 111, 0.22);
}
.tv-pod-h {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 20px;
}
.tv-pod-h + .tv-pod-b {
  border-top: 1px solid var(--tv-line);
}
.tv-pod-t {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  font: 500 14px/1.2 var(--sa-f);
  letter-spacing: -0.01em;
  color: var(--tv-ink);
}
.tv-pod-t svg {
  color: var(--tv-ink-2);
}
.tv-pod-b {
  padding: 18px 20px;
}
.tv-pod-b.flush {
  padding: 0;
}

/* ── Minimal tvOS rows ── */
.tv-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 56px;
  padding: 12px 20px;
  transition: background-color 0.2s;
}
.tv-row:hover {
  background: rgba(232, 231, 225, 0.025);
}
.tv-row + .tv-row {
  border-top: 1px solid var(--tv-line);
}
.tv-row-l {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.tv-row-t {
  font: 400 14px/1.3 var(--sa-f);
  color: var(--tv-ink);
  overflow: hidden;
  text-overflow: ellipsis;
}
.tv-row-s {
  font: 400 12px/1.3 var(--sa-f);
  color: var(--tv-mute);
}
.tv-row-r {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
}

/* ── Capsule controls & Jelly buttons (no white fill) ── */
.tv-pill-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 36px;
  padding: 0 16px;
  border-radius: 999px;
  border: 1px solid var(--tv-line);
  background: var(--tv-glass);
  color: var(--tv-ink);
  font: 500 13px/1 var(--sa-f);
  letter-spacing: -0.01em;
  cursor: pointer;
  white-space: nowrap;
  text-decoration: none;
  box-shadow: inset 0 1px 0 var(--tv-rim), 0 8px 20px -10px rgba(0, 0, 0, 0.75);
  transition: transform 0.65s var(--lq-jelly), background-color 0.2s, border-color 0.2s, opacity 0.2s;
  -webkit-tap-highlight-color: transparent;
}
.tv-pill-btn:hover {
  background: var(--tv-glass-hi);
  border-color: rgba(232, 231, 225, 0.2);
  transform: scale(1.035);
}
.tv-pill-btn:active {
  transform: scaleX(0.93) scaleY(0.86);
  transition-duration: 0.12s;
}
.tv-pill-btn.lead {
  background: rgba(232, 231, 225, 0.11);
  border-color: rgba(232, 231, 225, 0.24);
}
.tv-pill-btn.lead:hover {
  background: rgba(232, 231, 225, 0.17);
  border-color: rgba(232, 231, 225, 0.34);
}
.tv-pill-btn.danger {
  color: var(--tv-err);
  border-color: rgba(229, 121, 111, 0.25);
  background: rgba(229, 121, 111, 0.06);
}
.tv-pill-btn.danger:hover {
  background: rgba(229, 121, 111, 0.14);
  border-color: rgba(229, 121, 111, 0.4);
}
.tv-pill-btn.ghost {
  background: transparent;
  border-color: transparent;
  box-shadow: none;
  color: var(--tv-ink-2);
}
.tv-pill-btn.ghost:hover {
  background: rgba(232, 231, 225, 0.06);
  color: var(--tv-ink);
}
.tv-pill-btn.sm {
  height: 32px;
  padding: 0 13px;
  font-size: 12.5px;
}
.tv-pill-btn.icon {
  width: 36px;
  padding: 0;
}
.tv-pill-btn[disabled] {
  opacity: 0.4;
  pointer-events: none;
}

/* ── Status badges ── */
.tv-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid var(--tv-line);
  background: rgba(232, 231, 225, 0.04);
  font: 500 11px/1 var(--sa-mono);
  letter-spacing: 0.04em;
  color: var(--tv-ink-2);
}
.tv-badge.ok {
  color: var(--tv-ok);
  border-color: rgba(134, 195, 161, 0.28);
  background: rgba(134, 195, 161, 0.08);
}
.tv-badge.warn {
  color: var(--tv-warn);
  border-color: rgba(217, 172, 98, 0.28);
  background: rgba(217, 172, 98, 0.08);
}
.tv-badge.err {
  color: var(--tv-err);
  border-color: rgba(229, 121, 111, 0.28);
  background: rgba(229, 121, 111, 0.08);
}
.tv-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: currentColor;
}

/* ── Glass inputs & selects ── */
.tv-input {
  width: 100%;
  height: 42px;
  padding: 0 15px;
  border-radius: 16px;
  border: 1px solid var(--tv-line);
  background: var(--tv-well);
  color: var(--tv-ink);
  font: 400 13.5px/1 var(--sa-f);
  transition: border-color 0.2s, box-shadow 0.4s var(--lq-spring), transform 0.4s var(--lq-spring);
}
.tv-input::placeholder {
  color: var(--tv-mute);
}
.tv-input:focus {
  outline: none;
  border-color: rgba(232, 231, 225, 0.32);
  box-shadow: 0 0 0 3px rgba(232, 231, 225, 0.06);
}
.tv-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.tv-select {
  height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid var(--tv-line);
  background: var(--tv-well);
  color: var(--tv-ink);
  font: 400 12.5px/1 var(--sa-f);
}
.tv-field-label {
  display: block;
  margin-bottom: 6px;
  font: 400 12px/1 var(--sa-f);
  color: var(--tv-ink-2);
}
.tv-grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
@media (max-width: 560px) {
  .tv-grid-2 { grid-template-columns: 1fr; }
}

/* ── Metrics strip ── */
.tv-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 10px;
  padding: 16px 20px;
}
.tv-metric {
  padding: 14px 16px;
  border-radius: 18px;
  background: var(--tv-well);
  border: 1px solid var(--tv-line);
}
.tv-metric span {
  display: block;
  font: 400 11px/1 var(--sa-mono);
  color: var(--tv-mute);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.tv-metric b {
  display: block;
  margin-top: 8px;
  font: 400 20px/1.1 var(--sa-f);
  color: var(--tv-ink);
  font-variant-numeric: tabular-nums;
}

/* ── Single-column Auth / MFA flow (no left content block, no white QR) ── */
.tv-mfa-flow {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 22px 20px;
  text-align: center;
}
.tv-qr-dark {
  width: 156px;
  height: 156px;
  padding: 12px;
  border-radius: 22px;
  background: var(--tv-well);
  border: 1px solid var(--tv-line);
  box-shadow: inset 0 1px 0 var(--tv-rim);
}
.tv-qr-dark svg, .tv-qr-dark img {
  display: block;
  width: 100%;
  height: 100%;
  filter: invert(0.92) hue-rotate(180deg) contrast(1.15);
  border-radius: 10px;
}
.tv-secret-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
  padding: 6px 8px 6px 14px;
  border-radius: 999px;
  background: var(--tv-well);
  border: 1px solid var(--tv-line);
  font: 400 12px/1 var(--sa-mono);
  color: var(--tv-ink-2);
}
.tv-secret-pill code {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Progress meter ── */
.tv-meter {
  height: 5px;
  border-radius: 999px;
  background: rgba(232, 231, 225, 0.08);
  overflow: hidden;
}
.tv-meter > i {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--tv-ink);
  transition: width 0.7s var(--lq-spring);
}

/* ── Payment list ── */
.tv-pay-row {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 13px 18px;
  border: 0;
  background: transparent;
  color: var(--tv-ink);
  text-align: left;
  cursor: pointer;
  transition: background-color 0.18s;
}
.tv-pay-row + .tv-pay-row {
  border-top: 1px solid var(--tv-line);
}
.tv-pay-row:hover {
  background: rgba(232, 231, 225, 0.04);
}

/* ── Rounded Floating Dock (Bottom Navigation) ── */
.tv-dock-wrap {
  position: fixed;
  left: 0;
  right: 0;
  bottom: max(18px, env(safe-area-inset-bottom));
  z-index: 50;
  display: flex;
  justify-content: center;
  pointer-events: none;
  padding: 0 12px;
}
.tv-dock {
  pointer-events: auto;
  position: relative;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px;
  border-radius: 999px;
  background: rgba(12, 13, 12, 0.88);
  border: 1px solid rgba(232, 231, 225, 0.11);
  -webkit-backdrop-filter: blur(24px) saturate(1.6);
  backdrop-filter: blur(24px) saturate(1.6);
  box-shadow:
    inset 0 1px 0 rgba(232, 231, 225, 0.18),
    0 24px 54px -16px rgba(0, 0, 0, 0.88);
  max-width: 100%;
  overflow-x: auto;
  scrollbar-width: none;
}
.tv-dock::-webkit-scrollbar {
  display: none;
}
.tv-dock::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 1px;
  pointer-events: none;
  opacity: 0.6;
  background: conic-gradient(from 205deg at 50% 50%, var(--tv-rim), transparent 80deg, transparent 160deg, var(--tv-rim) 220deg, transparent 300deg, var(--tv-rim));
  ${RIM_MASK}
}
.tv-dock-item {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 15px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--tv-mute);
  font: 500 13px/1 var(--sa-f);
  letter-spacing: -0.01em;
  cursor: pointer;
  white-space: nowrap;
  -webkit-tap-highlight-color: transparent;
  transition: color 0.2s !important;
}
.tv-dock-item:hover {
  color: var(--tv-ink-2);
}
.tv-dock-item[aria-selected="true"] {
  color: var(--tv-ink);
}
.tv-dock-thumb {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  background: rgba(232, 231, 225, 0.09);
  border: 1px solid rgba(232, 231, 225, 0.14);
  box-shadow:
    inset 0 1px 0 rgba(232, 231, 225, 0.16),
    0 6px 16px -4px rgba(0, 0, 0, 0.65);
}
.tv-dock-content {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 7px;
}
@media (max-width: 720px) {
  .tv-dock-item {
    padding: 0 12px;
  }
  .tv-dock-item:not([aria-selected="true"]) .tv-dock-label {
    display: none;
  }
}

/* ── settings shell: grouped glass rail + calm content pane ─────── */
.tv-layout{display:grid;grid-template-columns:196px minmax(0,720px);justify-content:center;gap:56px;
  max-width:1120px;margin:0 auto;padding:112px 28px 88px;min-height:100vh;align-items:start}
/* No enclosing rectangle — the rail is just floating text with a glass thumb. */
.tv-rail{position:sticky;top:112px;align-self:start;display:flex;flex-direction:column;gap:22px;
  padding:2px 0;background:transparent;border:0;box-shadow:none}
.tv-rail-group{display:flex;flex-direction:column;gap:2px}
.tv-rail-label{padding:0 12px 8px;font:400 10px/1 var(--sa-mono,ui-monospace,monospace);letter-spacing:.14em;
  text-transform:uppercase;color:var(--sa-dim,#62655f)}
.tv-rail-item{position:relative;display:flex;align-items:center;gap:11px;min-height:38px;padding:0 12px;border:0;
  border-radius:12px;background:transparent;color:var(--sa-mute,#8d8f89);font:inherit;font-size:13px;cursor:pointer;
  text-align:left;transition:color .18s;-webkit-tap-highlight-color:transparent}
.tv-rail-item:hover,.tv-rail-item[aria-selected="true"]{color:var(--sa-text,#e8e7e1)}
.tv-rail-thumb{position:absolute;inset:0;border-radius:12px;
  background:linear-gradient(180deg,var(--sa-bg-4,#1b201d),var(--sa-bg-3,#141816));
  box-shadow:inset 0 1px 0 rgba(232,231,225,.08),0 0 0 1px rgba(232,231,225,.1),0 6px 18px -6px rgba(0,0,0,.55)}
.tv-rail-item svg,.tv-rail-text{position:relative;z-index:1}
.tv-rail-text{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tv-pane{min-width:0;max-width:720px;padding-bottom:48px}
.tv-pane-head{margin-bottom:26px}
.tv-pane-head h1{margin:0;font-size:clamp(28px,4vw,40px);font-weight:300;letter-spacing:-.04em;line-height:1.05}
.tv-pane-sub{margin:9px 0 0;font-size:12px;color:var(--sa-mute,#8d8f89)}
@media(max-width:880px){
  .tv-layout{display:block;padding:86px 16px 40px}
  .tv-rail{position:sticky;top:68px;z-index:30;flex-direction:row;align-items:center;gap:4px;padding:5px;
    border-radius:999px;overflow-x:auto;scrollbar-width:none;margin-bottom:26px;
    background:linear-gradient(180deg,var(--sa-bg-4,#1b201d),var(--sa-bg-2,#0e1110));
    border:1px solid var(--sa-line,#1f2221);box-shadow:inset 0 1px 0 rgba(232,231,225,.06)}
  .tv-rail::-webkit-scrollbar{display:none}
  .tv-rail-group{flex-direction:row;gap:3px}
  .tv-rail-label{display:none}
  .tv-rail-item{height:36px;padding:0 12px;border-radius:999px;white-space:nowrap;flex:none}
  .tv-rail-thumb{border-radius:999px}
  .tv-rail-text{font-size:12px}
  .tv-pane{max-width:100%}
}

/* ── encryption settings: same glass, no cartoon colours ────────── */
.tv-enc-card{background:linear-gradient(180deg,var(--sa-bg-3,#141816),var(--sa-bg-2,#0e1110))!important;
  border:1px solid var(--sa-line,#1f2221)!important;border-radius:20px!important;
  box-shadow:inset 0 1px 0 rgba(232,231,225,.06),0 20px 44px -24px rgba(0,0,0,.8)!important;
  color:var(--sa-text,#e8e7e1)!important}
.tv-enc-card :is([class*="bg-white/"],[class*="bg-black/"],[class*="bg-amber-"],[class*="bg-purple-"],[class*="bg-emerald-"],[class*="bg-blue-"]){
  background:var(--sa-bg-4,#1b201d)!important}
.tv-enc-card :is([class*="border-white/"],[class*="border-amber-"],[class*="border-purple-"],[class*="border-emerald-"]){
  border-color:var(--sa-line,#1f2221)!important}
.tv-enc-card :is([class*="text-white"],[class*="text-amber-"],[class*="text-purple-"],[class*="text-emerald-"],[class*="text-blue-"],[class*="text-red-"]){
  color:var(--sa-text,#e8e7e1)!important}
.tv-enc-card :is(.rounded-xl,.rounded-2xl,.rounded-lg){border-radius:12px!important}
.tv-enc-card :is(button,[role="switch"]){border-radius:999px!important}
.tv-enc-card input{border-color:var(--sa-line,#1f2221)!important;background:var(--sa-bg,#090b0a)!important;color:var(--sa-text,#e8e7e1)!important}
.tv-enc-card input:focus{border-color:var(--sa-text,#e8e7e1)!important}

/* ── TOTP setup: a calm two-step panel ─────────────────────────── */
.tv-totp{display:grid;gap:18px;padding:20px;border-radius:18px;
  background:linear-gradient(180deg,var(--sa-bg-3,#141816),var(--sa-bg-2,#0e1110));
  border:1px solid var(--sa-line,#1f2221);box-shadow:inset 0 1px 0 rgba(232,231,225,.06)}
.tv-totp-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
.tv-totp-head b{display:block;font-size:14px;font-weight:500;color:var(--sa-text,#e8e7e1)}
.tv-totp-head span:not(.tv-totp-step){display:block;margin-top:5px;font-size:12px;color:var(--sa-mute,#8d8f89)}
.tv-totp-step{flex:none;font:400 10px/1 var(--sa-mono,monospace);letter-spacing:.12em;text-transform:uppercase;color:var(--sa-dim,#62655f)}
.tv-totp-body{display:grid;grid-template-columns:180px minmax(0,1fr);gap:20px;align-items:center}
.tv-qr-card{width:180px;height:180px;padding:12px;border-radius:16px;background:#fff;display:grid;place-items:center;
  box-shadow:0 12px 32px -14px rgba(0,0,0,.8)}
.tv-qr-card img{display:block;width:100%;height:100%}
.tv-totp-label{margin:0 0 10px;font:400 10px/1 var(--sa-mono,monospace);letter-spacing:.12em;text-transform:uppercase;color:var(--sa-dim,#62655f)}
.tv-totp-hint{margin:12px 0 0;font-size:11px;line-height:1.5;color:var(--sa-mute,#8d8f89)}
.tv-totp-verify{border-top:1px solid var(--sa-line,#1f2221);padding-top:18px}
.tv-otp{display:flex;gap:8px;flex-wrap:wrap}
.tv-otp-cell{width:44px;height:52px;text-align:center;font:400 22px/1 var(--sa-mono,monospace);
  color:var(--sa-text,#e8e7e1);background:var(--sa-bg,#090b0a);border:1px solid var(--sa-line,#1f2221);
  border-radius:12px;outline:none;transition:border-color .18s,box-shadow .18s}
.tv-otp-cell:focus{border-color:var(--sa-text,#e8e7e1);box-shadow:0 0 0 3px rgba(232,231,225,.06)}
.tv-otp-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}
@media(max-width:560px){.tv-totp-body{grid-template-columns:1fr}.tv-qr-card{margin:0 auto}.tv-otp-cell{width:38px;height:46px;font-size:19px}}
${ PAGES_POLISH }
`;

const ACCOUNT_PREFS_STORAGE_KEY = 'squid_account_settings_v3';

interface AccountPreferenceSettings {
  lockSessionWhenInactive: boolean;
  requirePinForDownloads: boolean;
  requirePinForShares: boolean;
  strictPreviewIsolation: boolean;
  verifyDownloadIntegrity: boolean;
  blockUnknownFilePreviews: boolean;
  quarantineRiskyFiles: boolean;
  notifySecurityEvents: boolean;
  notifyFileShareEvents: boolean;
  notifyBackgroundSync: boolean;
  lowDataMode: boolean;
  prefetchNextPreview: boolean;
  hardwareDecodeAcceleration: boolean;
  autoRetryBackgroundSync: boolean;
  developerLogs: boolean;
  experimentalPreviewPipeline: boolean;
  showTransferDiagnostics: boolean;
  showAdvancedMetadata: boolean;
  gameSuggestionsEnabled: boolean;
}

interface AccountPreferenceItem {
  key: keyof AccountPreferenceSettings;
  label: string;
}

interface AccountPreferenceCategory {
  id: string;
  title: string;
  items: AccountPreferenceItem[];
}

const DEFAULT_ACCOUNT_PREFERENCES: AccountPreferenceSettings = {
  lockSessionWhenInactive: true,
  requirePinForDownloads: false,
  requirePinForShares: true,
  strictPreviewIsolation: true,
  verifyDownloadIntegrity: true,
  blockUnknownFilePreviews: true,
  quarantineRiskyFiles: true,
  notifySecurityEvents: true,
  notifyFileShareEvents: true,
  notifyBackgroundSync: false,
  lowDataMode: false,
  prefetchNextPreview: true,
  hardwareDecodeAcceleration: true,
  autoRetryBackgroundSync: true,
  developerLogs: false,
  experimentalPreviewPipeline: false,
  showTransferDiagnostics: false,
  showAdvancedMetadata: false,
  gameSuggestionsEnabled: true,
};

const SETTINGS_CATEGORIES = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'plans', label: 'Plan', icon: Crown },
  { id: 'byok', label: 'Encryption', icon: Lock },
  { id: 'developer', label: 'API', icon: Code },
  { id: 'webhooks', label: 'Webhooks', icon: Repeat },
  { id: 'devices', label: 'CLI', icon: Smartphone },
  { id: 'migration', label: 'Import', icon: FileArchive },
  { id: 'preferences', label: 'System', icon: Settings },
] as const;

type SettingsCategory = typeof SETTINGS_CATEGORIES[number]['id'];

const SETTINGS_GROUPS: { label: string; ids: SettingsCategory[] }[] = [
  { label: 'Account', ids: ['profile', 'security', 'plans', 'byok'] },
  { label: 'Developer', ids: ['developer', 'webhooks', 'devices', 'migration'] },
  { label: 'System', ids: ['preferences'] },
];
const SECTION_IDS: SettingsCategory[] = SETTINGS_CATEGORIES.map((c) => c.id);

type Tone = 'neutral' | 'ok' | 'warn' | 'err';

function OtpInput({ value, onChange, onComplete }: {
  value: string; onChange: (v: string) => void; onComplete?: () => void;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || '');
  const setDigit = (i: number, raw: string) => {
    const ch = raw.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = ch;
    const joined = next.join('').slice(0, 6);
    onChange(joined);
    if (ch && i < 5) refs.current[i + 1]?.focus();
    if (joined.length === 6) onComplete?.();
  };
  return (
    <div className="tv-otp" role="group" aria-label="Six digit verification code">
      {digits.map((d, i) => (
        <input key={i} ref={(el) => { refs.current[i] = el; }} className="tv-otp-cell" inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'} maxLength={1} value={d} aria-label={`Digit ${i + 1}`}
          onChange={(e) => setDigit(i, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !d && i > 0) { e.preventDefault(); refs.current[i - 1]?.focus(); }
            if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
            if (e.key === 'ArrowRight' && i < 5) refs.current[i + 1]?.focus();
            if (e.key === 'Enter' && value.length === 6) onComplete?.();
          }} />
      ))}
    </div>
  );
}

function TvBadge({ tone = 'neutral', dot, children }: { tone?: Tone; dot?: boolean; children: React.ReactNode }) {
  return (
    <span className={`tv-badge ${tone === 'neutral' ? '' : tone}`.trim()}>
      {dot && <span className="tv-dot" />}
      {children}
    </span>
  );
}

function TvPod({
  title,
  icon,
  actions,
  children,
  flush,
  danger,
}: {
  title?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  flush?: boolean;
  danger?: boolean;
}) {
  return (
    <section className={`tv-pod${danger ? ' danger' : ''}`}>
      {(title || actions) && (
        <div className="tv-pod-h">
          {title ? (
            <h3 className="tv-pod-t">
              {icon}
              <span>{title}</span>
            </h3>
          ) : <span />}
          {actions && <div className="tv-row-r">{actions}</div>}
        </div>
      )}
      <div className={`tv-pod-b${flush ? ' flush' : ''}`}>{children}</div>
    </section>
  );
}

function TvRow({
  label,
  sub,
  children,
}: {
  label: React.ReactNode;
  sub?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="tv-row">
      <div className="tv-row-l">
        <div className="tv-row-t">{label}</div>
        {sub && <div className="tv-row-s">{sub}</div>}
      </div>
      {children && <div className="tv-row-r">{children}</div>}
    </div>
  );
}

const AccountSettings = () => {
  const { user, profile, session, signOut, refreshProfile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const reduce = !!useReducedMotion();
  const { trigger: shake, shakeClass } = useShake();

  const [activeCategory, setActiveCategory] = useHashState<SettingsCategory>('section', 'profile', SECTION_IDS);
  const [vaultOpen, setVaultOpen] = useState(false);
  const [vaultState, setVaultState] = useState(isVaultUnlocked());
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [loading, setLoading] = useState(false);
  const [storageUsed, setStorageUsed] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passkeyAvailable, setPasskeyAvailable] = useState(false);
  const [hasPasskey, setHasPasskey] = useState(false);
  const [passkeyData, setPasskeyData] = useState<any>(null);
  const [isCheckingPasskey, setIsCheckingPasskey] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showBiometricSetup, setShowBiometricSetup] = useState(false);
  const [hasBiometric, setHasBiometric] = useState(false);
  const [accountPreferences, setAccountPreferences] = useState<AccountPreferenceSettings>(DEFAULT_ACCOUNT_PREFERENCES);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [migrationJob, setMigrationJob] = useState<any>(null);
  const [cancelling, setCancelling] = useState(false);
  const [redeemCodeInput, setRedeemCodeInput] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [paymentHistoryOpen, setPaymentHistoryOpen] = useState(false);
  const [swkNotices, setSwkNotices] = useState<SwkNotice[]>([]);
  const [swkLoading, setSwkLoading] = useState(false);
  const [swkAppealingId, setSwkAppealingId] = useState<string | null>(null);
  const [paymentLogs, setPaymentLogs] = useState<any[]>([]);
  const [paymentLogsLoading, setPaymentLogsLoading] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any | null>(null);
  const [notifPrefs, setNotifPrefs] = useState({
    email_enabled: true,
    popup_enabled: true,
    warning_lead_days: 7,
    do_not_contact: false,
  });

  // MFA state
  const [mfaFactors, setMfaFactors] = useState<MfaFactor[]>([]);
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaSetupMode, setMfaSetupMode] = useState(false);
  const [mfaQrCode, setMfaQrCode] = useState('');
  const [mfaSecret, setMfaSecret] = useState('');
  const [mfaEnrollmentId, setMfaEnrollmentId] = useState('');
  const [mfaVerifyCode, setMfaVerifyCode] = useState('');
  const [mfaVerifying, setMfaVerifying] = useState(false);
  const [showUnenrollDialog, setShowUnenrollDialog] = useState(false);
  const [unenrollFactorId, setUnenrollFactorId] = useState('');
  const [aalLevel, setAalLevel] = useState<{ currentLevel: string; nextLevel: string } | null>(null);
  const [secretCopied, setSecretCopied] = useState(false);

  const mountedRef = useRef(false);
  const paymentLogsFetchedRef = useRef(false);
  const notifPrefsFetchedRef = useRef(false);

  useEffect(() => {
    if (activeCategory !== 'security') return;
    let cancelled = false;
    setSwkLoading(true);
    swkFetchNotices(true)
      .then((notices) => { if (!cancelled) setSwkNotices(notices); })
      .catch(() => null)
      .finally(() => { if (!cancelled) setSwkLoading(false); });
    return () => { cancelled = true; };
  }, [activeCategory]);

  const handleSwkAppeal = async (notice: SwkNotice) => {
    if (!notice.case_id || swkAppealingId) return;
    setSwkAppealingId(notice.id);
    try {
      const ok = await swkAppealCase(notice.case_id);
      toast({
        title: ok ? 'Appeal submitted' : 'Appeal failed',
        description: ok
          ? 'A human reviewer will look at your case.'
          : 'Could not submit the appeal. Try again shortly.',
        variant: ok ? 'default' : 'destructive',
      });
      if (ok) {
        const refreshed = await swkFetchNotices(false).catch(() => [] as SwkNotice[]);
        setSwkNotices(refreshed);
      }
    } finally {
      setSwkAppealingId(null);
    }
  };

  const preferenceCategories = useMemo<AccountPreferenceCategory[]>(() => [
    {
      id: 'security-hardening',
      title: 'Hardening',
      items: [
        { key: 'lockSessionWhenInactive', label: 'Auto-lock inactive session' },
        { key: 'strictPreviewIsolation', label: 'Strict preview isolation' },
        { key: 'verifyDownloadIntegrity', label: 'Verify download integrity' },
        { key: 'blockUnknownFilePreviews', label: 'Block unknown preview formats' },
        { key: 'quarantineRiskyFiles', label: 'Quarantine risky files' },
      ],
    },
    {
      id: 'operation-guards',
      title: 'Guards & Alerts',
      items: [
        { key: 'requirePinForDownloads', label: 'Require PIN for downloads' },
        { key: 'requirePinForShares', label: 'Require PIN for shares' },
        { key: 'notifySecurityEvents', label: 'Security event alerts' },
        { key: 'notifyFileShareEvents', label: 'Share event alerts' },
        { key: 'notifyBackgroundSync', label: 'Background sync alerts' },
      ],
    },
    {
      id: 'data-saver',
      title: 'Performance',
      items: [
        { key: 'lowDataMode', label: 'Low data mode' },
        { key: 'prefetchNextPreview', label: 'Prefetch next preview' },
        { key: 'hardwareDecodeAcceleration', label: 'Hardware decode acceleration' },
      ],
    },
    {
      id: 'sync-diagnostics',
      title: 'Diagnostics',
      items: [
        { key: 'autoRetryBackgroundSync', label: 'Auto-retry background sync' },
        { key: 'developerLogs', label: 'Developer logs' },
        { key: 'experimentalPreviewPipeline', label: 'Experimental preview pipeline' },
        { key: 'showTransferDiagnostics', label: 'Transfer diagnostics' },
        { key: 'showAdvancedMetadata', label: 'Advanced metadata' },
        { key: 'gameSuggestionsEnabled', label: 'Arcade prompts during transfers' },
      ],
    },
  ], []);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    checkPasskeyAvailability();
    checkUserPasskey();
    checkBiometricStatus();
    fetchStorageStats();
    loadPreferences();
    fetchLatestMigration();
    loadMfaFactors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMfaFactors = async () => {
    const factors = await mfaService.listFactors();
    setMfaFactors(factors);
    const aal = await mfaService.getAalLevel();
    setAalLevel(aal);
  };

  const handleEnrollMfa = async () => {
    setMfaLoading(true);
    const existingFactors = await mfaService.listFactors();
    for (const f of existingFactors) {
      if (f.status === 'unverified') {
        await mfaService.unenroll(f.id);
      }
    }
    const enrollment = await mfaService.enroll('CloudBliss TOTP');
    if (enrollment) {
      setMfaQrCode(enrollment.totp.qr_code);
      setMfaSecret(enrollment.totp.secret);
      setMfaEnrollmentId(enrollment.id);
      setMfaSetupMode(true);
    } else {
      toast({ title: 'Error', description: 'Failed to start MFA enrollment', variant: 'destructive' });
    }
    setMfaLoading(false);
  };

  const handleVerifyMfa = async () => {
    if (!mfaVerifyCode || mfaVerifyCode.length !== 6 || !mfaEnrollmentId) return;
    setMfaVerifying(true);
    const challengeId = await mfaService.challenge(mfaEnrollmentId);
    if (challengeId) {
      const success = await mfaService.verify(mfaEnrollmentId, challengeId, mfaVerifyCode);
      if (success) {
        toast({ title: 'MFA Enabled', description: 'Two-factor authentication is now active' });
        setMfaSetupMode(false);
        setMfaVerifyCode('');
        setMfaQrCode('');
        setMfaSecret('');
        setMfaEnrollmentId('');
        loadMfaFactors();
      } else {
        shake();
      toast({ title: 'Invalid Code', description: 'Please check the code and try again', variant: 'destructive' });
      }
    }
    setMfaVerifying(false);
  };

  const handleUnenrollMfa = async () => {
    if (!unenrollFactorId) return;
    setMfaLoading(true);
    const success = await mfaService.unenroll(unenrollFactorId);
    if (success) {
      toast({ title: 'MFA Disabled', description: 'Two-factor authentication has been removed' });
      setShowUnenrollDialog(false);
      setUnenrollFactorId('');
      loadMfaFactors();
    } else {
      toast({ title: 'Error', description: 'Failed to disable MFA', variant: 'destructive' });
    }
    setMfaLoading(false);
  };

  const handleCopySecret = async () => {
    try {
      await navigator.clipboard.writeText(mfaSecret);
      setSecretCopied(true);
      setTimeout(() => setSecretCopied(false), 2000);
    } catch {
      toast({ title: 'Copy failed', description: 'Please copy the secret manually', variant: 'destructive' });
    }
  };

  useEffect(() => {
    if (!migrationJob?.id || ['completed', 'failed', 'cancelled'].includes(migrationJob.status)) return;
    const interval = setInterval(async () => {
      try {
        const { data } = await supabase.from('migration_jobs').select('*').eq('id', migrationJob.id).single();
        if (data) setMigrationJob(data);
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [migrationJob?.id]);

  const loadPreferences = () => {
    try {
      const saved = localStorage.getItem(ACCOUNT_PREFS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setAccountPreferences((prev) => ({ ...prev, ...parsed }));
      }
    } catch { /* ignore */ }
  };

  const savePreferences = (prefs: AccountPreferenceSettings) => {
    localStorage.setItem(ACCOUNT_PREFS_STORAGE_KEY, JSON.stringify(prefs));
  };

  const updatePreference = (key: keyof AccountPreferenceSettings, enabled: boolean) => {
    setAccountPreferences((prev) => {
      const next = { ...prev, [key]: enabled };
      savePreferences(next);
      return next;
    });
    if (key === 'gameSuggestionsEnabled') {
      supabase.rpc('update_game_preference', { p_enable: enabled }).catch(console.error);
    }
  };

  const checkPasskeyAvailability = async () => {
    const available = await isPasskeyAvailable();
    setPasskeyAvailable(available);
  };

  const checkUserPasskey = async () => {
    if (!user) return;
    setIsCheckingPasskey(true);
    try {
      const { data } = await supabase.from('user_passkeys').select('*').eq('user_id', user.id).maybeSingle();
      if (data) { setHasPasskey(true); setPasskeyData(data); }
      else { setHasPasskey(false); setPasskeyData(null); }
    } catch { setHasPasskey(false); }
    finally { setIsCheckingPasskey(false); }
  };

  const checkBiometricStatus = async () => {
    if (!user) return;
    try {
      const enabled = await biometricAuthService.hasBiometric(user.id);
      setHasBiometric(enabled);
    } catch { setHasBiometric(false); }
  };

  const fetchStorageStats = async () => {
    try {
      const { data: files } = await supabase.from('files').select('size').eq('user_id', user?.id);
      const totalSize = files?.reduce((acc, f) => acc + (f.size || 0), 0) || 0;
      setStorageUsed(totalSize);
      setTotalFiles(files?.length || 0);
    } catch { /* ignore */ }
  };

  const fetchLatestMigration = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('migration_jobs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) setMigrationJob(data);
    } catch { /* ignore */ }
  };

  const handleCancelMigration = async () => {
    if (!migrationJob?.id) return;
    setCancelling(true);
    try {
      const { error } = await supabase
        .from('migration_jobs')
        .update({ status: 'cancelled' })
        .eq('id', migrationJob.id);
      if (error) throw error;
      setMigrationJob((prev: any) => (prev ? { ...prev, status: 'cancelled' } : prev));
      toast({ title: 'Migration cancelled' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to cancel migration', variant: 'destructive' });
    } finally { setCancelling(false); }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      scheduled: 'Queued',
      extracting: 'Extracting',
      uploading: 'Uploading',
      in_progress: 'Active',
      completed: 'Done',
      failed: 'Failed',
    };
    return map[status] || status;
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('profiles').update({
        full_name: fullName.trim() || null,
        display_name: displayName.trim() || null,
      }).eq('id', user.id);
      if (error) throw error;
      toast({ title: 'Saved' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to update profile.', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || '',
        password: currentPassword,
      });
      if (signInError) throw new Error('Current password is incorrect');
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      void emitSignal({
        type: 'password_changed',
        severity: 'warning',
        title: 'Password changed',
        body: 'Your account password was changed.',
        link: '/settings/account',
      });
      toast({ title: 'Password updated' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setChangingPassword(false);
    } catch (error: any) {
      shake();
      toast({ title: 'Password change failed', description: error.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const handleRegisterPasskey = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const passkeyResult = await registerPasskey(user.id, user.email || '');
      if (passkeyResult) {
        toast({ title: 'Passkey registered' });
        await checkUserPasskey();
      }
    } catch (error: any) {
      toast({ title: 'Passkey setup failed', description: error.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const handleUpdatePasskey = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const passkeyResult = await registerPasskey(user.id, user.email || '');
      if (passkeyResult) {
        await supabase.from('user_passkeys').update({ credential_id: passkeyResult.credentialId }).eq('user_id', user.id);
        toast({ title: 'Passkey updated' });
        await checkUserPasskey();
      }
    } catch (error: any) {
      toast({ title: 'Passkey update failed', description: error.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const handleTestPasskey = async () => {
    setLoading(true);
    try {
      const result = await authenticateWithPasskey(user?.email || undefined);
      if (result.success) toast({ title: 'Passkey verified' });
      else toast({ title: 'Verification failed', variant: 'destructive' });
    } catch (error: any) {
      toast({ title: 'Test failed', description: error.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const handleDeletePasskey = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await supabase.from('user_passkeys').delete().eq('user_id', user.id);
      toast({ title: 'Passkey removed' });
      setHasPasskey(false);
      setPasskeyData(null);
      setShowDeleteDialog(false);
    } catch (error: any) {
      toast({ title: 'Deletion failed', description: error.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const handleBiometricSetupComplete = async () => {
    setShowBiometricSetup(false);
    await checkBiometricStatus();
    toast({ title: 'Biometric enabled' });
  };

  const handleDisableBiometric = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await biometricAuthService.disableBiometric(user.id);
      await checkBiometricStatus();
      toast({ title: 'Biometric disabled' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  const isPremium = profile?.is_premium;
  const userTier = isPremium
    ? profile?.tier === 'supporter-plus' ? 'Supporter+' : 'Supporter'
    : 'Free';

  const handleRedeemCode = async () => {
    if (!user || !session?.access_token || !redeemCodeInput.trim()) return;
    setRedeeming(true);
    try {
      const res = await fetch('https://aouqcwbdoyrccjcrhzzi.supabase.co/functions/v1/redeem-code', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: redeemCodeInput.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: 'Redemption failed', description: data.error || 'Invalid code.', variant: 'destructive' });
        return;
      }
      toast({ title: 'Code redeemed', description: `${data.plan_type} ${data.billing_period} unlocked.` });
      setRedeemCodeInput('');
    } catch (error: any) {
      toast({ title: 'Redemption failed', description: error.message, variant: 'destructive' });
    } finally { setRedeeming(false); }
  };

  const fetchPaymentLogs = async () => {
    if (!user) return;
    setPaymentLogsLoading(true);
    setSelectedPayment(null);
    try {
      const { data, error } = await supabase
        .from('payment_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPaymentLogs(data || []);
    } catch {
      toast({ title: 'Error', description: 'Failed to load payment history', variant: 'destructive' });
    } finally {
      setPaymentLogsLoading(false);
    }
  };

  useEffect(() => {
    if (isPremium && user && !paymentLogsFetchedRef.current) {
      paymentLogsFetchedRef.current = true;
      fetchPaymentLogs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPremium, user?.id]);

  useEffect(() => {
    if (!user || notifPrefsFetchedRef.current) return;
    notifPrefsFetchedRef.current = true;
    supabase.from('user_notification_prefs').select('*').eq('user_id', user.id).maybeSingle().then(({ data }) => {
      if (data) {
        setNotifPrefs({
          email_enabled: data.email_enabled ?? true,
          popup_enabled: data.popup_enabled ?? true,
          warning_lead_days: data.warning_lead_days ?? 7,
          do_not_contact: data.do_not_contact ?? false,
        });
      }
    }).catch(() => {});
  }, [user?.id]);

  const updateNotifPref = async (key: string, value: boolean | number) => {
    setNotifPrefs((prev) => ({ ...prev, [key]: value }));
    try {
      await supabase.functions.invoke('subscription-manager/update-prefs', { body: { [key]: value } });
    } catch {}
  };

  const latestPayment = paymentLogs.find((p) => p.status === 'completed');

  const formatPaymentAmount = (p: any) =>
    p.amount_usd != null ? `$${Number(p.amount_usd).toFixed(2)} ${p.currency || 'USD'}` : '—';

  const formatPaymentDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

  const migTone = (s: string): Tone =>
    s === 'completed' ? 'ok' : s === 'failed' ? 'err' : s === 'scheduled' ? 'warn' : 'neutral';

  const payTone = (s: string): Tone =>
    s === 'completed' ? 'ok' : s === 'pending' || s === 'expired' ? 'warn' : s === 'failed' ? 'err' : 'neutral';

  /* ── Keyboard navigation on the floating dock ── */
  const onDockKey = useCallback((e: React.KeyboardEvent) => {
    const idx = SETTINGS_CATEGORIES.findIndex((c) => c.id === activeCategory);
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setActiveCategory(SETTINGS_CATEGORIES[(idx + 1) % SETTINGS_CATEGORIES.length].id);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setActiveCategory(SETTINGS_CATEGORIES[(idx - 1 + SETTINGS_CATEGORIES.length) % SETTINGS_CATEGORIES.length].id);
    }
  }, [activeCategory, setActiveCategory]);

  /* ── Section Renderers (Ultra-minimal tvOS pods) ── */

  function renderProfileSection() {
    const dirty = fullName.trim() !== (profile?.full_name || '') || displayName.trim() !== (profile?.display_name || '');
    return (
      <TvPod
        title="Identity"
        icon={<User className="h-4 w-4" />}
        actions={dirty ? <TvBadge tone="warn" dot>Unsaved</TvBadge> : undefined}
      >
        <form
          style={{ display: 'grid', gap: 14 }}
          onSubmit={(e) => { e.preventDefault(); handleSaveProfile(); }}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
              e.preventDefault();
              handleSaveProfile();
            }
          }}
        >
          <div className="tv-grid-2">
            <div>
              <label className="tv-field-label" htmlFor="tv-full">Full name</label>
              <input
                id="tv-full"
                className="tv-input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Name"
                autoComplete="name"
              />
            </div>
            <div>
              <label className="tv-field-label" htmlFor="tv-disp">Display name</label>
              <input
                id="tv-disp"
                className="tv-input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Handle"
                autoComplete="nickname"
              />
            </div>
          </div>
          <div>
            <label className="tv-field-label" htmlFor="tv-email">Email</label>
            <input id="tv-email" className="tv-input" value={user?.email || ''} disabled />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}>
            <button type="submit" className="tv-pill-btn lead" disabled={loading || !dirty}>
              {loading && <Spinner size={12} />}
              Save
            </button>
          </div>
        </form>
      </TvPod>
    );
  }

  function renderSecuritySection() {
    const unread = swkNotices.filter((n) => !n.is_read).length;
    const mfaActive = aalLevel?.currentLevel === 'aal2' || mfaFactors.length > 0;

    return (
      <>
        {/* Single-column Auth / TOTP Pod (no left content block) */}
        <TvPod
          title="Authenticator (TOTP)"
          icon={<Smartphone className="h-4 w-4" />}
          actions={<TvBadge tone={mfaActive ? 'ok' : 'neutral'} dot>{mfaActive ? 'Active' : 'Off'}</TvBadge>}
          flush
        >
          {!mfaSetupMode && mfaFactors.length === 0 && (
            <TvRow label="Two-factor code">
              <button type="button" className="tv-pill-btn sm lead" onClick={handleEnrollMfa} disabled={mfaLoading}>
                {mfaLoading ? <Spinner size={12} /> : <Plus className="h-3.5 w-3.5" />}
                Setup
              </button>
            </TvRow>
          )}

          {mfaSetupMode && (
            <div className={`tv-totp ${shakeClass}`}>
              <div className="tv-totp-head">
                <div>
                  <b>Set up authenticator</b>
                  <span>Scan the code, then enter the six-digit code to confirm.</span>
                </div>
                <span className="tv-totp-step">Step 1 of 2</span>
              </div>

              <div className="tv-totp-body">
                <div className="tv-qr-card">
                  <img src={mfaQrCode} alt="Authenticator QR code" />
                </div>
                <div className="tv-totp-side">
                  <p className="tv-totp-label">Can’t scan? Use this key</p>
                  <div className="tv-secret-pill">
                    <code title={mfaSecret}>{mfaSecret}</code>
                    <button type="button" className="tv-pill-btn ghost icon sm" onClick={handleCopySecret} aria-label="Copy key">
                      {secretCopied ? <Ico.Check size={13} /> : <Ico.Copy size={13} />}
                    </button>
                  </div>
                  <p className="tv-totp-hint">Codes refresh every 30 seconds. Never share this key.</p>
                </div>
              </div>

              <div className="tv-totp-verify">
                <p className="tv-totp-label">Verification code</p>
                <OtpInput value={mfaVerifyCode} onChange={setMfaVerifyCode} onComplete={() => { if (!mfaVerifying && mfaVerifyCode.length === 6) handleVerifyMfa(); }} />
                <div className="tv-otp-actions">
                  <button type="button" className="tv-pill-btn sm ghost"
                    onClick={() => { setMfaSetupMode(false); setMfaVerifyCode(''); setMfaQrCode(''); setMfaSecret(''); setMfaEnrollmentId(''); }}>
                    Cancel
                  </button>
                  <button type="button" className="tv-pill-btn sm lead" onClick={handleVerifyMfa}
                    disabled={mfaVerifying || mfaVerifyCode.length !== 6}>
                    {mfaVerifying && <Spinner size={12} />}
                    Verify & enable
                  </button>
                </div>
              </div>
            </div>
          )}

          {!mfaSetupMode && mfaFactors.length > 0 && (
            <>
              {mfaFactors.map((factor) => (
                <TvRow
                  key={factor.id}
                  label={factor.friendly_name || 'Authenticator'}
                  sub={new Date(factor.created_at).toLocaleDateString()}
                >
                  <button
                    type="button"
                    className="tv-pill-btn sm danger"
                    onClick={() => { setUnenrollFactorId(factor.id); setShowUnenrollDialog(true); }}
                    disabled={mfaLoading}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </button>
                </TvRow>
              ))}
              <TvRow label="Backup device">
                <button type="button" className="tv-pill-btn sm" onClick={handleEnrollMfa} disabled={mfaLoading}>
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </button>
              </TvRow>
            </>
          )}
        </TvPod>

        {/* Passkey & Biometrics combined into one minimal pod */}
        <TvPod title="Hardware & Biometrics" icon={<Fingerprint className="h-4 w-4" />} flush>
          <TvRow
            label="Passkey"
            sub={!passkeyAvailable ? 'Unsupported on this device' : hasPasskey ? 'Registered' : 'Not configured'}
          >
            {isCheckingPasskey ? (
              <Spinner size={14} />
            ) : passkeyAvailable && hasPasskey ? (
              <>
                <button type="button" className="tv-pill-btn sm" onClick={handleTestPasskey} disabled={loading}>Test</button>
                <button type="button" className="tv-pill-btn sm" onClick={handleUpdatePasskey} disabled={loading}>Replace</button>
                <button type="button" className="tv-pill-btn sm danger" onClick={() => setShowDeleteDialog(true)} disabled={loading}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            ) : passkeyAvailable ? (
              <button type="button" className="tv-pill-btn sm lead" onClick={handleRegisterPasskey} disabled={loading}>
                <Plus className="h-3.5 w-3.5" />
                Register
              </button>
            ) : null}
          </TvRow>

          <TvRow label="Device biometric lock" sub={hasBiometric ? 'Active' : 'Off'}>
            {!hasBiometric ? (
              <button type="button" className="tv-pill-btn sm" onClick={() => setShowBiometricSetup(true)}>
                Enable
              </button>
            ) : (
              <button type="button" className="tv-pill-btn sm danger" onClick={handleDisableBiometric}>
                Disable
              </button>
            )}
          </TvRow>
        </TvPod>

        {/* Password Pod */}
        <TvPod
          title="Password"
          icon={<Key className="h-4 w-4" />}
          flush={!changingPassword}
          actions={
            !changingPassword ? (
              <button type="button" className="tv-pill-btn sm" onClick={() => setChangingPassword(true)}>
                Update
              </button>
            ) : undefined
          }
        >
          {changingPassword && (
            <form
              className={shakeClass}
              style={{ display: 'grid', gap: 10 }}
              onSubmit={(e) => {
                e.preventDefault();
                if (currentPassword && newPassword && confirmPassword && !loading) handleChangePassword();
              }}
            >
              <input
                type="password"
                className="tv-input"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Current password"
                autoComplete="current-password"
                autoFocus
              />
              <div className="tv-grid-2">
                <input
                  type="password"
                  className="tv-input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password"
                  autoComplete="new-password"
                />
                <input
                  type="password"
                  className="tv-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  autoComplete="new-password"
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
                <button
                  type="button"
                  className="tv-pill-btn sm ghost"
                  onClick={() => { setChangingPassword(false); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="tv-pill-btn sm lead"
                  disabled={!currentPassword || !newPassword || !confirmPassword || loading}
                >
                  {loading && <Spinner size={12} />}
                  Save
                </button>
              </div>
            </form>
          )}
        </TvPod>

        {/* S-Hawk Appeals */}
        {(swkLoading || swkNotices.length > 0) && (
          <TvPod
            title="S-Hawk Notices"
            icon={<ShieldAlert className="h-4 w-4" />}
            actions={unread > 0 ? <TvBadge tone="err" dot>{unread}</TvBadge> : undefined}
            flush
          >
            {swkLoading ? (
              <TvRow label="Checking notices…"><Spinner size={14} /></TvRow>
            ) : (
              swkNotices.map((notice) => (
                <TvRow
                  key={notice.id}
                  label={notice.title}
                  sub={notice.body}
                >
                  {notice.case_id && (
                    <button
                      type="button"
                      className="tv-pill-btn sm"
                      disabled={swkAppealingId === notice.id}
                      onClick={() => handleSwkAppeal(notice)}
                    >
                      {swkAppealingId === notice.id && <Spinner size={12} />}
                      Appeal
                    </button>
                  )}
                </TvRow>
              ))
            )}
          </TvPod>
        )}

        {/* Vault security belongs with the rest of account security. */}
        <VaultSecurityPanel userId={user?.id || ''} onUnlock={() => setVaultOpen(true)} />
      </>
    );
  }

  function renderPlansSection() {
    return (
      <>
        <TvPod
          title={userTier}
          icon={<Crown className="h-4 w-4" />}
          actions={<TvBadge tone={isPremium ? 'ok' : 'neutral'} dot>{isPremium ? 'Active' : 'Standard'}</TvBadge>}
          flush
        >
          <div className="tv-metrics">
            <div className="tv-metric">
              <span>Used</span>
              <b>{formatBytes(storageUsed)}</b>
            </div>
            <div className="tv-metric">
              <span>Files</span>
              <b>{totalFiles}</b>
            </div>
            <div className="tv-metric">
              <span>Expires</span>
              <b>{profile?.subscription_expires_at ? new Date(profile.subscription_expires_at).toLocaleDateString() : '—'}</b>
            </div>
          </div>
          <TvRow label="Subscription">
            <button type="button" className="tv-pill-btn sm" onClick={() => { fetchPaymentLogs(); setPaymentHistoryOpen(true); }}>
              <Calendar className="h-3.5 w-3.5" />
              Billing
            </button>
            <button type="button" className="tv-pill-btn sm lead" onClick={() => navigate('/pricing')}>
              <Crown className="h-3.5 w-3.5" />
              {isPremium ? 'Manage' : 'Upgrade'}
            </button>
          </TvRow>
        </TvPod>

        <TvPod title="Redeem Code">
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="tv-input sa-mono"
              style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}
              placeholder="XXXX-XXXX-XXXX"
              value={redeemCodeInput}
              onChange={(e) => setRedeemCodeInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleRedeemCode()}
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              className="tv-pill-btn lead"
              style={{ height: 42 }}
              onClick={handleRedeemCode}
              disabled={!redeemCodeInput.trim() || redeeming}
            >
              {redeeming && <Spinner size={12} />}
              Apply
            </button>
          </div>
        </TvPod>

        {isPremium && (
          <TvPod danger title="Cancel Plan">
            <CancelSubscriptionFlow
              userId={user?.id || ''}
              planType={profile?.tier}
              billingPeriod={latestPayment?.billing_period || 'monthly'}
              onCancelled={() => { refreshProfile(); fetchPaymentLogs(); }}
            />
          </TvPod>
        )}

        <Dialog open={paymentHistoryOpen} onOpenChange={(open) => { setPaymentHistoryOpen(open); if (!open) setSelectedPayment(null); }}>
          <DialogContent className={isMobile ? 'max-h-[85vh] overflow-y-auto max-w-full p-5' : 'max-h-[85vh] overflow-y-auto max-w-lg p-6'}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                {selectedPayment && (
                  <button type="button" className="tv-pill-btn ghost icon sm" onClick={() => setSelectedPayment(null)}>
                    <Ico.ArrowLeft size={14} />
                  </button>
                )}
                <span>{selectedPayment ? 'Receipt' : 'Billing History'}</span>
              </DialogTitle>
            </DialogHeader>

            {paymentLogsLoading ? (
              <div style={{ padding: 24, display: 'grid', placeItems: 'center' }}><Spinner size={18} /></div>
            ) : selectedPayment ? (
              <div className="tv-pod" style={{ marginTop: 12 }}>
                <TvRow label="Amount"><span className="sa-mono">{formatPaymentAmount(selectedPayment)}</span></TvRow>
                <TvRow label="Status"><TvBadge tone={payTone(selectedPayment.status)}>{selectedPayment.status}</TvBadge></TvRow>
                <TvRow label="Plan">{selectedPayment.plan_type || selectedPayment.plan || '—'}</TvRow>
                <TvRow label="Date">{formatPaymentDate(selectedPayment.created_at)}</TvRow>
                {selectedPayment.tx_hash && (
                  <TvRow label="TX" sub={selectedPayment.tx_hash} />
                )}
              </div>
            ) : paymentLogs.length === 0 ? (
              <div style={{ padding: '32px 12px', textAlign: 'center', color: 'var(--tv-mute)', fontSize: 13 }}>
                No transactions yet
              </div>
            ) : (
              <div className="tv-pod" style={{ marginTop: 12 }}>
                {paymentLogs.map((p) => (
                  <button key={p.id} type="button" className="tv-pay-row" onClick={() => setSelectedPayment(p)}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <TvBadge tone={payTone(p.status)} dot>{p.status}</TvBadge>
                      <span style={{ fontSize: 13 }}>{formatPaymentDate(p.created_at)}</span>
                    </span>
                    <span className="sa-mono" style={{ fontSize: 13 }}>{formatPaymentAmount(p)}</span>
                  </button>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </>
    );
  }

  function renderMigrationSection() {
    if (!migrationJob) {
      return (
        <TvPod title="Cloud & Archive Import" icon={<FileArchive className="h-4 w-4" />} flush>
          <TvRow label="No active transfers">
            <button type="button" className="tv-pill-btn sm lead" onClick={() => setShowImportDialog(true)}>
              <Plus className="h-3.5 w-3.5" />
              Import
            </button>
          </TvRow>
        </TvPod>
      );
    }

    const running = ['scheduled', 'extracting', 'uploading', 'in_progress'].includes(migrationJob.status);
    const pct = migrationJob.total_files > 0
      ? Math.min(100, Math.round((migrationJob.processed_files / migrationJob.total_files) * 100))
      : 0;

    return (
      <TvPod
        title={migrationJob.source_platform?.replace('-', ' ') || 'Import'}
        icon={<FolderOpen className="h-4 w-4" />}
        actions={<TvBadge tone={migTone(migrationJob.status)} dot>{getStatusLabel(migrationJob.status)}</TvBadge>}
        flush
      >
        {migrationJob.total_files > 0 && (
          <div style={{ padding: '16px 20px 4px' }}>
            <div className="tv-meter"><i style={{ width: `${pct}%` }} /></div>
          </div>
        )}
        <div className="tv-metrics">
          <div className="tv-metric"><span>Total</span><b>{migrationJob.total_files || 0}</b></div>
          <div className="tv-metric"><span>Done</span><b>{migrationJob.processed_files || 0}</b></div>
          <div className="tv-metric"><span>Failed</span><b>{migrationJob.failed_files || 0}</b></div>
        </div>
        <TvRow label={migrationJob.error_message || `${pct}% complete`}>
          {running ? (
            <>
              <button type="button" className="tv-pill-btn sm" onClick={() => setShowImportDialog(true)}>
                <RefreshCw className="h-3.5 w-3.5" />
                Inspect
              </button>
              <button type="button" className="tv-pill-btn sm danger" onClick={handleCancelMigration} disabled={cancelling}>
                {cancelling && <Spinner size={12} />}
                Stop
              </button>
            </>
          ) : (
            <button type="button" className="tv-pill-btn sm lead" onClick={() => setShowImportDialog(true)}>
              <Plus className="h-3.5 w-3.5" />
              New Import
            </button>
          )}
        </TvRow>
      </TvPod>
    );
  }

  function renderDeveloperSection() {
    return (
      <>
        <ApiKeyManagement />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="tv-pill-btn sm" onClick={() => navigate('/developer-api')}>
            <Book className="h-3.5 w-3.5" />
            API Docs
          </button>
        </div>
      </>
    );
  }

  function renderWebhooksSection() {
    return (
      <>
        <WebhookManager open={false} onClose={() => {}} standalone />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="tv-pill-btn sm" onClick={() => navigate('/webhooks')}>
            <Book className="h-3.5 w-3.5" />
            Webhook Docs
          </button>
        </div>
      </>
    );
  }

  function renderPreferencesSection() {
    return (
      <>
        {preferenceCategories.map((category) => (
          <TvPod key={category.id} title={category.title} flush>
            {category.items.map((item) => (
              <TvRow key={item.key} label={item.label}>
                <Switch
                  checked={accountPreferences[item.key]}
                  onCheckedChange={(checked) => updatePreference(item.key, checked)}
                  aria-label={item.label}
                />
              </TvRow>
            ))}
          </TvPod>
        ))}

        <TvPod title="Renewal Alerts" flush>
          <TvRow label="Email reminders">
            <Switch checked={notifPrefs.email_enabled} onCheckedChange={(v) => updateNotifPref('email_enabled', v)} />
          </TvRow>
          <TvRow label="In-app alerts">
            <Switch checked={notifPrefs.popup_enabled} onCheckedChange={(v) => updateNotifPref('popup_enabled', v)} />
          </TvRow>
          <TvRow label="Lead time">
            <select
              className="tv-select"
              value={notifPrefs.warning_lead_days}
              onChange={(e) => updateNotifPref('warning_lead_days', parseInt(e.target.value, 10))}
            >
              <option value={1}>1 day</option>
              <option value={3}>3 days</option>
              <option value={7}>7 days</option>
            </select>
          </TvRow>
          <TvRow label="Silence win-back emails">
            <Switch checked={notifPrefs.do_not_contact} onCheckedChange={(v) => updateNotifPref('do_not_contact', v)} />
          </TvRow>
        </TvPod>
      </>
    );
  }

  const sectionRenderers: Record<SettingsCategory, () => React.ReactNode> = {
    profile: renderProfileSection,
    security: renderSecuritySection,
    plans: renderPlansSection,
    byok: () => (
      <div className="tv-stack tv-enc">
        <BYOKSettingsCard className="tv-enc-card" />
        <SDESettingsCard className="tv-enc-card" />
        <VaultRecoveryCard
          emailVerified={!!user?.email_confirmed_at}
          totpEnabled={mfaFactors.length > 0}
          hasPasskey={hasPasskey}
          userEmail={user?.email}
        />
      </div>
    ),
    developer: renderDeveloperSection,
    webhooks: renderWebhooksSection,
    devices: () => <CliDevicesSection />,
    migration: renderMigrationSection,
    preferences: renderPreferencesSection,
  };

  const current = SETTINGS_CATEGORIES.find((c) => c.id === activeCategory) ?? SETTINGS_CATEGORIES[0];
  useDocTitle(`${current.label} · Settings`);

  const jellySpring = reduce
    ? { duration: 0.01 }
    : { type: 'spring' as const, stiffness: 460, damping: 22, mass: 0.8 };
  const thumbSpring = reduce
    ? { duration: 0.01 }
    : { type: 'spring' as const, stiffness: 380, damping: 21, mass: 0.8 };
  const tapSpring = reduce
    ? { duration: 0.01 }
    : { type: 'spring' as const, stiffness: 600, damping: 16 };

  return (
    <AppShell>
      <style>{TV_CSS}</style>

      <div className="tv-root" style={{ background: 'var(--sa-bg, #090b0a)', backgroundImage: 'none', minHeight: '100vh' }}>
        {/* ── Minimal Floating HUD ── */}
        <header className="tv-hud">
          <Link to="/dashboard" className="tv-pill-btn sm" aria-label="Back to dashboard">
            <Ico.ArrowLeft size={14} />
            <span>Files</span>
          </Link>

          <div className="tv-hud-r">
            <button
              type="button"
              className="tv-pill-btn sm"
              onClick={() => (vaultState ? (lockVault(), setVaultState(false)) : setVaultOpen(true))}
            >
              <span
                className="tv-dot"
                style={{ color: vaultState ? 'var(--tv-ok)' : 'var(--tv-mute)' }}
              />
              <span>Vault {vaultState ? 'Unlocked' : 'Locked'}</span>
            </button>

            <button
              type="button"
              className="tv-pill-btn sm danger icon"
              onClick={signOut}
              title="Sign Out"
              aria-label="Sign Out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </header>

        {/* ── Settings shell: grouped glass rail + content pane ── */}
        <div className="tv-layout">
          <nav className="tv-rail" style={{ background: 'transparent', border: 0, boxShadow: 'none' }} role="tablist" aria-label="Settings navigation" aria-orientation="vertical" onKeyDown={onDockKey}>
            {SETTINGS_GROUPS.map((group) => (
              <div className="tv-rail-group" key={group.label}>
                <span className="tv-rail-label">{group.label}</span>
                {group.ids.map((id) => {
                  const cat = SETTINGS_CATEGORIES.find((c) => c.id === id)!;
                  const Icon = cat.icon;
                  const active = activeCategory === id;
                  return (
                    <motion.button
                      key={id} type="button" role="tab" aria-selected={active} tabIndex={active ? 0 : -1}
                      className="tv-rail-item"
                      whileHover={reduce ? undefined : { x: 2 }}
                      whileTap={reduce ? undefined : { scale: 0.97 }}
                      transition={reduce ? { duration: 0.01 } : tapSpring}
                      onClick={() => { setActiveCategory(id); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    >
                      {active && <motion.span layoutId="tv-rail-thumb" className="tv-rail-thumb" transition={thumbSpring} />}
                      <Icon className="h-4 w-4" strokeWidth={1.7} />
                      <span className="tv-rail-text">{cat.label}</span>
                    </motion.button>
                  );
                })}
              </div>
            ))}
          </nav>

          <main className="tv-pane">
            <div className="tv-pane-head">
              <h1>{current.label}</h1>
              <p className="tv-pane-sub">{user?.email}</p>
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeCategory}
                className="tv-stack"
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
                animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
                transition={{ duration: reduce ? 0.01 : 0.18, ease: [0.16, 1, 0.3, 1] }}
              >
                {sectionRenderers[activeCategory]()}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>

      {/* ── Dialogs ── */}
      <VaultUnlockDialog
        open={vaultOpen}
        userId={user?.id || ''}
        onClose={() => setVaultOpen(false)}
        onUnlocked={() => setVaultState(true)}
        reason="Unlock your vault key to access encrypted files."
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Passkey?</AlertDialogTitle>
            <AlertDialogDescription>
              This disables passkey sign-in until you register a new key.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePasskey}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? <Spinner size={14} /> : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {user && (
        <BiometricSetupDialog
          open={showBiometricSetup}
          onClose={() => setShowBiometricSetup(false)}
          onComplete={handleBiometricSetupComplete}
        />
      )}

      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Files</DialogTitle>
          </DialogHeader>
          <MigrationWizard
            onComplete={() => { setShowImportDialog(false); fetchLatestMigration(); }}
            onCancel={() => setShowImportDialog(false)}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={showUnenrollDialog} onOpenChange={setShowUnenrollDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable Two-Factor Authentication?</AlertDialogTitle>
            <AlertDialogDescription>
              Your account will no longer ask for an authenticator code at sign-in.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mfaLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnenrollMfa}
              disabled={mfaLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {mfaLoading ? <Spinner size={14} /> : 'Disable'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
};

export default AccountSettings;
