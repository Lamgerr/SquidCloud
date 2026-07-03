export interface SquidVariable {
  token: string;
  label: string;
  category: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'json' | 'timestamp' | 'file';
  example?: string;
  source?: string;
}

export const ALL_VARIABLES: SquidVariable[] = [];

function add(token: string, label: string, category: string, description: string, type: SquidVariable['type'], example?: string, source?: string) {
  ALL_VARIABLES.push({ token, label, category, description, type, example, source });
}

// ════════════════════════════════════════════════════════════════════════════
// USER / PROFILE (profiles table, auth.user_metadata)
// ════════════════════════════════════════════════════════════════════════════

add('squid.user.id',                   'User ID',              'User',        'Your SquidCloud user UUID', 'string', 'a1b2c3d4-...', 'auth.users.id');
add('squid.user.email',                'Email',                'User',        'Registered email address', 'string', 'user@example.com', 'auth.users.email');
add('squid.user.name',                 'Display Name',         'User',        'Your display name on SquidCloud', 'string', 'John Doe', 'profiles.full_name');
add('squid.user.username',             'Username',             'User',        'Unique username handle', 'string', 'johndoe', 'profiles.username');
add('squid.user.avatar_url',           'Avatar URL',           'User',        'Profile avatar image URL', 'string', 'https://...', 'profiles.avatar_url');
add('squid.user.is_admin',             'Is Admin',             'User',        'Whether user has admin role', 'boolean', 'false', 'profiles.is_admin');
add('squid.user.is_premium',           'Is Premium',           'User',        'Whether user has premium subscription', 'boolean', 'false', 'profiles.is_premium');
add('squid.user.storage_used',         'Storage Used (bytes)', 'User',        'Total storage used in bytes', 'number', '1073741824', 'profiles.storage_used');
add('squid.user.repo_count',           'Repository Count',     'User',        'Number of repositories owned', 'number', '5', 'profiles.repo_count');
add('squid.user.onboarding_complete',  'Onboarding Complete',  'User',        'Whether user completed onboarding', 'boolean', 'true', 'profiles.onboarding_complete');
add('squid.user.created_at',           'Account Created',      'User',        'ISO timestamp of account creation', 'timestamp', '2024-01-01T00:00:00Z', 'auth.users.created_at');
add('squid.user.mfa_enabled',          'MFA Enabled',          'User',        'Whether multi-factor auth is enabled', 'boolean', 'false', 'profiles.mfa_enabled');
add('squid.user.mfa_type',             'MFA Type',             'User',        'Type of MFA (totp, sms, passkey)', 'string', 'passkey', 'profiles.mfa_type');
add('squid.user.code_editor',          'Code Editor Pref',     'User',        'Preferred code editor theme/settings', 'json', '{}', 'user_preferences.code_editor');
add('squid.user.terms_accepted',       'Terms Accepted',       'User',        'Latest accepted terms version', 'string', '2.1', 'user_terms_acceptance.terms_version');
add('squid.user.privacy_accepted',     'Privacy Accepted',     'User',        'Latest accepted privacy version', 'string', '2.1', 'user_terms_acceptance.privacy_version');
add('squid.user.login_provider',       'Login Provider',       'User',        'Auth provider (email, github, google)', 'string', 'github');
add('squid.user.last_login',           'Last Login',           'User',        'Last login session timestamp', 'timestamp', '2026-06-27T12:00:00Z');
add('squid.user.login_device',         'Last Device',          'User',        'Last login device name', 'string', 'Chrome on Android');
add('squid.user.subscription_name',    'Subscription Plan',    'User',        'Current subscription plan name', 'string', 'Pro');
add('squid.user.subscription_storage', 'Subscription Storage', 'User',        'Storage limit from subscription (bytes)', 'number', '10737418240');

// ════════════════════════════════════════════════════════════════════════════
// SESSION / AUTH
// ════════════════════════════════════════════════════════════════════════════

add('squid.session.id',                'Session ID',           'Session',     'Current auth session ID', 'string', 'sess_abc...', 'auth.sessions.id');
add('squid.session.created_at',        'Session Created',      'Session',     'Session creation timestamp', 'timestamp', '2026-06-27T10:00:00Z');
add('squid.session.expires_at',        'Session Expires',      'Session',     'Session expiry timestamp', 'timestamp', '2026-06-28T10:00:00Z');
add('squid.session.ip',                'Client IP',            'Session',     'Request client IP address', 'string', '203.0.113.1');
add('squid.session.user_agent',        'User Agent',           'Session',     'HTTP user agent string', 'string', 'Mozilla/5.0...');
add('squid.session.location',          'Geo Location',         'Session',     'Geo-location from IP', 'string', 'Mumbai, IN');

// ════════════════════════════════════════════════════════════════════════════
// FILE (files table — the core SquidCloud data model)
// ════════════════════════════════════════════════════════════════════════════

add('squid.file.id',                   'File ID',              'File',        'Unique file UUID', 'string', 'f_abc123...', 'files.id');
add('squid.file.name',                 'File Name',            'File',        'Original filename with extension', 'string', 'report.pdf', 'files.name');
add('squid.file.type',                 'MIME Type',            'File',        'MIME content type', 'string', 'application/pdf', 'files.type');
add('squid.file.size',                 'File Size (bytes)',    'File',        'File size in bytes', 'number', '1048576', 'files.size');
add('squid.file.storage_path',         'Storage Path',         'File',        'Full storage path in bucket', 'string', '/documents/report.pdf', 'files.storage_path');
add('squid.file.extension',            'Extension',            'File',        'File extension without dot', 'string', 'pdf');
add('squid.file.created_at',           'Created At',           'File',        'Upload timestamp', 'timestamp', '2026-06-27T12:00:00Z', 'files.created_at');
add('squid.file.updated_at',           'Updated At',           'File',        'Last modified timestamp', 'timestamp', '2026-06-27T14:00:00Z', 'files.updated_at');
add('squid.file.encrypted',            'Is Encrypted',         'File',        'Whether file is encrypted at rest', 'boolean', 'false', 'files.encrypted');
add('squid.file.shared',               'Is Shared',            'File',        'Whether file has active shares', 'boolean', 'true', 'files.shared');
add('squid.file.is_public',            'Is Public',            'File',        'Whether file is publicly accessible', 'boolean', 'false', 'files.is_public');
add('squid.file.in_vault',             'In Vault',             'File',        'Whether file is stored in vault', 'boolean', 'false', 'files.in_vault');
add('squid.file.is_deleted',           'Is Deleted',           'File',        'Whether file is soft-deleted (trash)', 'boolean', 'false', 'files.is_deleted');
add('squid.file.tags',                 'Tags',                 'File',        'File tags array', 'json', '["important","work"]', 'files.tags');
add('squid.file.parent_folder',        'Parent Folder ID',     'File',        'UUID of parent folder', 'string', 'fl_xyz...', 'files.parent_folder');
add('squid.file.workspace_id',         'Workspace ID',         'File',        'Workspace UUID', 'string', 'ws_123...', 'files.workspace_id');
add('squid.file.storage_provider_id',  'Storage Provider',     'File',        'External storage provider ID', 'string', 's3_main', 'files.storage_provider_id');
add('squid.file.external_object_key',  'External Key',         'File',        'Object key in external storage', 'string', 'uploads/abc.pdf', 'files.external_object_key');
add('squid.file.github_repo',          'GitHub Repo',          'File',        'Associated GitHub repository', 'string', 'user/repo', 'files.github_repo');
add('squid.file.preview_available',    'Preview Available',    'File',        'Whether preview is generated', 'boolean', 'true', 'files.preview_available');
add('squid.file.preview_type',         'Preview Type',         'File',        'Type of preview (image, video, document)', 'string', 'image', 'files.preview_type');
add('squid.file.processor',            'Processor',            'File',        'Processor used for the file', 'string', 'pdf-thumbnailer', 'files.processor');
add('squid.file.encryption_key',       'Encryption Key ID',    'File',        'ID of encryption key used', 'string', 'key_abc...', 'files.encryption_key');

// File scan results
add('squid.file.scan.is_malicious',    'Scan: Malicious',      'File',        'Whether malware scan flagged file', 'boolean', 'false');
add('squid.file.scan.threat_name',    'Scan: Threat Name',    'File',        'Malware signature name', 'string', 'Trojan.Generic');
add('squid.file.scan.score',          'Scan: Risk Score',     'File',        'Risk score 0-100', 'number', '0');
add('squid.file.scan.engines',        'Scan: Engines',        'File',        'Number of scan engines', 'number', '12');
add('squid.file.scan.engines_malicious', 'Scan: Malicious Engines', 'File',  'Engines that flagged', 'number', '0');
add('squid.file.scan.scanned_at',     'Scan: Timestamp',      'File',        'Last scan timestamp', 'timestamp', '2026-06-27T12:00:00Z');
add('squid.file.scan.content_type',   'Scan: Content Type',   'File',        'Detected MIME type from content', 'string', 'image/png');
add('squid.file.scan.is_valid_ext',   'Scan: Valid Ext',      'File',        'Whether extension matches content', 'boolean', 'true');
add('squid.file.scan.detected_ext',   'Scan: Detected Ext',   'File',        'Correct extension based on content', 'string', 'png');

// Stream / Video fields
add('squid.file.video.duration',       'Video Duration (s)',   'File',        'Video duration in seconds', 'number', '184.5');
add('squid.file.video.width',          'Video Width',          'File',        'Video resolution width', 'number', '1920');
add('squid.file.video.height',         'Video Height',         'File',        'Video resolution height', 'number', '1080');
add('squid.file.video.codec',          'Video Codec',          'File',        'Video codec name', 'string', 'h264');
add('squid.file.video.bitrate',        'Video Bitrate',        'File',        'Video bitrate in kbps', 'number', '8000');
add('squid.file.video.fps',            'Video FPS',            'File',        'Frames per second', 'number', '30');
add('squid.file.video.qualities',      'Video Qualities',      'File',        'Available quality variants', 'json', '["1080p","720p","480p"]');
add('squid.file.audio.codec',          'Audio Codec',          'File',        'Audio codec name', 'string', 'aac');
add('squid.file.audio.bitrate',        'Audio Bitrate',        'File',        'Audio bitrate in kbps', 'number', '192');
add('squid.file.audio.sample_rate',    'Audio Sample Rate',    'File',        'Audio sample rate in Hz', 'number', '44100');
add('squid.file.audio.channels',       'Audio Channels',       'File',        'Number of audio channels', 'number', '2');
add('squid.file.image.width',          'Image Width',          'File',        'Image width in pixels', 'number', '3840');
add('squid.file.image.height',         'Image Height',         'File',        'Image height in pixels', 'number', '2160');
add('squid.file.image.dpi',            'Image DPI',            'File',        'Image dots per inch', 'number', '300');
add('squid.file.image.colorspace',     'Image Colorspace',     'File',        'Color space (RGB, CMYK)', 'string', 'RGB');
add('squid.file.image.has_alpha',      'Image Has Alpha',      'File',        'Whether image has alpha channel', 'boolean', 'false');
add('squid.file.document.pages',       'Doc Page Count',       'File',        'Number of pages in document', 'number', '42');
add('squid.file.document.author',      'Doc Author',           'File',        'Document author metadata', 'string', 'John Doe');
add('squid.file.document.title',       'Doc Title',            'File',        'Document title metadata', 'string', 'Annual Report');
add('squid.file.document.subject',     'Doc Subject',          'File',        'Document subject metadata', 'string', 'Finance');
add('squid.file.document.created_date','Doc Created Date',     'File',        'Document creation date', 'timestamp', '2026-01-15T00:00:00Z');

// ════════════════════════════════════════════════════════════════════════════
// FOLDER
// ════════════════════════════════════════════════════════════════════════════

add('squid.folder.id',                 'Folder ID',            'Folder',      'Folder UUID', 'string', 'fl_xyz...', 'folders.id');
add('squid.folder.name',               'Folder Name',          'Folder',      'Display folder name', 'string', 'Documents', 'folders.name');
add('squid.folder.path',               'Folder Path',          'Folder',      'Full folder path', 'string', '/Documents/Work', 'folders.path');
add('squid.folder.parent_folder',      'Parent Folder ID',     'Folder',      'UUID of parent folder', 'string', 'fl_abc...', 'folders.parent_folder');
add('squid.folder.is_public',          'Folder Is Public',     'Folder',      'Whether folder is publicly accessible', 'boolean', 'false', 'folders.is_public');
add('squid.folder.created_at',         'Folder Created',       'Folder',      'Folder creation timestamp', 'timestamp', '2026-01-01T00:00:00Z', 'folders.created_at');
add('squid.folder.file_count',         'File Count',           'Folder',      'Number of files in folder', 'number', '15');
add('squid.folder.total_size',         'Total Size (bytes)',   'Folder',      'Total size of all files', 'number', '52428800');

// ════════════════════════════════════════════════════════════════════════════
// SHARES
// ════════════════════════════════════════════════════════════════════════════

add('squid.share.id',                  'Share ID',             'Share',       'Share UUID', 'string', 'sh_abc...', 'shares.share_id');
add('squid.share.type',                'Share Type',           'Share',       'Share type: public or user_specific', 'string', 'public', 'shares.share_type');
add('squid.share.url',                 'Share URL',            'Share',       'Generated shareable link URL', 'string', 'https://squidcloud.io/s/abc123');
add('squid.share.access_code',         'Access Code',          'Share',       'Optional access password', 'string', '****', 'shares.access_code');
add('squid.share.download_count',      'Download Count',       'Share',       'Number of times downloaded', 'number', '42', 'shares.download_count');
add('squid.share.download_limit',      'Download Limit',       'Share',       'Max allowed downloads', 'number', '100', 'shares.download_limit');
add('squid.share.expires_at',          'Expiry Date',          'Share',       'Share expiry timestamp', 'timestamp', '2026-07-27T00:00:00Z', 'shares.expires_at');
add('squid.share.view_only',           'View Only',            'Share',       'Whether download is disabled', 'boolean', 'false', 'shares.view_only');
add('squid.share.created_at',          'Share Created',        'Share',       'Share creation timestamp', 'timestamp', '2026-06-27T00:00:00Z', 'shares.created_at');
add('squid.share.is_collection',       'Is Collection',        'Share',       'Whether share is a folder collection', 'boolean', 'false');
add('squid.share.allowed_users',       'Allowed Users',        'Share',       'Specific users allowed to access', 'json', '["user@example.com"]', 'shares.allowed_users');
add('squid.share.decrypt_attempts',    'Decrypt Attempts',     'Share',       'Failed decrypt attempt count', 'number', '0', 'shares.decrypt_attempts');
add('squid.share.require_email',       'Require Email',        'Share',       'Whether email is required to access', 'boolean', 'false');

// ════════════════════════════════════════════════════════════════════════════
// PUBLISHED SITES (site_publications)
// ════════════════════════════════════════════════════════════════════════════

add('squid.site.id',                   'Site ID',              'Site',        'Publication UUID', 'string', 'pub_abc...', 'site_publications.id');
add('squid.site.slug',                 'Site Slug',            'Site',        'URL-friendly site identifier', 'string', 'my-site', 'site_publications.site_slug');
add('squid.site.url',                  'Site URL',             'Site',        'Full public URL', 'string', 'https://squidcloud.vercel.app/api/serve/u/...', 'site_publications.site_url');
add('squid.site.visibility',           'Site Visibility',      'Site',        'public or private', 'string', 'public', 'site_publications.visibility');
add('squid.site.status',               'Site Status',          'Site',        'live, unpublished, or error', 'string', 'live', 'site_publications.status');
add('squid.site.file_count',           'Site File Count',      'Site',        'Number of files published', 'number', '5', 'site_publications.file_count');
add('squid.site.total_size',           'Site Total Size',      'Site',        'Total size of published files', 'number', '10485760', 'site_publications.total_size_bytes');
add('squid.site.published_at',         'Published At',         'Site',        'First publication timestamp', 'timestamp', '2026-06-27T00:00:00Z', 'site_publications.published_at');
add('squid.site.updated_at',           'Site Updated',         'Site',        'Last update timestamp', 'timestamp', '2026-06-27T12:00:00Z', 'site_publications.updated_at');

// ════════════════════════════════════════════════════════════════════════════
// ANALYTICS / STORAGE METRICS
// ════════════════════════════════════════════════════════════════════════════

add('squid.analytics.total_storage',   'Total Storage (bytes)','Analytics',   'Total available storage', 'number', '10737418240', 'StorageMetrics.totalStorage');
add('squid.analytics.used_storage',    'Used Storage (bytes)', 'Analytics',   'Storage currently used', 'number', '2147483648', 'StorageMetrics.usedStorage');
add('squid.analytics.available_storage','Available Storage',   'Analytics',   'Remaining storage bytes', 'number', '8589934592', 'StorageMetrics.availableStorage');
add('squid.analytics.storage_growth',  'Storage Growth (%)',   'Analytics',   'Storage usage growth percentage', 'number', '12.5', 'StorageMetrics.storageGrowth');
add('squid.analytics.file_count',      'Total File Count',     'Analytics',   'Total number of files', 'number', '1042', 'StorageMetrics.fileCount');
add('squid.analytics.files_by_type',   'Files by Type',        'Analytics',   'File count by MIME category', 'json', '{"image": 500, "doc": 300}', 'StorageMetrics.fileTypes');
add('squid.analytics.storage_by_type', 'Storage by Type',      'Analytics',   'Storage bytes by MIME category', 'json', '{"image": 1073741824}', 'StorageMetrics.storageByType');
add('squid.analytics.uploads_today',   'Uploads Today',        'Analytics',   'Upload count for today', 'number', '23', 'ActivityMetrics.uploads');
add('squid.analytics.downloads_today', 'Downloads Today',      'Analytics',   'Download count for today', 'number', '87', 'ActivityMetrics.downloads');
add('squid.analytics.shares_today',    'Shares Today',         'Analytics',   'New shares created today', 'number', '5', 'ActivityMetrics.shares');
add('squid.analytics.views_today',     'Views Today',          'Analytics',   'Content views today', 'number', '312', 'ActivityMetrics.views');
add('squid.analytics.avg_upload_speed','Avg Upload Speed',     'Analytics',   'Average upload speed MB/s', 'number', '5.2', 'PerformanceMetrics.avgUploadSpeed');
add('squid.analytics.avg_download_speed','Avg Download Speed', 'Analytics',   'Average download speed MB/s', 'number', '15.8', 'PerformanceMetrics.avgDownloadSpeed');
add('squid.analytics.error_rate',      'Error Rate (%)',       'Analytics',   'API error rate percentage', 'number', '0.3', 'PerformanceMetrics.errorRate');
add('squid.analytics.uptime',          'Uptime (%)',           'Analytics',   'System uptime percentage', 'number', '99.9', 'PerformanceMetrics.uptime');
add('squid.analytics.response_time',   'Avg Response (ms)',    'Analytics',   'Average API response time', 'number', '145', 'PerformanceMetrics.responseTime');
add('squid.analytics.system_health',   'System Health',        'Analytics',   'Overall health status', 'string', 'excellent', 'PerformanceMetrics.systemHealth');
add('squid.analytics.active_users',    'Active Users',         'Analytics',   'Monthly active users', 'number', '1280', 'UserMetrics.activeUsers');
add('squid.analytics.new_users',       'New Users',            'Analytics',   'New signups this period', 'number', '47', 'UserMetrics.newUsers');
add('squid.analytics.user_growth',     'User Growth (%)',      'Analytics',   'User growth percentage', 'number', '3.8', 'UserMetrics.userGrowth');

// ════════════════════════════════════════════════════════════════════════════
// PIPELINE (squid_scripts / squid_script_runs)
// ════════════════════════════════════════════════════════════════════════════

add('squid.script.id',                 'Script ID',            'Pipeline',    'Pipeline script UUID', 'string', 'scr_abc...', 'squid_scripts.id');
add('squid.script.name',               'Script Name',          'Pipeline',    'Pipeline display name', 'string', 'Backup Job', 'squid_scripts.name');
add('squid.script.description',        'Script Description',   'Pipeline',    'Pipeline description text', 'string', 'Daily backup pipeline', 'squid_scripts.description');
add('squid.script.is_active',          'Is Active',            'Pipeline',    'Whether pipeline is enabled', 'boolean', 'true', 'squid_scripts.is_active');
add('squid.script.last_run_status',    'Last Run Status',      'Pipeline',    'Status of last execution', 'string', 'success', 'squid_scripts.last_run_status');
add('squid.script.last_run_at',        'Last Run At',          'Pipeline',    'Last execution timestamp', 'timestamp', '2026-06-27T12:00:00Z', 'squid_scripts.last_run_at');
add('squid.script.source_path',        'Source Path',          'Pipeline',    'Associated file path', 'string', '/scripts/backup.squid.yml', 'squid_scripts.source_path');
add('squid.run.id',                    'Run ID',               'Pipeline',    'Execution run UUID', 'string', 'run_abc123', 'squid_script_runs.id');
add('squid.run.status',                'Run Status',           'Pipeline',    'Current run status', 'string', 'running', 'squid_script_runs.status');
add('squid.run.started_at',            'Run Started',          'Pipeline',    'Run start timestamp', 'timestamp', '2026-06-27T12:00:00Z', 'squid_script_runs.started_at');
add('squid.run.completed_at',          'Run Completed',        'Pipeline',    'Run completion timestamp', 'timestamp', '2026-06-27T12:01:00Z', 'squid_script_runs.completed_at');
add('squid.run.duration_ms',           'Run Duration (ms)',    'Pipeline',    'Total execution duration', 'number', '60000', 'squid_script_runs.duration_ms');
add('squid.run.error_message',         'Run Error',            'Pipeline',    'Error message if failed', 'string', '', 'squid_script_runs.error_message');
add('squid.run.execution_plan',        'Execution Plan',       'Pipeline',    'Resolved execution plan JSON', 'json', '{}', 'squid_script_runs.execution_plan');
add('squid.job.name',                  'Job Name',             'Pipeline',    'Current job identifier', 'string', 'job-1', 'squid_run_jobs.job_name');
add('squid.job.status',                'Job Status',           'Pipeline',    'Current job status', 'string', 'running', 'squid_run_jobs.status');
add('squid.job.duration_ms',           'Job Duration (ms)',    'Pipeline',    'Job execution duration', 'number', '30000', 'squid_run_jobs.duration_ms');
add('squid.job.error_message',         'Job Error',            'Pipeline',    'Job error message', 'string', '', 'squid_run_jobs.error_message');
add('squid.step.id',                   'Step ID',              'Pipeline',    'Step execution UUID', 'string', 'st_abc...', 'squid_run_steps.id');
add('squid.step.name',                 'Step Name',            'Pipeline',    'Current step within job', 'string', 'deploy-to-vercel', 'squid_run_steps.step_name');
add('squid.step.action_use',           'Step Action',          'Pipeline',    'Action reference used by step', 'string', 'squidcloud/echo', 'squid_run_steps.action_use');
add('squid.step.index',                'Step Index',           'Pipeline',    'Zero-based step index in job', 'number', '2', 'squid_run_steps.step_index');
add('squid.step.status',               'Step Status',          'Pipeline',    'Step execution status', 'string', 'completed', 'squid_run_steps.status');
add('squid.step.exit_code',            'Step Exit Code',       'Pipeline',    'Process exit code', 'number', '0', 'squid_run_steps.exit_code');
add('squid.step.output',               'Step Output',          'Pipeline',    'Step stdout output text', 'string', 'Processing complete', 'squid_run_steps.output');
add('squid.step.error_message',        'Step Error',           'Pipeline',    'Step error message', 'string', '', 'squid_run_steps.error_message');
add('squid.step.started_at',           'Step Started',         'Pipeline',    'Step start timestamp', 'timestamp', '2026-06-27T12:00:05Z');
add('squid.step.completed_at',         'Step Completed',       'Pipeline',    'Step completion timestamp', 'timestamp', '2026-06-27T12:00:35Z');
add('squid.trigger.type',              'Trigger Type',         'Pipeline',    'Pipeline trigger source', 'string', 'manual', 'squid_script_triggers.trigger_type');
add('squid.trigger.source',            'Trigger Source',       'Pipeline',    'Source details of trigger', 'string', 'webhook:/api/incoming');
add('squid.trigger.config',            'Trigger Config',       'Pipeline',    'Trigger configuration JSON', 'json', '{"cron":"0 */6 * * *"}', 'squid_script_triggers.config');
add('squid.secret.API_KEY',            'Secret: API Key',      'Pipeline',    'Vault secret named API_KEY', 'string', '(resolved at runtime)');
add('squid.vault.secret_names',        'Available Secrets',    'Pipeline',    'List of available vault secret names', 'json', '["API_KEY","DEPLOY_KEY"]');

// ════════════════════════════════════════════════════════════════════════════
// ENVIRONMENT / SYSTEM
// ════════════════════════════════════════════════════════════════════════════

add('squid.env.BRANCH',                'Git Branch',           'Environment', 'Current deployment branch', 'string', 'main');
add('squid.env.REGION',                'Compute Region',       'Environment', 'SquidCloud compute region', 'string', 'us-east-1');

// ════════════════════════════════════════════════════════════════════════════
// ENCRYPTION / VAULT
// ════════════════════════════════════════════════════════════════════════════

add('squid.vault.name',                'Vault Name',           'Vault',       'Vault display name', 'string', 'Personal Vault', 'vaults.name');
add('squid.vault.file_count',          'Vault File Count',     'Vault',       'Number of files stored in vault', 'number', '12');

// ════════════════════════════════════════════════════════════════════════════
// DATABASE TABLES (field-level variables for all major tables)
// ════════════════════════════════════════════════════════════════════════════

// Database, security, billing, support, and migration variables are
// admin/internal and not exposed in user-facing pipelines.

// ════════════════════════════════════════════════════════════════════════════
// SECURITY
// ════════════════════════════════════════════════════════════════════════════

// Security variables are admin/internal only.

// ════════════════════════════════════════════════════════════════════════════
// MEDIA / STREAMING
// ════════════════════════════════════════════════════════════════════════════

add('squid.media.stream.session_id',   'Stream Session ID',    'Media',       'Active stream session UUID', 'string', 'ss_abc...', 'video_stream_sessions.session_id');
add('squid.media.stream.quality',      'Stream Quality',       'Media',       'Current streaming quality', 'string', '1080p', 'video_stream_sessions.quality');
add('squid.media.stream.duration',     'Stream Duration (s)',  'Media',       'Stream session duration', 'number', '3600', 'video_stream_sessions.stream_duration');
add('squid.media.stream.bandwidth',    'Stream Bandwidth',     'Media',       'Bandwidth used in bytes', 'number', '500000000', 'video_stream_sessions.bandwidth_used');
add('squid.media.stream.playback_pos','Playback Position (s)', 'Media',       'Current playback position', 'number', '120', 'playback_resume.position');
add('squid.media.transcode.status',    'Transcode Status',     'Media',       'Transcode job status', 'string', 'processing', 'transcode_jobs.status');
add('squid.media.transcode.progress',  'Transcode Progress (%)','Media',      'Transcode job progress', 'number', '45', 'transcode_jobs.progress');
add('squid.media.transcode.qualities', 'Transcode Qualities',  'Media',       'Requested output qualities', 'json', '["720p","480p"]', 'transcode_jobs.output_qualities');
add('squid.media.transcode.attempts',  'Transcode Attempts',   'Media',       'Number of transcode attempts', 'number', '2', 'transcode_jobs.attempts');
add('squid.media.analytics.total_views','Media: Total Views',  'Media',       'Total video views', 'number', '15000', 'video_analytics_summary.total_sessions');
add('squid.media.analytics.unique_viewers','Media: Unique Views','Media',     'Unique viewer count', 'number', '1200', 'video_analytics_summary.unique_viewers');
add('squid.media.analytics.avg_watch',  'Media: Avg Watch (s)', 'Media',      'Average watch time', 'number', '185', 'video_analytics_summary.avg_watch_time');
add('squid.media.analytics.completion', 'Media: Completion Rate','Media',     'View completion rate (%)', 'number', '32.5', 'video_analytics_summary.completion_count');
add('squid.media.quality_metrics.bitrate','Media: Measured Bitrate','Media',  'Measured stream bitrate', 'number', '6500', 'video_quality_metrics.bandwidth');

// ════════════════════════════════════════════════════════════════════════════
// REPOSITORIES / GIT
// ════════════════════════════════════════════════════════════════════════════

add('squid.repo.id',                   'Repo ID',              'Repository',  'Repository UUID', 'string', 'r_abc...', 'repositories.id');
add('squid.repo.name',                 'Repo Name',            'Repository',  'Repository display name', 'string', 'my-site', 'repositories.repo_name');
add('squid.repo.file_count',           'Repo File Count',      'Repository',  'Files in repository', 'number', '250', 'repositories.file_count');
add('squid.repo.size',                 'Repo Size (bytes)',    'Repository',  'Total repository size', 'number', '52428800', 'repositories.repository_size');
add('squid.repo.health',               'Repo Health',          'Repository',  'Repository health status', 'string', 'healthy', 'repositories.health_status');
add('squid.repo.created_at',           'Repo Created',         'Repository',  'Repository creation date', 'timestamp', '2026-01-15T00:00:00Z');

// ════════════════════════════════════════════════════════════════════════════
// EXTENSIONS
// ════════════════════════════════════════════════════════════════════════════

add('squid.extension.installed_count', 'Installed Extensions', 'Extensions',  'Number of installed extensions', 'number', '5');
add('squid.extension.active_count',    'Active Extensions',    'Extensions',  'Number of enabled extensions', 'number', '3');
add('squid.extension.available_count', 'Available Extensions', 'Extensions',  'Total in marketplace', 'number', '50');
add('squid.extension.last_installed',  'Last Installed',       'Extensions',  'Most recently installed extension name', 'string', 'pdf-editor');
add('squid.extension.ratings_avg',     'Avg Extension Rating', 'Extensions',  'Average marketplace rating', 'number', '4.5');

// ════════════════════════════════════════════════════════════════════════════
// SUPPORT / TICKETS
// ════════════════════════════════════════════════════════════════════════════

// Billing, support, migration, and workspace connection variables are internal.

// ════════════════════════════════════════════════════════════════════════════
// WORKSPACES
// ════════════════════════════════════════════════════════════════════════════

add('squid.workspace.id',              'Workspace ID',         'Workspace',   'Active workspace UUID', 'string', 'ws_abc...');
add('squid.workspace.storage_provider','Storage Provider',     'Workspace',   'Active storage provider type', 'string', 's3');

// ════════════════════════════════════════════════════════════════════════════
// TIMESTAMPS / DATE (dynamic)
// ════════════════════════════════════════════════════════════════════════════

add('squid.timestamp',                 'Current Timestamp',    'System',      'Current UTC ISO 8601 timestamp', 'timestamp', '2026-06-27T12:00:00Z');
add('squid.uuid',                      'Generate UUID v4',     'System',      'Generate a unique UUID v4', 'string', '550e8400-...');
add('squid.date.YYYY',                 'Year (4-digit)',       'System',      'Current year', 'number', '2026');
add('squid.date.YY',                   'Year (2-digit)',       'System',      'Current year (2 digits)', 'number', '26');
add('squid.date.MM',                   'Month (zero-padded)',  'System',      'Month 01-12', 'number', '06');
add('squid.date.M',                    'Month (1-12)',         'System',      'Month without padding', 'number', '6');
add('squid.date.MMM',                  'Month (abbreviated)',  'System',      'Short month name', 'string', 'Jun');
add('squid.date.MMMM',                 'Month (full)',         'System',      'Full month name', 'string', 'June');
add('squid.date.DD',                   'Day (zero-padded)',    'System',      'Day 01-31', 'number', '27');
add('squid.date.D',                    'Day (1-31)',           'System',      'Day without padding', 'number', '27');
add('squid.date.DDD',                  'Day of Year',          'System',      'Day of year 001-366', 'number', '178');
add('squid.date.ddd',                  'Weekday (abbreviated)','System',      'Short weekday name', 'string', 'Sat');
add('squid.date.dddd',                 'Weekday (full)',       'System',      'Full weekday name', 'string', 'Saturday');
add('squid.date.HH',                   'Hour (24h)',           'System',      'Hour 00-23', 'number', '14');
add('squid.date.hh',                   'Hour (12h)',           'System',      'Hour 01-12', 'number', '02');
add('squid.date.mm',                   'Minute',               'System',      'Minute 00-59', 'number', '30');
add('squid.date.ss',                   'Second',               'System',      'Second 00-59', 'number', '45');
add('squid.date.SSS',                  'Milliseconds',         'System',      'Millisecond 000-999', 'number', '123');
add('squid.date.ISO',                  'ISO Week',             'System',      'ISO week number 01-53', 'number', '26');
add('squid.date.Q',                    'Quarter',              'System',      'Quarter of year 1-4', 'number', '2');
add('squid.date.unix',                 'Unix Timestamp (s)',   'System',      'Unix epoch seconds', 'number', '1751032800');
add('squid.date.unix_ms',              'Unix Timestamp (ms)',  'System',      'Unix epoch milliseconds', 'number', '1751032800000');

// ════════════════════════════════════════════════════════════════════════════
// MIGRATION & PLATFORM
// ════════════════════════════════════════════════════════════════════════════

// Migration variables are internal.

// ════════════════════════════════════════════════════════════════════════════
// SUBSCRIPTION / BILLING
// ════════════════════════════════════════════════════════════════════════════

// Billing variables are internal.

export const VARIABLE_CATEGORIES = [...new Set(ALL_VARIABLES.map(v => v.category))];
export const TOTAL_VARIABLES = ALL_VARIABLES.length;

export function getVariablesByCategory(category: string): SquidVariable[] {
  return ALL_VARIABLES.filter(v => v.category === category);
}

export function searchVariables(query: string): SquidVariable[] {
  if (!query) return ALL_VARIABLES;
  const q = query.toLowerCase();
  return ALL_VARIABLES.filter(v =>
    v.token.toLowerCase().includes(q) ||
    v.label.toLowerCase().includes(q) ||
    v.category.toLowerCase().includes(q) ||
    v.description.toLowerCase().includes(q)
  );
}

export function extractUsedTokens(text: string): string[] {
  const tokens: string[] = [];
  const re = /\$\{\{\s*(squid\.[^}]+)\s*\}\}/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const t = m[1].trim();
    if (!tokens.includes(t)) tokens.push(t);
  }
  return tokens;
}
