import { z } from 'zod';

export const ProjectConfigSchema = z.object({
  id: z.string().min(1, 'project.id is required'),
  name: z.string().min(1, 'project.name is required'),
  environment: z.enum(['production', 'staging', 'development']).default('production'),
});

export const DaemonConfigSchema = z.object({
  auto_start: z.boolean().default(true),
  auto_inject: z.boolean().default(true),
  kernel_mode: z.enum(['auto', 'fuse', 'xpc', 'binder', 'winpipe']).default('auto'),
});

export const PolicyConfigSchema = z.object({
  fail_closed: z.boolean().default(true),
  audit: z.boolean().default(true),
  allow_print: z.boolean().default(false),
  ref_ttl: z.number().int().positive().default(60),
  ref_max_uses: z.number().int().positive().default(1),
});

export const SecretsFilterSchema = z.object({
  allow: z.array(z.string()).default([]),
  deny: z.array(z.string()).default([]),
});

export const ProxyConfigSchema = z.object({
  enabled: z.boolean().default(true),
  intercept_http: z.boolean().default(true),
});

export const SquidVeilConfigSchema = z.object({
  project: ProjectConfigSchema,
  daemon: DaemonConfigSchema.optional().default({}),
  policy: PolicyConfigSchema.optional().default({}),
  secrets: SecretsFilterSchema.optional().default({}),
  proxy: ProxyConfigSchema.optional().default({}),
});

export type SquidVeilConfig = z.infer<typeof SquidVeilConfigSchema>;

export const ProxySecretSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['http_auth', 'hmac_sign', 'connection_string', 'aes_gcm']),
  inject_header: z.string().optional(),
  inject_format: z.string().optional(),
  allowed_hosts: z.array(z.string()).default([]),
  allowed_paths: z.array(z.string()).default([]),
  methods: z.array(z.string()).default([]),
  rate_limit: z.number().int().positive().optional(),
  ref_ttl: z.number().int().positive().optional(),
  algorithm: z.string().optional(),
  output_header: z.string().optional(),
  key_size: z.number().int().positive().optional(),
  signing_algo: z.string().optional(),
});

export const SquidProxyConfigSchema = z.object({
  secret: z.array(ProxySecretSchema).default([]),
});

export type SquidProxyConfig = z.infer<typeof SquidProxyConfigSchema>;
export type ProxySecret = z.infer<typeof ProxySecretSchema>;

export function parseSquidVeilConfig(toml: string): SquidVeilConfig {
  const parsed = TOML.parse(toml);
  return SquidVeilConfigSchema.parse(parsed);
}

export function parseSquidProxyConfig(toml: string): SquidProxyConfig {
  const parsed = TOML.parse(toml);
  return SquidProxyConfigSchema.parse(parsed);
}

export function isSecretAllowed(config: SquidVeilConfig, name: string): boolean {
  const { allow, deny } = config.secrets;
  if (allow.length > 0) {
    if (!allow.some((p) => globMatch(p, name))) return false;
  }
  if (deny.some((p) => globMatch(p, name))) return false;
  return true;
}

function globMatch(pattern: string, name: string): boolean {
  if (pattern === '*') return true;
  if (pattern === name) return true;
  if (pattern.endsWith('*')) return name.startsWith(pattern.slice(0, -1));
  if (pattern.startsWith('*')) return name.endsWith(pattern.slice(1));
  return false;
}

// Minimal TOML parser for browser use (no toml dep needed)
const TOML = {
  parse(input: string): Record<string, any> {
    const root: Record<string, any> = {};
    let currentSection = root;
    const lines = input.split('\n');

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#') || line.startsWith('//')) continue;

      const sectionMatch = line.match(/^\[([^\]]+)\]$/);
      if (sectionMatch) {
        const keys = sectionMatch[1].split('.');
        currentSection = root;
        for (const key of keys) {
          const k = key.trim();
          if (!currentSection[k]) currentSection[k] = {};
          currentSection = currentSection[k];
        }
        continue;
      }

      const kvMatch = line.match(/^([^=]+)=\s*(.+)$/);
      if (kvMatch) {
        const key = kvMatch[1].trim();
        const rawValue = kvMatch[2].trim();
        currentSection[key] = parseTOMLValue(rawValue);
      }

      // Handle [[array]] tables
      const arrayMatch = line.match(/^\[\[([^\]]+)\]\]$/);
      if (arrayMatch) {
        const keys = arrayMatch[1].split('.');
        let section = root;
        for (let i = 0; i < keys.length; i++) {
          const k = keys[i].trim();
          if (i === keys.length - 1) {
            if (!section[k]) section[k] = [];
            const newItem: Record<string, any> = {};
            section[k].push(newItem);
            currentSection = newItem;
          } else {
            if (!section[k]) section[k] = {};
            section = section[k];
          }
        }
      }
    }

    return root;
  },
};

function parseTOMLValue(raw: string): any {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1);
  }
  const num = Number(raw);
  if (!isNaN(num)) return num;
  if (raw.startsWith('[') && raw.endsWith(']')) {
    return raw.slice(1, -1).split(',').map((s) => parseTOMLValue(s.trim())).filter((v) => v !== undefined);
  }
  return raw;
}
