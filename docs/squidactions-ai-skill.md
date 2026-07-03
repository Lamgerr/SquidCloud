---
title: SquidActions AI Skill
description: Complete reference for building SquidScript automation pipelines with SquidActions. Copy-paste this to any AI.
---

# SquidActions AI Skill — Complete Reference

## Overview

SquidActions is the visual automation engine for SquidCloud. Users build **pipelines** by dragging **components** onto a canvas, connecting them with edges, and configuring sub-options. The visual graph auto-generates **SquidScript YAML** that runs on the edge.

## Architecture

```
Visual Canvas (React Flow) → YAML → Supabase Edge Function → Vercel Edge
       ↕ auto-sync                 ↕ CRUD via API              ↕ execution
Component Registry           Database tables              Run Jobs/Steps
Variable Registry            (squid_scripts,              (squid_run_jobs,
                              squid_script_triggers,        squid_run_steps)
                              squid_script_runs,
                              squid_vault_secrets)
```

- **Frontend**: React (Vite + shadcn/ui + Tailwind) with @xyflow/react pipeline canvas
- **YAML Storage**: `squid_scripts.yaml_content` (text column)
- **Execution**: `squid-automation-engine` Supabase edge function (action-based dispatch)
- **Variables**: `${{ squid.* }}` template syntax, resolved at runtime by the engine

## Pipeline YAML Format

```yaml
name: my-pipeline
description: Handles file upload notifications
on:
  manual: true            # manual trigger only
  # scheduled: '0 */6 * * *'    # every 6 hours
  # webhook:                 # HTTP POST to trigger
  #   path: /webhooks/my-hook
  # file_change:            # triggers on file events
  #   path: /uploads/**
  #   events: [create, update]
jobs:
  job-1:
    name: Process Uploads
    steps:
      - name: Scan file
        action: squidcloud/scan
        with:
          path: "{{ squid.file.path }}"
          scan_type: malware

      - name: Send notification
        action: squidcloud/slack
        with:
          webhook_url: "{{ vault.slack_webhook }}"
          message: "File scanned: {{ squid.file.name }}"
```

## Trigger Types

| Type | Config Key | Description |
|------|-----------|-------------|
| Manual | `manual: true` | User clicks Run in dashboard |
| Scheduled | `scheduled: 'cron_expr'` | Cron-based scheduling |
| Webhook | `webhook.path` | External HTTP POST triggers pipeline |
| File Change | `file_change.path` | Watches storage path for events |
| Pipeline Complete | `pipeline_complete: [name]` | Chained execution |

## Component Categories

### ⚡ triggers (9 components)
Pipeline starting points. Each pipeline should have one trigger.

| ID | Name | Config |
|----|------|--------|
| `manual` | Manual Trigger | — |
| `scheduled` | Scheduled Trigger | `cron` (string), `timezone` |
| `webhook` | Webhook Receiver | `path` (string), `method` (select: POST/GET/PUT) |
| `file_change` | File Change | `path` (glob), `events[]` (create/update/delete/move) |
| `pipeline_complete` | Pipeline Complete | `pipeline` (string) |
| `http-endpoint` | HTTP Endpoint | `method`, `path`, `auth` |
| `email-received` | Email Received | `mailbox`, `filter` |
| `time-scheduled` | Time Schedule | `cron`, `timezone`, `start_date` |
| `storage-event` | Storage Event | `bucket`, `events[]`, `prefix` |

### 📄 file_ops (18 components)
File operations on SquidCloud storage.

| ID | Name | Key Config |
|----|------|------------|
| `file-copy` | Copy File | `source`, `destination` |
| `file-move` | Move File | `source`, `destination` |
| `file-delete` | Delete File | `path`, `permanent` (bool) |
| `file-rename` | Rename File | `path`, `new_name` |
| `file-upload` | Upload File | `url`, `path`, `overwrite` (bool) |
| `file-download` | Download File | `url`, `path` |
| `file-compress` | Compress File | `source`, `format` (zip/tar/gz/7z) |
| `file-extract` | Extract Archive | `source`, `destination` |
| `file-sync` | Sync Folder | `source`, `destination`, `direction` (push/pull) |
| `file-scan` | File Scan | `path`, `scan_type` (malware/mime/meta) |
| `file-watch` | Watch Folder | `path`, `events[]`, `recursive` (bool) |
| `file-lock` | Lock File | `path`, `duration` |
| `file-unlock` | Unlock File | `path` |
| `file-restore` | Restore File | `path`, `version` |
| `file-deduplicate` | Deduplicate Files | `folder`, `strategy` (hash/name/size) |
| `file-version` | Version File | `path`, `keep` (number) |
| `file-chmod` | Change Permissions | `path`, `mode` (octal string) |
| `file-tag` | Tag File | `path`, `tags` (list) |

### 📊 data (7 components)
Data transformation and processing.

| ID | Name | Key Config |
|----|------|------------|
| `transform` | Transform | `format` (json/csv/xml/yaml), `operation` (convert/filter/map/validate) |
| `template` | Template | `template` (string), `engine` (handlebars/liquid/go) |
| `csv-parse` | Parse CSV | `source`, `delimiter`, `has_header` (bool) |
| `json-parse` | Parse JSON | `source`, `query` (jsonpath) |
| `xml-parse` | Parse XML | `source`, `xpath` |
| `data-merge` | Merge Data | `sources[]`, `strategy` (merge/union/join) |
| `data-validate` | Validate Data | `source`, `schema` (json-schema string) |

### 🌐 network (8 components)
HTTP and network operations.

| ID | Name | Key Config |
|----|------|------------|
| `http-request` | HTTP Request | `url`, `method`, `headers[]`, `body`, `timeout` |
| `webhook-send` | Send Webhook | `url`, `method`, `payload`, `secret` |
| `api-call` | API Call | `endpoint`, `method`, `headers[]`, `body` |
| `graphql-query` | GraphQL Query | `endpoint`, `query`, `variables` |
| `rest-query` | REST Query | `base_url`, `path`, `method` |
| `web-scrape` | Web Scrape | `url`, `selector`, `attribute` |
| `dns-lookup` | DNS Lookup | `hostname`, `record_type` (A/AAAA/MX/CNAME/TXT) |
| `ip-geolocate` | IP Geolocation | `ip_address` |

### 🔐 security (5 components)
Security and encryption operations.

| ID | Name | Key Config |
|----|------|------------|
| `encrypt` | Encrypt | `data`, `algorithm` (aes-256/rsa/chacha20), `key` |
| `decrypt` | Decrypt | `data`, `algorithm`, `key` |
| `hash` | Hash | `data`, `algorithm` (sha256/md5/blake2) |
| `sign` | Sign | `data`, `algorithm` (rsa/ed25519/hmac) |
| `verify` | Verify | `data`, `signature`, `algorithm` |

### 🤖 ai_ml (6 components)
AI/ML integrations.

| ID | Name | Key Config |
|----|------|------------|
| `ai-text` | AI Text | `prompt`, `model` (gpt4/claude/llama), `temperature` |
| `ai-image` | AI Image | `prompt`, `model` (dalle3/stable-diffusion), `size`, `quality` |
| `ai-classify` | AI Classify | `data`, `categories[]`, `model` |
| `ai-extract` | AI Extract | `data`, `schema` (JSON fields to extract) |
| `ai-translate` | AI Translate | `text`, `source_lang`, `target_lang`, `model` |
| `ai-embed` | AI Embed | `text`, `model`, `dimensions` |

### 🎬 media (7 components)
Media processing.

| ID | Name | Key Config |
|----|------|------------|
| `image-resize` | Resize Image | `source`, `width`, `height`, `fit` (cover/contain/fill) |
| `image-crop` | Crop Image | `source`, `x`, `y`, `width`, `height` |
| `image-convert` | Convert Image | `source`, `format` (png/jpeg/webp/avif/gif) |
| `video-convert` | Convert Video | `source`, `format` (mp4/webm/avi), `codec` |
| `audio-convert` | Convert Audio | `source`, `format` (mp3/wav/flac/aac) |
| `media-extract` | Extract Media | `source`, `type` (audio/thumbnail/metadata) |
| `ocr-process` | OCR Process | `source`, `language`, `engine` (tesseract/vision) |

### 🔔 notifications (6 components)
Notification channels.

| ID | Name | Key Config |
|----|------|------------|
| `slack-message` | Send Slack | `webhook_url`, `channel`, `message`, `blocks` (JSON) |
| `discord-message` | Send Discord | `webhook_url`, `message`, `embeds[]` |
| `email-send` | Send Email | `to[]`, `subject`, `body`, `from` |
| `push-notification` | Push Notification | `device_tokens[]`, `title`, `body`, `data` (JSON) |
| `sms-send` | Send SMS | `to`, `message`, `provider` (twilio/vonage) |
| `telegram-message` | Telegram | `bot_token`, `chat_id`, `text`, `parse_mode` |

### 🔄 control_flow (7 components)
Pipeline flow control.

| ID | Name | Key Config |
|----|------|------------|
| `condition` | Condition | `variable`, `operator` (eq/neq/gt/gte/lt/lte/contains/matches), `value` |
| `for-loop` | For Each | `list` (array var), `variable_name`, `max_iterations` |
| `delay` | Delay | `duration` (seconds), `until` (ISO timestamp) |
| `try-catch` | Try/Catch | — |
| `switch` | Switch | `variable`, `cases[]` (pattern/target) |
| `retry` | Retry | `max_attempts`, `delay_seconds`, `backoff` (linear/exponential) |
| `parallel` | Parallel | `branches[]`, `max_concurrency` |

### 🔧 utilities (7 components)
General utilities.

| ID | Name | Key Config |
|----|------|------------|
| `echo` | Echo | `message` (string), `variable` (output variable name) |
| `log-message` | Log | `level` (info/warn/error/debug), `message` |
| `custom-script` | Custom Script | `language` (javascript/python/bash), `code`, `timeout` |
| `uuid-generate` | Generate UUID | `version` (4/5/7) |
| `timestamp` | Timestamp | `format` (iso/unix/rfc3339), `timezone` |
| `random` | Random | `type` (number/string/uuid), `min`, `max`, `length` |
| `base64` | Base64 | `data`, `operation` (encode/decode) |

### 💾 storage (6 components)
External storage.

| ID | Name | Key Config |
|----|------|------------|
| `s3-upload` | S3 Upload | `bucket`, `region`, `key`, `file`, `acl` |
| `s3-download` | S3 Download | `bucket`, `region`, `key` |
| `s3-list` | S3 List | `bucket`, `region`, `prefix`, `max_keys` |
| `s3-delete` | S3 Delete | `bucket`, `region`, `key` |
| `gcs-upload` | GCS Upload | `bucket`, `key`, `file` |
| `gcs-download` | GCS Download | `bucket`, `key` |

### 💻 system (5 components)
System operations.

| ID | Name | Key Config |
|----|------|------------|
| `system-info` | System Info | `type` (memory/disk/cpu/os) |
| `environment` | Environment | `variables[]` (to read or set) |
| `http-serve` | HTTP Serve | `port`, `path`, `response` (static JSON) |
| `cache-get` | Cache Get | `key`, `ttl` |
| `cache-set` | Cache Set | `key`, `value`, `ttl` |

## Variable Reference

All variables use `${{ squid.* }}` syntax. Available categories:

### User
- `squid.user.id` — User UUID
- `squid.user.email` — Email address
- `squid.user.name` — Display name
- `squid.user.avatar_url` — Avatar URL
- `squid.user.created_at` — Account creation date

### Session
- `squid.session.id` — Session token ID
- `squid.session.ip` — Client IP
- `squid.session.user_agent` — User agent
- `squid.session.country` — Country code
- `squid.session.city` — City name

### File
- `squid.file.id` — File UUID
- `squid.file.name` — Filename
- `squid.file.extension` — File extension
- `squid.file.mime_type` — MIME type
- `squid.file.size` — Size in bytes
- `squid.file.size_formatted` — Human size
- `squid.file.path` — Full path
- `squid.file.hash` — File hash
- `squid.file.created_at` — Upload date
- `squid.file.updated_at` — Last modified

### Share
- `squid.share.id`, `squid.share.url`, `squid.share.password_protected`, `squid.share.expires_at`, `squid.share.download_count`, `squid.share.created_at`

### Site
- `squid.site.id`, `squid.site.url`, `squid.site.status`, `squid.site.visibility`, `squid.site.published_at`

### Analytics
- `squid.analytics.total_files`, `squid.analytics.total_storage`, `squid.analytics.total_shares`, `squid.analytics.total_downloads`, `squid.analytics.storage_formatted`, `squid.analytics.usage_pct`

### Pipeline
- `squid.pipeline.id`, `squid.pipeline.name`, `squid.pipeline.status`, `squid.pipeline.run_id`, `squid.pipeline.step_name`, `squid.pipeline.attempt`

### Environment
- `squid.environment.name`, `squid.environment.region`, `squid.environment.platform`, `squid.environment.version`

### Vault
- `squid.vault.secret.*` — Named secrets (user-defined keys only)

### Date/Time
- `squid.date.now`, `squid.date.today`, `squid.date.weekday`, `squid.date.month`, `squid.date.year`, `squid.date.timezone`

## Best Practices

### Pipeline Design
1. **Single Responsibility**: Each pipeline should handle one workflow (e.g., "process upload", not "do everything")
2. **Error Handling**: Wrap fallible steps (network calls, file ops) in try-catch components
3. **Naming**: Give pipelines descriptive names and descriptions. Name steps clearly.
4. **Variable Usage**: Use `${{ squid.* }}` for dynamic values, never hardcode paths or IDs
5. **Secrets**: Store API keys, tokens, and passwords in Vault secrets (`squid.vault.secret.*`), never in YAML
6. **Idempotency**: Design pipelines to be safe to re-run (check if target exists before create)
7. **Logging**: Add log steps at decision points to help debug

### YAML Conventions
1. Use `name:` for all steps — this appears as the node label in visual editor
2. Use `with:` block for config, keep it flat (avoid nested objects)
3. Boolean values: `true`/`false` (no quotes)
4. Lists use bracket notation: `events: [create, update]`
5. Strings with spaces or special chars: quote with `"..."`

### Performance
1. Use `scheduled` triggers for periodic tasks (don't use delays in infinite loops)
2. Set `max_iterations` on for-each loops to prevent runaway execution
3. Use `parallel` for independent branches to reduce total execution time
4. Set reasonable `timeout` on HTTP requests (default 30s)
5. Cache expensive lookups with cache-get/set components

### Security
1. Webhook endpoints should use a `secret` for verification
2. Store API keys in Vault, not in component config
3. Use `${{ squid.user.id }}` for user-scoped operations
4. File scan with `malware` type before processing uploads
5. Limit `retry` max attempts to prevent abuse (max 5)

## Visual Editor Features

- **Palette**: Left sidebar with categorized components. Click to add, or drag to position.
- **Canvas**: React Flow workspace. Drag nodes, connect with edges (drag from right dot).
- **Variables Panel**: Right sidebar with searchable variable list. Click to copy `${{ token }}`.
- **Sub-Components**: Click expandable sections in node cards to configure options.
- **Auto-YAML**: Every visual change generates YAML automatically. Switch between Visual/YAML tabs.
- **Toolbar**: Save 💾, Copy 📋, Download ⬇, Fullscreen ⬜, Toggle Sidebar 👁
- **Stats**: Component count + variable count shown in toolbar badges.

## Example Pipelines

### Example 1: Upload Scanner
```yaml
name: Upload Security Scanner
description: Scans new uploads for malware and notifies
on:
  file_change:
    path: /uploads/**
    events: [create]
jobs:
  scan:
    name: Scan and Notify
    steps:
      - name: Malware scan
        action: squidcloud/scan
        with:
          path: "{{ squid.file.path }}"
          scan_type: malware
      - name: Check result
        action: squidcloud/condition
        with:
          variable: "{{ steps.scan.result }}"
          operator: eq
          value: "clean"
      - name: Log clean file
        action: squidcloud/log
        with:
          level: info
          message: "File clean: {{ squid.file.name }}"
      - name: Move to quarantine
        action: squidcloud/file-move
        with:
          source: "{{ squid.file.path }}"
          destination: "/quarantine/{{ squid.file.name }}"
```

### Example 2: Daily Backup
```yaml
name: Daily Backup
description: Creates compressed backup of important folder
on:
  scheduled: '0 2 * * *'
jobs:
  backup:
    name: Backup Job
    steps:
      - name: Create archive
        action: squidcloud/compress
        with:
          source: /important-docs/
          format: zip
      - name: Upload backup
        action: squidcloud/s3-upload
        with:
          bucket: backups
          region: us-east-1
          key: "backup-{{ squid.date.today }}.zip"
      - name: Notify success
        action: squidcloud/slack
        with:
          webhook_url: "{{ vault.slack_webhook }}"
          message: "Backup completed: backup-{{ squid.date.today }}.zip"
```

### Example 3: Multi-Service Notifier
```yaml
name: Cross-platform Notification
description: Sends alerts to multiple services in parallel
on:
  manual: true
jobs:
  notify:
    name: Send Notifications
    steps:
      - name: Parallel notifications
        action: squidcloud/parallel
        with:
          max_concurrency: 3
      - name: Slack notification
        action: squidcloud/slack
        with:
          webhook_url: "{{ vault.slack_webhook }}"
          message: "Alert: {{ squid.pipeline.run_id }}"
      - name: Discord notification
        action: squidcloud/discord
        with:
          webhook_url: "{{ vault.discord_webhook }}"
          message: "Alert: {{ squid.pipeline.run_id }}"
      - name: Email notification
        action: squidcloud/email-send
        with:
          to: ["admin@example.com"]
          subject: "Pipeline Alert"
          body: "Run ID: {{ squid.pipeline.run_id }}"
```

## API Reference

### Script CRUD (via `squid-automation-engine` edge function)

All calls: `POST https://abc.supabase.co/functions/v1/squid-automation-engine`
Headers: `Authorization: Bearer <anon-key>`, `Content-Type: application/json`

**Action: `create-script`**
```json
{ "action": "create-script", "name": "...", "description": "...", "yaml_content": "...", "parsed_config": {} }
```

**Action: `update-script`**
```json
{ "action": "update-script", "script_id": "...", "name": "...", "description": "...", "yaml_content": "...", "parsed_config": {} }
```

**Action: `get-script`**
```json
{ "action": "get-script", "script_id": "..." }
```

**Action: `list-scripts`**
```json
{ "action": "list-scripts" }
```

**Action: `delete-script`**
```json
{ "action": "delete-script", "script_id": "..." }
```

**Action: `trigger-run`**
```json
{ "action": "trigger-run", "script_id": "..." }
```

**Action: `list-runs`**
```json
{ "action": "list-runs", "script_id": "..." }
```

**Action: `get-run`**
```json
{ "action": "get-run", "run_id": "..." }
```

## Database Schema

```sql
-- Main pipeline table
squid_scripts
  id UUID PK DEFAULT gen_random_uuid()
  user_id UUID FK auth.users NOT NULL
  name TEXT NOT NULL
  description TEXT DEFAULT ''
  yaml_content TEXT DEFAULT ''
  parsed_config JSONB DEFAULT '{}'
  last_run_status TEXT DEFAULT 'idle' -- idle/running/success/failed
  total_runs INTEGER DEFAULT 0
  created_at TIMESTAMPTZ DEFAULT now()
  updated_at TIMESTAMPTZ DEFAULT now()

-- Individual trigger configs
squid_script_triggers
  id UUID PK
  script_id UUID FK squid_scripts
  trigger_type TEXT NOT NULL -- manual/scheduled/webhook/file_change/pipeline_complete
  config JSONB DEFAULT '{}'
  enabled BOOLEAN DEFAULT true

-- Pipeline runs
squid_script_runs
  id UUID PK
  script_id UUID FK squid_scripts
  user_id UUID FK auth.users
  status TEXT DEFAULT 'pending'
  started_at TIMESTAMPTZ
  completed_at TIMESTAMPTZ
  error TEXT

-- Jobs within a run
squid_run_jobs
  id UUID PK
  run_id UUID FK squid_script_runs
  job_name TEXT
  status TEXT
  started_at TIMESTAMPTZ
  completed_at TIMESTAMPTZ

-- Steps within a job
squid_run_steps
  id UUID PK
  job_id UUID FK squid_run_jobs
  step_name TEXT
  action TEXT
  status TEXT
  input JSONB
  output JSONB
  started_at TIMESTAMPTZ
  completed_at TIMESTAMPTZ
  error TEXT

-- User vault for secrets
squid_vault_secrets
  id UUID PK
  user_id UUID FK auth.users
  name TEXT NOT NULL
  value TEXT NOT NULL -- encrypted at rest
  created_at TIMESTAMPTZ DEFAULT now()
  updated_at TIMESTAMPTZ DEFAULT now()
```

## Important Notes for AI

1. **Template syntax**: Variables use `${{ squid.* }}` NOT Handlebars `{{ }}`. The engine does string replacement at execution time.
2. **Components are visual nodes**: Each component in the registry maps to a YAML step with `action: squidcloud/<id>`. The visual editor auto-syncs to YAML.
3. **Pipeline names are required**: The save button is disabled when name is empty.
4. **Default YAML**: New pipelines start with a manual-triggered echo step. Customize from there.
5. **No database/cloud admin components**: Registry excludes database ops and cloud infrastructure. User-facing actions only.
6. **No confidential variables**: All DB keys, security tokens, billing info, vault keys (except user-named secrets) are excluded from the variable registry.
7. **All config fields are optional**: Every component config field defaults to undefined/empty. Users fill in what they need.
8. **Saving behavior**: Create → redirects to edit URL with replace=true. Update stays in place.
9. **The YAML ↔ Visual sync is one-directional in practice**: Visual writes to YAML. Switching to YAML mode freezes visual state.
10. **Edge function is action-based**: Single edge function dispatches on `action` field. All responses include `{ success: true/false, ...data }`.
11. **Error handling**: The engine wraps each step in try/catch. Step errors are recorded in the run_step record but don't crash the pipeline unless configured otherwise.
12. **Backward compatibility**: The YAML format may change. Always re-import old YAML to visual editor to regenerate the canonical format.
