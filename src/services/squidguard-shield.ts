type TimerId = ReturnType<typeof setInterval>;

export interface ShieldConfig {
  frictionOnDevtools: boolean;
  consoleWarnings: boolean;
  tokenProtection: boolean;
  detectionInterval: number;
}

export interface ActionToken {
  nonce: string;
  action: string;
  resource: string;
  timestamp: number;
  expiresAt: number;
  signature: string;
}

const TOKEN_PATTERNS = [
  /sbp_[a-zA-Z0-9-_]+/,
  /eyJ[a-zA-Z0-9-_]+\.eyJ[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+/,
  /ghp_[a-zA-Z0-9]{36}/,
  /gho_[a-zA-Z0-9]{36}/,
  /github_pat_[a-zA-Z0-9]{22,}/,
  /cb_[a-f0-9]{64}/,
];

class SquidGuardShield {
  private devtoolsOpen = false;
  private initialized = false;
  private warningPrinted = false;
  private detectionTimer: TimerId | null = null;
  private listeners: Set<(open: boolean) => void> = new Set();
  private tokenListeners: Set<(found: string[]) => void> = new Set();
  private actionTokens: Map<string, ActionToken> = new Map();

  private config: ShieldConfig = {
    frictionOnDevtools: true,
    consoleWarnings: true,
    tokenProtection: true,
    detectionInterval: 3000,
  };

  configure(cfg: Partial<ShieldConfig>) {
    this.config = { ...this.config, ...cfg };
  }

  get isDevtoolsOpen() {
    return this.devtoolsOpen;
  }

  subscribe(fn: (open: boolean) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  onTokenLeak(fn: (found: string[]) => void): () => void {
    this.tokenListeners.add(fn);
    return () => this.tokenListeners.delete(fn);
  }

  // ─── Detection Engine ────────────────────────────────────────

  start() {
    if (this.initialized) return;
    this.initialized = true;

    this.checkNow();

    this.detectionTimer = setInterval(() => this.checkNow(), this.config.detectionInterval);

    window.addEventListener('resize', () => {
      const w = window.outerWidth - window.innerWidth;
      const h = window.outerHeight - window.innerHeight;
      if (w > 160 || h > 160) this.onDevtoolsOpened();
    });

    Object.defineProperty(document, '__squidguard_console', {
      get: () => {
        this.onDevtoolsOpened();
        return true;
      },
    });
  }

  stop() {
    if (this.detectionTimer) clearInterval(this.detectionTimer);
    this.initialized = false;
    this.detectionTimer = null;
  }

  checkNow(): boolean {
    if (this.checkDebugger()) {
      this.onDevtoolsOpened();
      return true;
    }

    const fb = (window as any).firebug;
    if (fb?.chrome?.isInitialized) {
      this.onDevtoolsOpened();
      return true;
    }

    if (this.config.tokenProtection) this.scanForTokens();

    return this.devtoolsOpen;
  }

  private checkDebugger(): boolean {
    const start = performance.now();
    debugger;
    return performance.now() - start > 100;
  }

  private onDevtoolsOpened() {
    if (this.devtoolsOpen) return;
    this.devtoolsOpen = true;
    this.fire();
    if (this.config.consoleWarnings) this.printWarning();
  }

  private printWarning() {
    if (this.warningPrinted) return;
    this.warningPrinted = true;

    console.log(
      `%c   _____  ____  _    _ _ _____ _____   \n  / ____|/ __ \\| |  | |_   _|  __ \\ \n| (___ | |  | | |  | | | | | |  | |\n  \\___ \\| |  | | |  | | | | | |  | |\n  ____) | |__| | |__| |_| |_| |__| |\n|_____/ \\___\\_\\\\____/|_____|_____/ \n                                     \n                                     \n   STOP.`,
      'color:#4FC3F7;font-weight:bold;font-size:14px;'
    );
    console.log(
      '%cIf someone told you to paste code here, it is very likely a scam.',
      'color:#F44336;font-size:16px;font-weight:bold;'
    );
    console.log(
      '%cPasting code here can let an attacker take over your SquidCloud account — access your files, delete data, or impersonate you. SquidCloud will never ask you to paste anything into this console.',
      'color:#FFFFFF;font-size:13px;'
    );
  }

  // ─── Token Scanner ───────────────────────────────────────────

  scanForTokens(): string[] {
    const found: string[] = [];
    const seen = new Set<string>();

    const check = (value: string) => {
      for (const p of TOKEN_PATTERNS) {
        const m = value.match(p);
        if (m && !seen.has(m[0])) {
          seen.add(m[0]);
          found.push(m[0].slice(0, 12) + '...');
        }
      }
    };

    try {
      for (const key of Object.getOwnPropertyNames(window)) {
        try {
          const val = (window as any)[key];
          if (typeof val === 'string') check(val);
        } catch {}
      }
    } catch {}

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          check(key);
          try {
            const val = localStorage.getItem(key);
            if (val) check(val);
          } catch {}
        }
      }
    } catch {}

    if (found.length > 0) {
      console.warn(
        `%c[SquidGuard] ⚠ ${found.length} potential token(s) detected in accessible scope`,
        'color:#FF9800;font-weight:bold;'
      );
      this.tokenListeners.forEach(fn => fn(found));
    }

    return found;
  }

  // ─── Sensitive Action Tokens ─────────────────────────────────

  async requireActionToken(action: string, resource: string): Promise<ActionToken> {
    if (this.devtoolsOpen) {
      throw new Error('SquidGuard: DevTools open — sensitive action blocked');
    }

    const nonce = crypto.randomUUID();
    const secret = crypto.randomUUID();
    const now = Date.now();

    const token: ActionToken = {
      nonce,
      action,
      resource,
      timestamp: now,
      expiresAt: now + 60_000,
      signature: await this.signToken(nonce, action, resource, secret),
    };

    this.actionTokens.set(nonce, token);
    setTimeout(() => this.actionTokens.delete(nonce), 60_000);
    return token;
  }

  validateActionToken(nonce: string, action: string, resource: string): boolean {
    const token = this.actionTokens.get(nonce);
    if (!token) return false;
    if (Date.now() > token.expiresAt) {
      this.actionTokens.delete(nonce);
      return false;
    }
    if (token.action !== action || token.resource !== resource) return false;
    this.actionTokens.delete(nonce);
    return true;
  }

  private async signToken(
    nonce: string,
    action: string,
    resource: string,
    secret: string,
  ): Promise<string> {
    const data = `${nonce}:${action}:${resource}:${secret}`;
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // ─── Internal ────────────────────────────────────────────────

  private fire() {
    this.listeners.forEach(fn => fn(this.devtoolsOpen));
  }
}

export const squidguard = new SquidGuardShield();
