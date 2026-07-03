export interface PipelineTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  color: string;
  yaml: string;
  steps: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

const TEMPLATES: PipelineTemplate[] = [
  {
    id: 'scan-on-upload',
    name: 'Scan Files on Upload',
    description: 'Automatically scan newly uploaded files for malware, metadata extraction, and MIME type verification. Sends a report via Slack.',
    category: 'Security',
    icon: '\u{1F6E1}\uFE0F',
    color: '#ef4444',
    steps: 4,
    difficulty: 'beginner',
    yaml: `name: Upload Security Scan
description: Scans uploaded files for threats and metadata
on:
  manual: true
jobs:
  scan-job:
    name: Security Scan
    steps:
      - name: Detect file change
        action: squidcloud/scan
        with:
          path: "{{ squid.file.path }}"
          scan_type: malware
      - name: Extract metadata
        action: squidcloud/scan
        with:
          path: "{{ squid.file.path }}"
          scan_type: meta
      - name: Log results
        action: squidcloud/log
        with:
          level: info
          message: "Scanned {{ squid.file.name }} - {{ squid.file.mime_type }}"
      - name: Send notification
        action: squidcloud/slack
        with:
          webhook_url: "{{ vault.slack_webhook }}"
          message: "File scanned: {{ squid.file.name }} ({{ squid.file.size_formatted }})"`,
  },
  {
    id: 'email-on-upload',
    name: 'Email Notification on Upload',
    description: 'Send an email notification whenever a file is uploaded to a specific folder. Perfect for team collaboration.',
    category: 'Notifications',
    icon: '\u{1F4E8}',
    color: '#3b82f6',
    steps: 3,
    difficulty: 'beginner',
    yaml: `name: Upload Email Notification
description: Sends email when files are uploaded
on:
  manual: true
jobs:
  notify:
    name: Send Email
    steps:
      - name: Log upload event
        action: squidcloud/log
        with:
          level: info
          message: "New file: {{ squid.file.name }} uploaded to {{ squid.file.path }}"
      - name: Send email alert
        action: squidcloud/email-send
        with:
          to: ["{{ vault.notification_email }}"]
          subject: "New File Uploaded: {{ squid.file.name }}"
          body: "A new file has been uploaded.\\n\\nFile: {{ squid.file.name }}\\nSize: {{ squid.file.size_formatted }}\\nType: {{ squid.file.mime_type }}\\nPath: {{ squid.file.path }}"
      - name: Confirm sent
        action: squidcloud/echo
        with:
          message: "Notification sent for {{ squid.file.name }}"`,
  },
  {
    id: 'daily-backup',
    name: 'Daily Compressed Backup',
    description: 'Create a compressed archive of a folder and upload it to S3 storage every day. Includes cleanup of old backups.',
    category: 'Storage',
    icon: '\u{1F4BE}',
    color: '#8b5cf6',
    steps: 4,
    difficulty: 'intermediate',
    yaml: `name: Daily Backup
description: Compressed backup to S3
on:
  scheduled: "0 2 * * *"
jobs:
  backup:
    name: Create and Upload Backup
    steps:
      - name: Create archive
        action: squidcloud/compress
        with:
          source: "/important-docs/"
          format: zip
      - name: Upload to S3
        action: squidcloud/s3-upload
        with:
          bucket: "{{ vault.s3_backup_bucket }}"
          region: "{{ vault.s3_region }}"
          key: "backup-{{ squid.date.YYYY }}-{{ squid.date.MM }}-{{ squid.date.DD }}.zip"
      - name: Log completion
        action: squidcloud/log
        with:
          level: info
          message: "Backup {{ squid.date.today }} completed"
      - name: Notify
        action: squidcloud/slack
        with:
          webhook_url: "{{ vault.slack_webhook }}"
          message: "Daily backup completed: backup-{{ squid.date.today }}.zip"`,
  },
  {
    id: 'webhook-processor',
    name: 'Webhook File Processor',
    description: 'Receive files via webhook, scan them, process based on type, and store in organized folders. Includes error handling.',
    category: 'Automation',
    icon: '\u{1F310}',
    color: '#10b981',
    steps: 5,
    difficulty: 'advanced',
    yaml: `name: Webhook File Processor
description: Process incoming webhook files
on:
  manual: true
jobs:
  process:
    name: Process Incoming Files
    steps:
      - name: Receive payload
        action: squidcloud/echo
        with:
          message: "Processing webhook payload"
      - name: Scan for threats
        action: squidcloud/scan
        with:
          path: "{{ squid.file.path }}"
          scan_type: malware
      - name: Classify file type
        action: squidcloud/ai-classify
        with:
          data: "{{ squid.file.name }}"
          categories: ["document", "image", "video", "archive", "other"]
      - name: Route to folder
        action: squidcloud/file-move
        with:
          source: "{{ squid.file.path }}"
          destination: "/processed/{{ squid.file.extension }}/{{ squid.file.name }}"
      - name: Send receipt
        action: squidcloud/email-send
        with:
          to: ["{{ vault.admin_email }}"]
          subject: "File Processed: {{ squid.file.name }}"
          body: "File received and processed successfully."`,
  },
  {
    id: 'image-optimizer',
    name: 'Image Optimizer Pipeline',
    description: 'Auto-resize, convert, and optimize images on upload. Generates thumbnails and moves originals to archive.',
    category: 'Media',
    icon: '\u{1F5BC}\uFE0F',
    color: '#f59e0b',
    steps: 4,
    difficulty: 'intermediate',
    yaml: `name: Image Optimizer
description: Auto-optimize uploaded images
on:
  manual: true
jobs:
  optimize:
    name: Optimize Images
    steps:
      - name: Check file type
        action: squidcloud/condition
        with:
          variable: "{{ squid.file.mime_type }}"
          operator: contains
          value: "image/"
      - name: Create thumbnail
        action: squidcloud/image-resize
        with:
          source: "{{ squid.file.path }}"
          width: 300
          height: 300
          fit: cover
      - name: Convert to WebP
        action: squidcloud/image-convert
        with:
          source: "{{ squid.file.path }}"
          format: webp
      - name: Move original
        action: squidcloud/file-move
        with:
          source: "{{ squid.file.path }}"
          destination: "/originals/{{ squid.file.name }}"`,
  },
  {
    id: 'multi-notify',
    name: 'Multi-Channel Alert',
    description: 'Send alerts across Slack, Discord, and Email simultaneously when an important event occurs. Uses parallel execution.',
    category: 'Notifications',
    icon: '\u{1F514}',
    color: '#ec4899',
    steps: 4,
    difficulty: 'beginner',
    yaml: `name: Multi-Channel Alert
description: Cross-platform notification broadcast
on:
  manual: true
jobs:
  alert:
    name: Broadcast Alerts
    steps:
      - name: Log trigger
        action: squidcloud/log
        with:
          level: warn
          message: "Alert triggered by {{ squid.user.name }}"
      - name: Send Slack
        action: squidcloud/slack
        with:
          webhook_url: "{{ vault.slack_webhook }}"
          message: "Alert: {{ squid.pipeline.name }} triggered by {{ squid.user.email }}"
      - name: Send Discord
        action: squidcloud/discord
        with:
          webhook_url: "{{ vault.discord_webhook }}"
          message: "Alert: {{ squid.pipeline.name }} triggered"
      - name: Send Email
        action: squidcloud/email-send
        with:
          to: ["{{ vault.alert_email }}"]
          subject: "Pipeline Alert: {{ squid.pipeline.name }}"
          body: "Pipeline {{ squid.pipeline.name }} was triggered by {{ squid.user.email }}"`,
  },
  {
    id: 'file-organizer',
    name: 'Smart File Organizer',
    description: 'Automatically organize files into folders based on file type, date, and custom rules. Deduplicates and tags.',
    category: 'File Operations',
    icon: '\u{1F4C2}',
    color: '#06b6d4',
    steps: 5,
    difficulty: 'intermediate',
    yaml: `name: Smart Organizer
description: Auto-organize files by type and date
on:
  manual: true
jobs:
  organize:
    name: Organize Files
    steps:
      - name: Check file exists
        action: squidcloud/file-scan
        with:
          path: "{{ squid.file.path }}"
          scan_type: meta
      - name: Create dated folder
        action: squidcloud/echo
        with:
          message: "Target: /organized/{{ squid.file.extension }}/{{ squid.date.YYYY }}-{{ squid.date.MM }}/"
      - name: Move to organized folder
        action: squidcloud/file-move
        with:
          source: "{{ squid.file.path }}"
          destination: "/organized/{{ squid.file.extension }}/{{ squid.date.YYYY }}-{{ squid.date.MM }}/{{ squid.file.name }}"
      - name: Tag the file
        action: squidcloud/file-tag
        with:
          path: "/organized/{{ squid.file.extension }}/{{ squid.date.YYYY }}-{{ squid.date.MM }}/{{ squid.file.name }}"
          tags: ["organized", "{{ squid.file.extension }}"]
      - name: Log completion
        action: squidcloud/log
        with:
          level: info
          message: "Organized {{ squid.file.name }} to {{ squid.file.extension }}/{{ squid.date.YYYY }}-{{ squid.date.MM }}"`,
  },
  {
    id: 'compress-and-archive',
    name: 'Compress & Archive Old Files',
    description: 'Find files older than 30 days, compress them into archives, and move to cold storage. Saves space.',
    category: 'Storage',
    icon: '\u{1F4E6}',
    color: '#6366f1',
    steps: 3,
    difficulty: 'intermediate',
    yaml: `name: Archive Old Files
description: Compress and archive old files
on:
  scheduled: "0 3 * * 0"
jobs:
  archive:
    name: Archive Process
    steps:
      - name: Compress old files
        action: squidcloud/compress
        with:
          source: "/archive-candidates/"
          format: tar.gz
      - name: Upload to cold storage
        action: squidcloud/s3-upload
        with:
          bucket: "{{ vault.archive_bucket }}"
          region: "{{ vault.s3_region }}"
          key: "archive-{{ squid.date.YYYY }}-W{{ squid.date.MM }}.tar.gz"
      - name: Cleanup originals
        action: squidcloud/file-delete
        with:
          path: "/archive-candidates/"
          permanent: false`,
  },
  {
    id: 'webhook-email-gateway',
    name: 'Webhook-to-Email Gateway',
    description: 'Receive data via webhook and forward it as a formatted email. Great for form submissions, CRM integrations, or IoT alerts.',
    category: 'Automation',
    icon: '\u{1F4E9}',
    color: '#14b8a6',
    steps: 3,
    difficulty: 'beginner',
    yaml: `name: Webhook Email Gateway
description: Forwards webhook payloads as emails
on:
  manual: true
jobs:
  forward:
    name: Forward to Email
    steps:
      - name: Parse webhook data
        action: squidcloud/echo
        with:
          message: "Forwarding webhook payload"
      - name: Format and send email
        action: squidcloud/email-send
        with:
          to: ["{{ vault.notification_email }}"]
          subject: "Webhook Received - {{ squid.date.today }}"
          body: "A webhook was received.\\n\\nPipeline: {{ squid.pipeline.name }}\\nTime: {{ squid.timestamp }}\\nRun ID: {{ squid.pipeline.run_id }}"
      - name: Log delivery
        action: squidcloud/log
        with:
          level: info
          message: "Email forwarded successfully"`,
  },
  {
    id: 'file-sync-pipeline',
    name: 'Cross-Location File Sync',
    description: 'Sync files between SquidCloud folders and external S3-compatible storage. Keeps directories in sync bidirectionally.',
    category: 'File Operations',
    icon: '\u{1F504}',
    color: '#22c55e',
    steps: 3,
    difficulty: 'advanced',
    yaml: `name: Cross-Location Sync
description: Sync folders across storage backends
on:
  scheduled: "0 */6 * * *"
jobs:
  sync:
    name: Sync Directories
    steps:
      - name: Pull from S3
        action: squidcloud/s3-download
        with:
          bucket: "{{ vault.sync_bucket }}"
          region: "{{ vault.s3_region }}"
          key: sync-data/
      - name: Sync to local folder
        action: squidcloud/file-sync
        with:
          source: "/external-sync/"
          destination: "/local-sync/"
          direction: pull
      - name: Log sync status
        action: squidcloud/log
        with:
          level: info
          message: "Sync completed at {{ squid.timestamp }}"`,
  },
  {
    id: 'video-transcoder',
    name: 'Video Transcoder',
    description: 'Automatically convert uploaded videos to multiple formats and resolutions. Generates thumbnails for each.',
    category: 'Media',
    icon: '\u{1F3AC}',
    color: '#e11d48',
    steps: 4,
    difficulty: 'advanced',
    yaml: `name: Video Transcoder
description: Convert videos on upload
on:
  manual: true
jobs:
  transcode:
    name: Video Processing
    steps:
      - name: Detect video type
        action: squidcloud/condition
        with:
          variable: "{{ squid.file.mime_type }}"
          operator: contains
          value: "video/"
      - name: Convert to MP4
        action: squidcloud/video-convert
        with:
          source: "{{ squid.file.path }}"
          format: mp4
          codec: h264
      - name: Extract thumbnail
        action: squidcloud/media-extract
        with:
          source: "{{ squid.file.path }}"
          type: thumbnail
      - name: Store transcoded file
        action: squidcloud/file-move
        with:
          source: "{{ squid.file.path }}"
          destination: "/video-library/{{ squid.file.name }}"`,
  },
  {
    id: 'data-export-job',
    name: 'Scheduled Data Export',
    description: 'Export data in JSON/CSV format on a schedule, compress it, and send via email or upload to S3.',
    category: 'Data',
    icon: '\u{1F4CA}',
    color: '#a855f7',
    steps: 4,
    difficulty: 'intermediate',
    yaml: `name: Data Export
description: Scheduled data export pipeline
on:
  scheduled: "0 4 * * 1"
jobs:
  export:
    name: Export and Distribute
    steps:
      - name: Export as CSV
        action: squidcloud/transform
        with:
          format: csv
          operation: convert
      - name: Compress export
        action: squidcloud/compress
        with:
          source: "/exports/latest.csv"
          format: gz
      - name: Upload export
        action: squidcloud/s3-upload
        with:
          bucket: "{{ vault.export_bucket }}"
          region: "{{ vault.s3_region }}"
          key: "exports/{{ squid.date.YYYY }}-{{ squid.date.MM }}-{{ squid.date.DD }}.csv.gz"
      - name: Notify team
        action: squidcloud/email-send
        with:
          to: ["{{ vault.team_email }}"]
          subject: "Weekly Data Export Ready"
          body: "Data export for {{ squid.date.today }} has been uploaded."`,
  },
];

export function getTemplates(): PipelineTemplate[] {
  return TEMPLATES;
}

export function getTemplate(id: string): PipelineTemplate | undefined {
  return TEMPLATES.find(t => t.id === id);
}

export function getTemplatesByCategory(category: string): PipelineTemplate[] {
  return TEMPLATES.filter(t => t.category.toLowerCase() === category.toLowerCase());
}

export function getTemplateCategories(): string[] {
  return [...new Set(TEMPLATES.map(t => t.category))];
}
