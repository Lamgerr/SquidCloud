import type { NodeProps } from '@xyflow/react';

export type ComponentIcon = string;

export interface ComponentIO {
  name: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'json' | 'file' | 'any' | 'select';
  description: string;
  required?: boolean;
  default?: unknown;
  options?: string[];
  placeholder?: string;
  min?: number;
  max?: number;
}

export interface ComponentSubType {
  id: string;
  name: string;
  description: string;
  icon: ComponentIcon;
  inputs: ComponentIO[];
  outputs: ComponentIO[];
  configFields?: ComponentIO[];
  defaultConfig?: Record<string, unknown>;
}

export interface ComponentDefinition {
  id: string;
  name: string;
  icon: ComponentIcon;
  category: string;
  description: string;
  color: string;
  inputs: ComponentIO[];
  outputs: ComponentIO[];
  configFields: ComponentIO[];
  defaultConfig: Record<string, unknown>;
  subTypes?: ComponentSubType[];
  allowCustomConfig?: boolean;
  documentation?: string;
  examples?: string[];
}

export interface ComponentCategory {
  id: string;
  name: string;
  icon: ComponentIcon;
  description: string;
}

export const COMPONENT_CATEGORIES: ComponentCategory[] = [
  { id: 'triggers',     name: 'Triggers',      icon: 'zap',      description: 'Pipeline triggers and event sources' },
  { id: 'file-ops',     name: 'File Operations', icon: 'folder', description: 'File manipulation and management' },
  { id: 'data',         name: 'Data Processing', icon: 'code',   description: 'Transform, filter, and process data' },
  { id: 'network',      name: 'Network & API', icon: 'globe',    description: 'HTTP requests, webhooks, and integrations' },
  { id: 'security',     name: 'Security',       icon: 'shield',  description: 'Encryption, scanning, and access control' },
  { id: 'ai-ml',        name: 'AI & ML',        icon: 'sparkles', description: 'AI-powered analysis and generation' },
  { id: 'media',        name: 'Media',          icon: 'video',   description: 'Video, audio, and image processing' },
  // Database removed — admin/internal only
  // Cloud — admin/infra only
  { id: 'notifications',name: 'Notifications',  icon: 'bell',    description: 'Push, email, SMS and chat messages' },
  { id: 'control',      name: 'Control Flow',   icon: 'git-branch', description: 'Conditionals, loops, error handling' },
  { id: 'utilities',    name: 'Utilities',      icon: 'wrench',  description: 'Timestamps, UUIDs, hashing, formatting' },
  { id: 'storage',      name: 'Storage',        icon: 'archive', description: 'Vault, archive, and compression' },
  { id: 'system',       name: 'System',         icon: 'terminal', description: 'Logging, metrics, and debugging' },
];

export const COMPONENTS: Record<string, ComponentDefinition> = {};

const TRIGGER_OUTPUTS: ComponentIO[] = [
  { name: 'payload', label: 'Trigger Payload', type: 'any', description: 'The event payload that triggered the pipeline' },
  { name: 'metadata', label: 'Metadata', type: 'json', description: 'Trigger metadata including timestamp and source' },
];
const TRIGGER_CONFIG: ComponentIO[] = [{ name: 'enabled', label: 'Enabled', type: 'boolean', description: 'Enable this trigger', default: true }];

['Manual', 'Scheduled', 'Webhook', 'File Change', 'Pipeline Complete'].forEach(n => {
  const id = n.toLowerCase().replace(/\s+/g, '-');
  COMPONENTS[id] = {
    id, name: n, category: 'triggers', color: '#6366f1',
    icon: id === 'manual' ? 'play' : id === 'scheduled' ? 'clock' : id === 'webhook' ? 'webhook' : id === 'file-change' ? 'file-plus' : 'check-circle',
    description: `Trigger pipeline on ${n.toLowerCase()} event`,
    inputs: [], outputs: TRIGGER_OUTPUTS,
    configFields: [
      ...TRIGGER_CONFIG,
      ...(id === 'scheduled' ? [{ name: 'cron', label: 'Cron Expression', type: 'string' as const, description: 'Cron schedule', required: true, placeholder: '0 */6 * * *' }] : []),
      ...(id === 'webhook' ? [{ name: 'method', label: 'HTTP Method', type: 'select' as const, description: 'Allowed HTTP method', options: ['POST','GET','PUT','PATCH','DELETE'], default: 'POST' }] : []),
      ...(id === 'file-change' ? [
        { name: 'path', label: 'Watch Path', type: 'string' as const, description: 'File path to watch', required: true, placeholder: '/uploads/**/*.pdf' },
        { name: 'events', label: 'Events', type: 'select' as const, description: 'File events to watch', options: ['created','modified','deleted','moved','all'], default: 'all' },
      ] : []),
      ...(id === 'pipeline-complete' ? [{ name: 'sourcePipelineId', label: 'Source Pipeline', type: 'string' as const, description: 'Pipeline ID to watch', required: true }] : []),
    ],
    defaultConfig: { enabled: true },
  };
});

const FILE_SOURCE: ComponentSubType = {
  id: 'file-source', name: 'File Source', description: 'Select the source files', icon: 'folder-open',
  inputs: [], outputs: [{ name: 'files', label: 'Selected Files', type: 'file', description: 'Files to operate on' }],
  configFields: [
    { name: 'path', label: 'File Path', type: 'string', description: 'Source file path', required: true, placeholder: '/documents/*.pdf' },
    { name: 'recursive', label: 'Include Subfolders', type: 'boolean', description: 'Search recursively', default: true },
    { name: 'filter', label: 'Name Filter', type: 'string', description: 'Glob pattern filter', placeholder: '*.{pdf,docx}' },
  ],
};
const FILE_DEST: ComponentSubType = {
  id: 'file-destination', name: 'File Destination', description: 'Where to place output files', icon: 'folder',
  inputs: [{ name: 'files', label: 'Input Files', type: 'file', description: 'Files to move/copy' }], outputs: [],
  configFields: [
    { name: 'path', label: 'Destination Path', type: 'string', description: 'Output directory', required: true, placeholder: '/archives/' },
    { name: 'conflict', label: 'On Conflict', type: 'select', description: 'Action if file exists', options: ['overwrite','rename','skip','error'], default: 'rename' },
  ],
};
const FILE_FILTER: ComponentSubType = {
  id: 'file-filter', name: 'File Filter', description: 'Filter files by criteria', icon: 'filter',
  inputs: [{ name: 'files', label: 'Input Files', type: 'file', description: 'Files to filter' }],
  outputs: [{ name: 'matched', label: 'Matched Files', type: 'file', description: 'Filtered files' }],
  configFields: [
    { name: 'minSize', label: 'Min Size (bytes)', type: 'number', description: 'Minimum file size' },
    { name: 'maxSize', label: 'Max Size (bytes)', type: 'number', description: 'Maximum file size' },
    { name: 'types', label: 'Allowed Types', type: 'string', description: 'Comma-separated MIME types', placeholder: 'image/*,application/pdf' },
    { name: 'age', label: 'Max Age (hours)', type: 'number', description: 'Files newer than N hours' },
  ],
};
const FILE_TRANSFORM: ComponentSubType = {
  id: 'file-transform', name: 'File Transform', description: 'Transform file properties', icon: 'wand',
  inputs: [{ name: 'files', label: 'Input Files', type: 'file', description: 'Files to rename' }],
  outputs: [{ name: 'files', label: 'Transformed Files', type: 'file', description: 'Renamed files' }],
  configFields: [
    { name: 'renamePattern', label: 'Rename Pattern', type: 'string', description: 'Use {{ name }}, {{ ext }}, {{ date }}', placeholder: '{{ date }}_{{ name }}{{ ext }}' },
    { name: 'addPrefix', label: 'Add Prefix', type: 'string', description: 'Prepend to filename' },
    { name: 'addSuffix', label: 'Add Suffix', type: 'string', description: 'Append before extension' },
    { name: 'lowercase', label: 'Lowercase Extension', type: 'boolean', description: 'Convert extension to lowercase', default: true },
  ],
};

const fileOpDefs: Record<string, { name: string; icon: string; description: string; extraConfig?: ComponentIO[]; subTypes?: ComponentSubType[] }> = {
  'file-copy':     { name: 'Copy Files',     icon: 'copy',       description: 'Copy files from source to destination' },
  'file-move':     { name: 'Move Files',     icon: 'arrow-right', description: 'Move files from source to destination' },
  'file-delete':   { name: 'Delete Files',   icon: 'trash-2',    description: 'Permanently delete files' },
  'file-rename':   { name: 'Rename Files',   icon: 'edit',       description: 'Rename or batch rename files', subTypes: [FILE_TRANSFORM] },
  'file-upload':   { name: 'Upload File',    icon: 'upload',     description: 'Upload a file to SquidCloud storage', extraConfig: [
    { name: 'folder', label: 'Target Folder', type: 'string', description: 'Storage folder path', required: true, placeholder: '/uploads/' },
    { name: 'overwrite', label: 'Overwrite', type: 'boolean', description: 'Overwrite if exists', default: false },
  ]},
  'file-download': { name: 'Download File',  icon: 'download',   description: 'Download a file from URL or storage', extraConfig: [
    { name: 'url', label: 'Source URL', type: 'string', description: 'URL to download from' },
    { name: 'saveAs', label: 'Save As', type: 'string', description: 'Output filename' },
  ]},
  'file-compress': { name: 'Compress',       icon: 'archive',    description: 'Compress files into archive', extraConfig: [
    { name: 'format', label: 'Archive Format', type: 'select', description: 'Compression format', options: ['zip','tar.gz','tar','7z','rar'], default: 'zip' },
    { name: 'level', label: 'Compression Level', type: 'number', description: '0-9 compression level', default: 6 },
    { name: 'password', label: 'Password', type: 'string', description: 'Encrypt archive with password' },
  ]},
  'file-extract':  { name: 'Extract Archive', icon: 'file-archive', description: 'Extract compressed archive', extraConfig: [
    { name: 'password', label: 'Password', type: 'string', description: 'Archive password if encrypted' },
    { name: 'strip', label: 'Strip Components', type: 'number', description: 'Remove N leading path components', default: 0 },
  ]},
  'file-sync':     { name: 'Sync Folders',   icon: 'refresh-cw', description: 'Two-way sync between folders', extraConfig: [
    { name: 'source', label: 'Source', type: 'string', description: 'Source folder', required: true },
    { name: 'target', label: 'Target', type: 'string', description: 'Target folder', required: true },
    { name: 'mode', label: 'Sync Mode', type: 'select', description: 'Sync direction', options: ['two-way','source-to-target','target-to-source','mirror'], default: 'two-way' },
    { name: 'delete', label: 'Delete Extraneous', type: 'boolean', description: 'Delete files not in source', default: false },
  ]},
  'file-restore':  { name: 'Restore from Trash', icon: 'rotate-ccw', description: 'Restore deleted files', extraConfig: [
    { name: 'fileIds', label: 'File IDs (comma)', type: 'string', description: 'Files to restore' },
  ]},
  'file-empty-trash': { name: 'Empty Trash', icon: 'trash-2', description: 'Permanently empty trash', extraConfig: [
    { name: 'olderThan', label: 'Older Than (days)', type: 'number', description: 'Only delete items older than' },
  ]},
};

Object.entries(fileOpDefs).forEach(([id, def]) => {
  COMPONENTS[id] = { id, category: 'file-ops', color: '#f59e0b', ...def,
    inputs: [{ name: 'files', label: 'Input Files', type: 'file', description: 'Files to process' }],
    outputs: [{ name: 'result', label: 'Result Files', type: 'file', description: 'Output files' }],
    configFields: def.extraConfig || [], defaultConfig: {}, subTypes: def.subTypes || [FILE_SOURCE, FILE_DEST, FILE_FILTER],
  };
});

const echoSubTypes: ComponentSubType[] = [
  { id: 'echo-message', name: 'Message', description: 'Text to output', icon: 'message-square', inputs: [], outputs: [{ name: 'output', label: 'Output', type: 'string', description: 'The echoed text' }],
    configFields: [{ name: 'text', label: 'Message', type: 'string', description: 'Static text or template', required: true, placeholder: 'Hello {{ squid.user.name }}!' }] },
  { id: 'echo-variable', name: 'Variable', description: 'Output a variable value', icon: 'hash', inputs: [], outputs: [{ name: 'value', label: 'Variable Value', type: 'string', description: 'Resolved variable' }],
    configFields: [{ name: 'variable', label: 'Variable Name', type: 'string', description: 'SquidScript variable', required: true, placeholder: 'squid.file.name' }] },
  { id: 'echo-format', name: 'Formatted', description: 'Formatted output with multiple values', icon: 'type', inputs: [], outputs: [{ name: 'output', label: 'Formatted String', type: 'string', description: 'Formatted output' }],
    configFields: [
      { name: 'template', label: 'Template', type: 'string', description: 'Format template', required: true, placeholder: 'File {{ squid.file.name }} is {{ squid.file.size }} bytes' },
      { name: 'level', label: 'Log Level', type: 'select', description: 'Output level', options: ['info','warning','error','debug'], default: 'info' },
    ] },
];

const transformSubTypes: ComponentSubType[] = [
  { id: 'transform-json', name: 'JSON Transform', description: 'Transform JSON data', icon: 'file-json', inputs: [{ name: 'data', label: 'Input Data', type: 'any', description: 'Data to process' }], outputs: [{ name: 'json', label: 'JSON Output', type: 'json', description: 'Parsed JSON data' }],
    configFields: [
      { name: 'jq', label: 'JQ Expression', type: 'string', description: 'JQ-style filter/transform', placeholder: '.files[] | {name, size}' },
      { name: 'operations', label: 'Operations', type: 'json', description: 'JSON array of operations (map, filter, groupBy, sort)', default: [] },
    ] },
  { id: 'transform-csv', name: 'CSV Transform', description: 'Parse and transform CSV', icon: 'file-spreadsheet', inputs: [{ name: 'data', label: 'Input Data', type: 'any', description: 'Data to process' }], outputs: [{ name: 'json', label: 'JSON Output', type: 'json', description: 'Parsed JSON data' }],
    configFields: [
      { name: 'delimiter', label: 'Delimiter', type: 'string', description: 'CSV delimiter', default: ',' },
      { name: 'hasHeader', label: 'Has Header Row', type: 'boolean', description: 'First row is header', default: true },
      { name: 'columns', label: 'Select Columns', type: 'string', description: 'Comma-separated column names' },
    ] },
  { id: 'transform-xml', name: 'XML Transform', description: 'Parse XML to JSON', icon: 'file-code', inputs: [{ name: 'data', label: 'Input Data', type: 'any', description: 'Data to process' }], outputs: [{ name: 'json', label: 'JSON Output', type: 'json', description: 'Parsed XML to JSON' }],
    configFields: [{ name: 'xpath', label: 'XPath Filter', type: 'string', description: 'Extract specific nodes', placeholder: '//item' }] },
  { id: 'transform-template', name: 'Template Engine', description: 'Render a template with variables', icon: 'file-text', inputs: [{ name: 'data', label: 'Input Data', type: 'any', description: 'Data to process' }], outputs: [{ name: 'rendered', label: 'Rendered Output', type: 'string', description: 'Template with variables replaced' }],
    configFields: [
      { name: 'template', label: 'Template', type: 'string', description: 'Handlebars-like template', required: true, placeholder: '{{#each files}}File: {{name}}\n{{/each}}' },
      { name: 'outputType', label: 'Output Type', type: 'select', description: 'Output format', options: ['text','html','json','yaml'], default: 'text' },
    ] },
  { id: 'transform-hash', name: 'Hash/Checksum', description: 'Compute file or data hash', icon: 'hash', inputs: [{ name: 'data', label: 'Input Data', type: 'any', description: 'Data to process' }], outputs: [{ name: 'hash', label: 'Hash', type: 'string', description: 'Computed hash' }],
    configFields: [{ name: 'algorithm', label: 'Algorithm', type: 'select', description: 'Hash algorithm', options: ['md5','sha1','sha256','sha512','blake2b'], default: 'sha256' }] },
  { id: 'transform-yaml', name: 'YAML Transform', description: 'Parse YAML to JSON', icon: 'file-code', inputs: [{ name: 'data', label: 'Input Data', type: 'any', description: 'YAML string' }], outputs: [{ name: 'json', label: 'JSON Output', type: 'json', description: 'Parsed YAML' }] },
  { id: 'transform-base64', name: 'Base64 Encode/Decode', description: 'Encode or decode Base64', icon: 'code', inputs: [{ name: 'data', label: 'Input Data', type: 'any', description: 'Data to encode/decode' }], outputs: [{ name: 'result', label: 'Result', type: 'string', description: 'Converted data' }],
    configFields: [{ name: 'direction', label: 'Direction', type: 'select', options: ['encode','decode'], default: 'encode' }] },
];

const dataDefs: Record<string, { name: string; icon: string; description: string; extraConfig?: ComponentIO[]; subTypes?: ComponentSubType[] }> = {
  'echo':            { name: 'Echo',           icon: 'message-square', description: 'Output text or variable values to logs', subTypes: echoSubTypes },
  'transform':       { name: 'Transform',      icon: 'shuffle',        description: 'Transform data between formats', subTypes: transformSubTypes },
  'filter-data':     { name: 'Filter',         icon: 'filter',         description: 'Filter data by conditions', extraConfig: [
    { name: 'condition', label: 'Condition', type: 'string', description: 'JavaScript-like condition', required: true, placeholder: 'item.size > 1024' },
    { name: 'mode', label: 'Mode', type: 'select', description: 'Filter mode', options: ['include','exclude'], default: 'include' },
  ]},
  'map-data':        { name: 'Map',            icon: 'map',            description: 'Map over array and transform each item', extraConfig: [
    { name: 'expression', label: 'Map Expression', type: 'string', description: 'Transform each item', required: true, placeholder: '{ name: item.name.toUpperCase() }' },
  ]},
  'group-by':        { name: 'Group By',       icon: 'layers',         description: 'Group data by a key', extraConfig: [
    { name: 'key', label: 'Group Key', type: 'string', description: 'Property to group by', required: true, placeholder: 'item.type' },
    { name: 'aggregate', label: 'Aggregate', type: 'select', description: 'Aggregation function', options: ['count','sum','avg','min','max','collect'], default: 'collect' },
  ]},
  'sort':            { name: 'Sort',           icon: 'sort-asc',       description: 'Sort data by field', extraConfig: [
    { name: 'field', label: 'Sort Field', type: 'string', description: 'Property to sort by', required: true, placeholder: 'name' },
    { name: 'order', label: 'Order', type: 'select', description: 'Sort direction', options: ['asc','desc'], default: 'asc' },
  ]},
  'merge':           { name: 'Merge',          icon: 'merge',          description: 'Merge multiple data sources', extraConfig: [
    { name: 'strategy', label: 'Strategy', type: 'select', description: 'Merge strategy', options: ['deep','shallow','concat','zip'], default: 'deep' },
  ]},
  'split':           { name: 'Split',          icon: 'split',          description: 'Split data into chunks', extraConfig: [
    { name: 'chunkSize', label: 'Chunk Size', type: 'number', description: 'Items per chunk', required: true, default: 100 },
  ]},
  'validate':        { name: 'Validate',       icon: 'check-circle',   description: 'Validate data against schema', extraConfig: [
    { name: 'schema', label: 'JSON Schema', type: 'json', description: 'Validation schema', required: true },
    { name: 'throwOnError', label: 'Throw on Error', type: 'boolean', description: 'Fail pipeline if invalid', default: true },
  ]},
  'generate-uuid':   { name: 'Generate UUID',  icon: 'fingerprint',    description: 'Generate a UUID v4', extraConfig: [
    { name: 'count', label: 'Count', type: 'number', description: 'How many UUIDs', default: 1 },
    { name: 'format', label: 'Format', type: 'select', description: 'UUID format', options: ['standard','hex','base64','short'], default: 'standard' },
  ]},
  'generate-timestamp': { name: 'Timestamp',   icon: 'clock',          description: 'Generate or format timestamps', extraConfig: [
    { name: 'format', label: 'Format', type: 'select', description: 'Output format', options: ['iso','unix','unix_ms','rfc2822','custom'], default: 'iso' },
    { name: 'customFormat', label: 'Custom Format', type: 'string', description: 'Moment.js format string', placeholder: 'YYYY-MM-DD HH:mm:ss' },
    { name: 'offset', label: 'Offset (minutes)', type: 'number', description: 'Add/subtract minutes', default: 0 },
  ]},
  'random-string':   { name: 'Random String',  icon: 'key',            description: 'Generate random string', extraConfig: [
    { name: 'length', label: 'Length', type: 'number', default: 16, min: 1, max: 256 },
    { name: 'chars', label: 'Character Set', type: 'select', options: ['alphanumeric','alpha','numeric','hex','base64','all'], default: 'alphanumeric' },
  ]},
  'increment-version': { name: 'Increment Version', icon: 'arrow-up',  description: 'Increment a version number', extraConfig: [
    { name: 'format', label: 'Version Format', type: 'select', options: ['semver','numeric','date-based'], default: 'semver' },
    { name: 'part', label: 'Part', type: 'select', options: ['major','minor','patch','build'], default: 'patch' },
  ]},
};

Object.entries(dataDefs).forEach(([id, def]) => {
  COMPONENTS[id] = { id, category: 'data', color: '#22c55e', ...def,
    inputs: [{ name: 'data', label: 'Input Data', type: 'any', description: 'Data to process' }],
    outputs: [{ name: 'result', label: 'Output Data', type: 'any', description: 'Processed data' }],
    configFields: def.extraConfig || [], defaultConfig: {}, subTypes: def.subTypes,
  };
});
if (COMPONENTS.echo) { COMPONENTS.echo.inputs = []; COMPONENTS.echo.configFields = []; }

const httpSubTypes: ComponentSubType[] = [
  { id: 'http-method', name: 'HTTP Method', description: 'Request method', icon: 'arrow-right', inputs: [], outputs: [],
    configFields: [{ name: 'method', label: 'Method', type: 'select', description: 'HTTP method', options: ['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'], default: 'GET' }] },
  { id: 'http-headers', name: 'Headers', description: 'Request headers', icon: 'list', inputs: [], outputs: [],
    configFields: [{ name: 'headers', label: 'Headers (JSON)', type: 'json', description: 'Key-value header pairs', default: { 'Content-Type': 'application/json' } }] },
  { id: 'http-auth', name: 'Authentication', description: 'Request auth', icon: 'lock', inputs: [], outputs: [],
    configFields: [
      { name: 'authType', label: 'Auth Type', type: 'select', description: 'Auth method', options: ['none','basic','bearer','api-key','oauth2'], default: 'none' },
      { name: 'token', label: 'Token/Key', type: 'string', description: 'Auth token or API key' },
      { name: 'username', label: 'Username', type: 'string', description: 'Basic auth username' },
      { name: 'password', label: 'Password', type: 'string', description: 'Basic auth password' },
    ] },
  { id: 'http-body', name: 'Request Body', description: 'Request payload', icon: 'file-text', inputs: [], outputs: [],
    configFields: [
      { name: 'bodyType', label: 'Body Type', type: 'select', description: 'Content type', options: ['json','form-data','text','binary','graphql'], default: 'json' },
      { name: 'body', label: 'Body', type: 'json', description: 'Request body content' },
    ] },
  { id: 'http-response', name: 'Response Handling', description: 'Parse and handle response', icon: 'corner-down-left', inputs: [], outputs: [{ name: 'response', label: 'Response', type: 'any', description: 'API response' }],
    configFields: [
      { name: 'parseJson', label: 'Parse JSON', type: 'boolean', description: 'Auto-parse JSON response', default: true },
      { name: 'followRedirects', label: 'Follow Redirects', type: 'boolean', description: 'Follow 3xx redirects', default: true },
      { name: 'timeout', label: 'Timeout (ms)', type: 'number', description: 'Request timeout', default: 30000 },
      { name: 'retryCount', label: 'Retries', type: 'number', description: 'Auto-retry on failure', default: 0 },
    ] },
];

const networkDefs: Record<string, { name: string; icon: string; description: string; extraConfig?: ComponentIO[]; subTypes?: ComponentSubType[] }> = {
  'http-request':        { name: 'HTTP Request',     icon: 'globe',     description: 'Make HTTP requests to any API', subTypes: httpSubTypes },
  'webhook-send':        { name: 'Send Webhook',     icon: 'webhook',   description: 'Send a webhook to an external URL', extraConfig: [
    { name: 'url', label: 'Webhook URL', type: 'string', description: 'Target URL', required: true },
    { name: 'secret', label: 'Secret', type: 'string', description: 'HMAC signing secret' },
    { name: 'payload', label: 'Payload', type: 'json', description: 'Custom payload' },
  ]},
  'slack-message':       { name: 'Slack Message',    icon: 'message-square', description: 'Send a message to Slack', extraConfig: [
    { name: 'webhookUrl', label: 'Slack Webhook URL', type: 'string', description: 'Incoming webhook URL', required: true },
    { name: 'channel', label: 'Channel', type: 'string', description: 'Override channel', placeholder: '#general' },
    { name: 'message', label: 'Message', type: 'string', description: 'Message text', required: true, placeholder: 'Pipeline {{ squid.run.id }} completed!' },
    { name: 'username', label: 'Username', type: 'string', description: 'Bot display name', default: 'SquidCloud' },
    { name: 'iconEmoji', label: 'Icon Emoji', type: 'string', description: 'Bot icon', default: ':zap:' },
  ]},
  'discord-message':     { name: 'Discord Message',  icon: 'message-square', description: 'Send a message to Discord', extraConfig: [
    { name: 'webhookUrl', label: 'Discord Webhook URL', type: 'string', description: 'Discord webhook URL', required: true },
    { name: 'content', label: 'Content', type: 'string', description: 'Message content', required: true },
    { name: 'username', label: 'Username', type: 'string', default: 'SquidCloud' },
    { name: 'avatarUrl', label: 'Avatar URL', type: 'string', description: 'Custom bot avatar' },
    { name: 'tts', label: 'Text-to-Speech', type: 'boolean', default: false },
  ]},
  'telegram-message':    { name: 'Telegram Message', icon: 'send',      description: 'Send a message via Telegram bot', extraConfig: [
    { name: 'botToken', label: 'Bot Token', type: 'string', description: 'Telegram bot token', required: true },
    { name: 'chatId', label: 'Chat ID', type: 'string', description: 'Recipient chat ID', required: true },
    { name: 'text', label: 'Message Text', type: 'string', description: 'Message to send', required: true },
  ]},
  'github-action':       { name: 'GitHub Action',    icon: 'github',    description: 'Trigger GitHub Actions workflow', extraConfig: [
    { name: 'token', label: 'GitHub Token', type: 'string', description: 'Personal access token', required: true },
    { name: 'repo', label: 'Repository', type: 'string', description: 'owner/repo', required: true, placeholder: 'user/repo' },
    { name: 'workflow', label: 'Workflow File', type: 'string', description: 'Workflow YAML filename', required: true, placeholder: 'deploy.yml' },
    { name: 'ref', label: 'Branch/Tag', type: 'string', description: 'Git ref', default: 'main' },
    { name: 'inputs', label: 'Workflow Inputs', type: 'json', description: 'Workflow dispatch inputs' },
  ]},
  'gitlab-pipeline':     { name: 'GitLab Pipeline',  icon: 'git-branch', description: 'Trigger GitLab CI pipeline', extraConfig: [
    { name: 'token', label: 'GitLab Token', type: 'string', description: 'GitLab API token', required: true },
    { name: 'projectId', label: 'Project ID', type: 'string', description: 'GitLab project ID', required: true },
    { name: 'ref', label: 'Branch', type: 'string', default: 'main' },
    { name: 'variables', label: 'Variables', type: 'json', description: 'CI/CD variables' },
  ]},
  'email-send':          { name: 'Send Email',       icon: 'mail',      description: 'Send email via SMTP or API', extraConfig: [
    { name: 'to', label: 'To', type: 'string', description: 'Recipient email', required: true },
    { name: 'subject', label: 'Subject', type: 'string', description: 'Email subject', required: true },
    { name: 'body', label: 'Body', type: 'string', description: 'Email body (HTML or text)', required: true },
    { name: 'cc', label: 'CC', type: 'string', description: 'CC recipients' },
    { name: 'bcc', label: 'BCC', type: 'string', description: 'BCC recipients' },
    { name: 'attachments', label: 'Attachments', type: 'file', description: 'Files to attach' },
  ]},
  'discord-webhook':     { name: 'Discord Webhook',  icon: 'message-square', description: 'Advanced Discord webhook with embeds', extraConfig: [
    { name: 'webhookUrl', label: 'Webhook URL', type: 'string', required: true },
    { name: 'embeds', label: 'Embeds (JSON)', type: 'json', description: 'Rich embed objects' },
    { name: 'components', label: 'Components (JSON)', type: 'json', description: 'Buttons, selects' },
  ]},
  'matrix-message':      { name: 'Matrix Message',   icon: 'message-square', description: 'Send message to Matrix room', extraConfig: [
    { name: 'homeserver', label: 'Homeserver', type: 'string', required: true },
    { name: 'accessToken', label: 'Access Token', type: 'string', required: true },
    { name: 'roomId', label: 'Room ID', type: 'string', required: true },
    { name: 'message', label: 'Message', type: 'string', required: true },
  ]},
  'whatsapp-message':    { name: 'WhatsApp Message', icon: 'message-square', description: 'Send WhatsApp message via API', extraConfig: [
    { name: 'to', label: 'Phone Number', type: 'string', required: true },
    { name: 'message', label: 'Message', type: 'string', required: true },
    { name: 'provider', label: 'Provider', type: 'select', options: ['twilio','messagebird','gupshup'], default: 'twilio' },
  ]},
};

Object.entries(networkDefs).forEach(([id, def]) => {
  COMPONENTS[id] = { id, category: 'network', color: '#3b82f6', ...def,
    inputs: [{ name: 'payload', label: 'Payload', type: 'any', description: 'Data to send' }],
    outputs: [{ name: 'response', label: 'Response', type: 'any', description: 'API response' }],
    configFields: def.extraConfig || [], defaultConfig: {}, subTypes: def.subTypes,
  };
});

const scanSubTypes: ComponentSubType[] = [
  { id: 'scan-malware', name: 'Malware Scan', description: 'Scan file for malware', icon: 'shield-alert',
    inputs: [{ name: 'file', label: 'File', type: 'file', description: 'File to scan' }],
    outputs: [{ name: 'clean', label: 'Clean', type: 'boolean', description: 'Is file clean' }, { name: 'threats', label: 'Threats', type: 'json', description: 'Detected threats' }],
    configFields: [{ name: 'deepScan', label: 'Deep Scan', type: 'boolean', description: 'Heuristic analysis', default: true }] },
  { id: 'scan-mime', name: 'MIME Detection', description: 'Detect file MIME type', icon: 'file-type',
    inputs: [{ name: 'file', label: 'File', type: 'file', description: 'File to analyze' }],
    outputs: [{ name: 'mime', label: 'MIME Type', type: 'string', description: 'Detected content type' }, { name: 'extension', label: 'Extension', type: 'string', description: 'Correct extension' }, { name: 'isValid', label: 'Is Valid', type: 'boolean', description: 'Extension matches content' }] },
  { id: 'scan-meta', name: 'Metadata Extract', description: 'Extract file metadata', icon: 'info',
    inputs: [{ name: 'file', label: 'File', type: 'file', description: 'File to analyze' }],
    outputs: [{ name: 'metadata', label: 'Metadata', type: 'json', description: 'EXIF, document properties' }] },
  { id: 'scan-hash', name: 'Hash Check', description: 'Check file against known hashes', icon: 'fingerprint',
    inputs: [{ name: 'file', label: 'File', type: 'file', description: 'File to check' }],
    outputs: [{ name: 'known', label: 'Known Hash', type: 'boolean', description: 'Is hash known' }, { name: 'match', label: 'Match Info', type: 'json' }],
    configFields: [{ name: 'database', label: 'Database', type: 'select', options: ['virustotal','abuseipdb','custom'], default: 'virustotal' }] },
  { id: 'scan-clamav', name: 'ClamAV Scan', description: 'Scan with ClamAV antivirus', icon: 'shield',
    inputs: [{ name: 'file', label: 'File', type: 'file', description: 'File to scan' }],
    outputs: [{ name: 'infected', label: 'Infected', type: 'boolean' }, { name: 'signature', label: 'Signature', type: 'string' }] },
  { id: 'scan-exif', name: 'EXIF Analysis', description: 'Extract image EXIF data', icon: 'image',
    inputs: [{ name: 'file', label: 'Image file', type: 'file' }],
    outputs: [{ name: 'exif', label: 'EXIF Data', type: 'json', description: 'Camera, GPS, date info' }] },
  { id: 'scan-textract', name: 'Text Extraction', description: 'Extract text from documents', icon: 'file-text',
    inputs: [{ name: 'file', label: 'File', type: 'file', description: 'PDF/image/document' }],
    outputs: [{ name: 'text', label: 'Extracted Text', type: 'string' }, { name: 'pages', label: 'Page Count', type: 'number' }],
    configFields: [{ name: 'engine', label: 'Extraction Engine', type: 'select', options: ['tesseract','amazon-textract','azure-vision','pdf-parse'], default: 'tesseract' }] },
];

COMPONENTS['file-scan'] = {
  id: 'file-scan', name: 'File Scan', category: 'security', color: '#ef4444',
  icon: 'shield', description: 'Scan files for threats, metadata, and content analysis',
  inputs: [{ name: 'file', label: 'Input File', type: 'file', description: 'File to analyze' }],
  outputs: [{ name: 'result', label: 'Scan Result', type: 'any', description: 'Complete scan report' }],
  configFields: [], defaultConfig: {}, subTypes: scanSubTypes,
};

const securityDefs: Record<string, { name: string; icon: string; description: string; extraConfig: ComponentIO[] }> = {
  'encrypt-file':      { name: 'Encrypt File',      icon: 'lock',         description: 'Encrypt a file with AES-256', extraConfig: [
    { name: 'algorithm', label: 'Algorithm', type: 'select', options: ['aes-256-gcm','aes-256-cbc','chacha20-poly1305'], default: 'aes-256-gcm' },
    { name: 'keySource', label: 'Key Source', type: 'select', options: ['auto-generate','vault-secret','user-provided','master-key'], default: 'auto-generate' },
    { name: 'keyId', label: 'Key ID / Secret Name', type: 'string' },
  ]},
  'decrypt-file':      { name: 'Decrypt File',      icon: 'unlock',       description: 'Decrypt an encrypted file', extraConfig: [
    { name: 'keySource', label: 'Key Source', type: 'select', options: ['auto-detect','vault-secret','user-provided','master-key'], default: 'auto-detect' },
  ]},
  'hash-file':         { name: 'Hash File',         icon: 'fingerprint',  description: 'Compute file hash/checksum', extraConfig: [
    { name: 'algorithm', label: 'Algorithm', type: 'select', options: ['sha256','sha512','md5','blake2b','sha1'], default: 'sha256' },
    { name: 'format', label: 'Output Format', type: 'select', options: ['hex','base64','base64url'], default: 'hex' },
  ]},
  'sign-file':         { name: 'Digital Sign',      icon: 'pen',          description: 'Sign a file with private key', extraConfig: [
    { name: 'keyId', label: 'Signing Key (Vault)', type: 'string', required: true },
    { name: 'algorithm', label: 'Algorithm', type: 'select', options: ['ed25519','ecdsa-p256','rsa-2048'], default: 'ed25519' },
  ]},
  'verify-signature':  { name: 'Verify Signature',  icon: 'check-circle', description: 'Verify a file signature', extraConfig: [
    { name: 'signature', label: 'Signature (hex)', type: 'string', required: true },
    { name: 'publicKey', label: 'Public Key', type: 'string', required: true },
  ]},
  'access-control':    { name: 'Access Control',    icon: 'key',          description: 'Set file/folder access permissions', extraConfig: [
    { name: 'visibility', label: 'Visibility', type: 'select', options: ['private','public','shared','vault'], default: 'private' },
    { name: 'allowedUsers', label: 'Allowed Users', type: 'string', description: 'Comma-separated user IDs or emails' },
    { name: 'expiresAt', label: 'Expires At', type: 'string', description: 'ISO timestamp' },
  ]},
  // audit-log and key-rotation are admin-only
};

Object.entries(securityDefs).forEach(([id, def]) => {
  COMPONENTS[id] = { id, category: 'security', color: '#ef4444', ...def,
    inputs: [{ name: 'file', label: 'Input File', type: 'file', description: 'File to process' }],
    outputs: [{ name: 'result', label: 'Result', type: 'any', description: 'Processing result' }],
    configFields: def.extraConfig, defaultConfig: {},
  };
});

const aiDefs: Record<string, { name: string; icon: string; description: string; extraConfig: ComponentIO[] }> = {
  'ai-analyze':      { name: 'AI Analyze',      icon: 'sparkles', description: 'Analyze content with AI (sentiment, entities, summary)', extraConfig: [
    { name: 'model', label: 'Model', type: 'select', options: ['gpt-4o','gpt-4o-mini','claude-3-sonnet','claude-3-haiku','gemini-pro'], default: 'gpt-4o-mini' },
    { name: 'task', label: 'Task', type: 'select', options: ['summarize','classify','extract-entities','sentiment','ask-question','translate','proofread'], default: 'summarize' },
    { name: 'prompt', label: 'Custom Prompt', type: 'string', description: 'Override default prompt' },
    { name: 'maxTokens', label: 'Max Tokens', type: 'number', default: 1000 },
    { name: 'temperature', label: 'Temperature', type: 'number', default: 0.3, min: 0, max: 2 },
  ]},
  'ai-classify':     { name: 'AI Classify',     icon: 'hash',     description: 'Classify content into categories', extraConfig: [
    { name: 'categories', label: 'Categories', type: 'string', description: 'Comma-separated options', required: true, placeholder: 'invoice,receipt,contract,letter' },
    { name: 'confidence', label: 'Min Confidence', type: 'number', default: 0.7, min: 0, max: 1 },
  ]},
  'ai-extract':      { name: 'AI Extract',      icon: 'file-text', description: 'Extract structured data from documents', extraConfig: [
    { name: 'schema', label: 'Output Schema', type: 'json', description: 'JSON schema for extraction', required: true, default: { fields: [{ name: 'date', type: 'string' }] } },
    { name: 'documentType', label: 'Document Type', type: 'select', options: ['invoice','receipt','resume','contract','article','form','email'], default: 'invoice' },
  ]},
  'ai-generate':     { name: 'AI Generate',     icon: 'wand-2',   description: 'Generate text content with AI', extraConfig: [
    { name: 'prompt', label: 'Prompt', type: 'string', description: 'Content generation prompt', required: true },
    { name: 'format', label: 'Format', type: 'select', options: ['text','json','html','markdown','yaml','email'], default: 'text' },
    { name: 'temperature', label: 'Creativity', type: 'number', default: 0.7, min: 0, max: 2 },
    { name: 'maxTokens', label: 'Max Tokens', type: 'number', default: 2048 },
  ]},
  'ai-ocr':          { name: 'OCR Extract',     icon: 'scan',     description: 'Extract text from images/PDFs', extraConfig: [
    { name: 'language', label: 'Language', type: 'string', default: 'eng' },
    { name: 'detectTables', label: 'Detect Tables', type: 'boolean', default: true },
  ]},
  'ai-embed':        { name: 'AI Embeddings',   icon: 'sparkles', description: 'Generate text embeddings', extraConfig: [
    { name: 'model', label: 'Model', type: 'select', options: ['text-embedding-ada-002','text-embedding-3-small','text-embedding-3-large'], default: 'text-embedding-3-small' },
  ]},
  'ai-translate':    { name: 'AI Translate',    icon: 'languages', description: 'Translate text between languages', extraConfig: [
    { name: 'sourceLang', label: 'Source Language', type: 'string', default: 'auto' },
    { name: 'targetLang', label: 'Target Language', type: 'string', required: true, default: 'en' },
    { name: 'preserveFormatting', label: 'Preserve Formatting', type: 'boolean', default: true },
  ]},
  'ai-moderate':     { name: 'AI Moderate',     icon: 'shield',   description: 'Moderate content for safety', extraConfig: [
    { name: 'categories', label: 'Categories', type: 'select', options: ['all','hate','harassment','sexual','violence','self-harm'], default: 'all' },
    { name: 'threshold', label: 'Threshold', type: 'number', default: 0.7, min: 0, max: 1 },
  ]},
};

Object.entries(aiDefs).forEach(([id, def]) => {
  COMPONENTS[id] = { id, category: 'ai-ml', color: '#a855f7', ...def,
    inputs: [{ name: 'content', label: 'Content', type: 'any', description: 'Text or file content to process' }],
    outputs: [{ name: 'result', label: 'AI Result', type: 'any', description: 'Analysis output' }],
    configFields: def.extraConfig, defaultConfig: {},
  };
});

const mediaDefs: Record<string, { name: string; icon: string; description: string; extraConfig: ComponentIO[] }> = {
  'transcode-video':   { name: 'Transcode Video',    icon: 'video',        description: 'Convert video to different format/quality', extraConfig: [
    { name: 'outputFormat', label: 'Output Format', type: 'select', options: ['mp4','webm','hls','dash','avi','mkv','mov'], default: 'mp4' },
    { name: 'quality', label: 'Quality', type: 'select', options: ['source','2160p','1080p','720p','480p','360p','240p'], default: '1080p' },
    { name: 'codec', label: 'Video Codec', type: 'select', options: ['h264','h265','vp9','av1'], default: 'h264' },
    { name: 'crf', label: 'CRF (Quality)', type: 'number', default: 23, min: 0, max: 51 },
    { name: 'generateHls', label: 'Generate HLS', type: 'boolean', default: true },
  ]},
  'transcode-audio':   { name: 'Transcode Audio',    icon: 'music',        description: 'Convert audio format', extraConfig: [
    { name: 'outputFormat', label: 'Output Format', type: 'select', options: ['mp3','aac','flac','wav','opus','ogg','m4a'], default: 'mp3' },
    { name: 'bitrate', label: 'Bitrate (kbps)', type: 'number', default: 192 },
    { name: 'sampleRate', label: 'Sample Rate', type: 'select', options: ['44100','48000','96000','192000'], default: '44100' },
    { name: 'channels', label: 'Channels', type: 'select', options: ['mono','stereo','5.1','7.1'], default: 'stereo' },
  ]},
  'generate-thumbnail': { name: 'Thumbnail',         icon: 'image',        description: 'Generate video/image thumbnail', extraConfig: [
    { name: 'width', label: 'Width', type: 'number', default: 320 },
    { name: 'height', label: 'Height', type: 'number', default: 180 },
    { name: 'time', label: 'Time Offset (s)', type: 'number', default: 5, description: 'For video: timestamp' },
    { name: 'format', label: 'Format', type: 'select', options: ['jpg','png','webp'], default: 'jpg' },
  ]},
  'resize-image':      { name: 'Resize Image',       icon: 'maximize',     description: 'Resize or scale images', extraConfig: [
    { name: 'width', label: 'Width', type: 'number' }, { name: 'height', label: 'Height', type: 'number' },
    { name: 'fit', label: 'Fit', type: 'select', options: ['cover','contain','fill','inside','outside'], default: 'cover' },
    { name: 'format', label: 'Format', type: 'select', options: ['jpeg','png','webp','avif'], default: 'jpeg' },
    { name: 'quality', label: 'Quality', type: 'number', default: 85, min: 1, max: 100 },
  ]},
  'watermark-image':   { name: 'Watermark',          icon: 'droplets',     description: 'Add watermark to images', extraConfig: [
    { name: 'watermarkType', label: 'Type', type: 'select', options: ['text','image'], default: 'text' },
    { name: 'text', label: 'Watermark Text', type: 'string', default: 'SquidCloud' },
    { name: 'position', label: 'Position', type: 'select', options: ['top-left','top-right','bottom-left','bottom-right','center'], default: 'bottom-right' },
    { name: 'opacity', label: 'Opacity', type: 'number', default: 0.5, min: 0, max: 1 },
  ]},
  'convert-image':     { name: 'Convert Image',      icon: 'refresh-cw',   description: 'Convert between image formats', extraConfig: [
    { name: 'format', label: 'Target Format', type: 'select', options: ['jpeg','png','webp','avif','gif','bmp','tiff','svg'], default: 'webp' },
    { name: 'quality', label: 'Quality', type: 'number', default: 85 },
  ]},
  'extract-audio':     { name: 'Extract Audio',      icon: 'music',        description: 'Extract audio from video', extraConfig: [
    { name: 'format', label: 'Audio Format', type: 'select', options: ['mp3','aac','flac','wav'], default: 'mp3' },
    { name: 'bitrate', label: 'Bitrate', type: 'number', default: 192 },
  ]},
  'concat-video':      { name: 'Concatenate Videos', icon: 'merge',        description: 'Join multiple videos', extraConfig: [
    { name: 'transition', label: 'Transition', type: 'select', options: ['none','fade','dissolve','slide','wipe'], default: 'fade' },
    { name: 'transitionDuration', label: 'Transition (s)', type: 'number', default: 0.5 },
  ]},
  'extract-media-meta':{ name: 'Extract Media Info', icon: 'info',         description: 'Extract media metadata', extraConfig: [
    { name: 'details', label: 'Detail Level', type: 'select', options: ['basic','full','technical'], default: 'basic' },
  ]},
  'add-subtitles':     { name: 'Add Subtitles',      icon: 'subtitles',    description: 'Burn subtitles into video', extraConfig: [
    { name: 'srtContent', label: 'SRT Content', type: 'string', description: 'Subtitle text in SRT format' },
    { name: 'srtUrl', label: 'SRT URL', type: 'string', description: 'URL to subtitle file' },
    { name: 'language', label: 'Language', type: 'string', default: 'eng' },
    { name: 'burnIn', label: 'Burn Into Video', type: 'boolean', default: false },
  ]},
  'compress-video':    { name: 'Compress Video',     icon: 'video',        description: 'Reduce video file size', extraConfig: [
    { name: 'targetSize', label: 'Target Size (MB)', type: 'number' },
    { name: 'targetBitrate', label: 'Target Bitrate (kbps)', type: 'number' },
    { name: 'reduceResolution', label: 'Reduce Resolution', type: 'boolean', default: false },
    { name: 'maxWidth', label: 'Max Width', type: 'number', default: 1920 },
  ]},
  'extract-frames':    { name: 'Extract Frames',     icon: 'image',        description: 'Extract frames from video', extraConfig: [
    { name: 'interval', label: 'Interval (s)', type: 'number', default: 10 },
    { name: 'format', label: 'Image Format', type: 'select', options: ['jpg','png'], default: 'jpg' },
    { name: 'maxFrames', label: 'Max Frames', type: 'number', default: 100 },
  ]},
};

Object.entries(mediaDefs).forEach(([id, def]) => {
  COMPONENTS[id] = { id, category: 'media', color: '#ec4899', ...def,
    inputs: [{ name: 'media', label: 'Media File', type: 'file', description: 'Video, audio, or image file' }],
    outputs: [{ name: 'result', label: 'Output', type: 'any', description: 'Processing result' }],
    configFields: def.extraConfig, defaultConfig: {},
  };
});

// Database components are admin-only and not exposed in the user-facing visual editor.
// Built-in actions like file-scan, publish-site, etc. handle DB internally.

// Cloud deployment and storage infrastructure components are admin-only.
// User-available cloud actions are handled through file-ops and network.

const notificationDefs: Record<string, { name: string; icon: string; description: string; extraConfig: ComponentIO[] }> = {
  'push-notification':   { name: 'Push Notification',   icon: 'bell',        description: 'Send push notification to device', extraConfig: [
    { name: 'title', label: 'Title', type: 'string', required: true },
    { name: 'body', label: 'Body', type: 'string', required: true },
    { name: 'icon', label: 'Icon URL', type: 'string' },
    { name: 'url', label: 'Click URL', type: 'string' },
    { name: 'priority', label: 'Priority', type: 'select', options: ['high','normal','low'], default: 'normal' },
    { name: 'ttl', label: 'TTL (seconds)', type: 'number', default: 86400 },
  ]},
  'in-app-notification': { name: 'In-App Notification',  icon: 'bell',        description: 'Show notification inside SquidCloud', extraConfig: [
    { name: 'title', label: 'Title', type: 'string', required: true },
    { name: 'message', label: 'Message', type: 'string', required: true },
    { name: 'type', label: 'Type', type: 'select', options: ['info','success','warning','error'], default: 'info' },
    { name: 'duration', label: 'Duration (ms)', type: 'number', default: 5000 },
  ]},
  'sms-send':            { name: 'Send SMS',             icon: 'smartphone',  description: 'Send SMS notification', extraConfig: [
    { name: 'to', label: 'Phone Number', type: 'string', required: true },
    { name: 'message', label: 'Message', type: 'string', required: true },
    { name: 'provider', label: 'Provider', type: 'select', options: ['twilio','vonage','plivo','aws-sns'], default: 'twilio' },
  ]},
  'send-email-template': { name: 'Send Email Template',  icon: 'mail',        description: 'Send email using template', extraConfig: [
    { name: 'to', label: 'To', type: 'string', required: true },
    { name: 'template', label: 'Template ID', type: 'string', required: true },
    { name: 'variables', label: 'Template Variables (JSON)', type: 'json' },
  ]},
};

Object.entries(notificationDefs).forEach(([id, def]) => {
  COMPONENTS[id] = { id, category: 'notifications', color: '#f43f5e', ...def,
    inputs: [{ name: 'data', label: 'Data', type: 'any', description: 'Notification payload' }],
    outputs: [{ name: 'sent', label: 'Sent', type: 'boolean', description: 'Delivery status' }],
    configFields: def.extraConfig, defaultConfig: {},
  };
});

const controlDefs: Record<string, { name: string; icon: string; description: string; extraConfig: ComponentIO[] }> = {
  'condition':         { name: 'Condition (If/Else)', icon: 'git-branch', description: 'Branch pipeline based on condition', extraConfig: [
    { name: 'condition', label: 'Condition', type: 'string', required: true, placeholder: 'squid.file.size > 1048576' },
  ]},
  'switch-case':       { name: 'Switch/Case',        icon: 'git-branch', description: 'Multi-branch routing', extraConfig: [
    { name: 'expression', label: 'Expression', type: 'string', required: true, placeholder: 'squid.file.extension' },
    { name: 'cases', label: 'Cases (JSON)', type: 'json', default: { pdf: 'route-pdf', image: 'route-image' } },
  ]},
  'for-loop':          { name: 'For Each',           icon: 'repeat',     description: 'Iterate over array items', extraConfig: [
    { name: 'items', label: 'Items Source', type: 'string', required: true, placeholder: 'squid.file.scan' },
    { name: 'variable', label: 'Loop Variable', type: 'string', default: 'item' },
    { name: 'parallel', label: 'Parallel Execution', type: 'boolean', default: false },
    { name: 'maxParallel', label: 'Max Parallel', type: 'number', default: 5 },
  ]},
  'while-loop':        { name: 'While Loop',         icon: 'repeat',     description: 'Loop while condition is true', extraConfig: [
    { name: 'condition', label: 'Condition', type: 'string', required: true, placeholder: 'counter < 10' },
    { name: 'maxIterations', label: 'Max Iterations', type: 'number', default: 100 },
  ]},
  'delay':             { name: 'Delay/Wait',         icon: 'clock',      description: 'Pause pipeline execution', extraConfig: [
    { name: 'duration', label: 'Duration (ms)', type: 'number', default: 1000 },
    { name: 'variable', label: 'Variable Duration', type: 'string', placeholder: 'squid.env.delay' },
  ]},
  'try-catch':         { name: 'Try/Catch',          icon: 'shield',     description: 'Error handling block', extraConfig: [
    { name: 'maxRetries', label: 'Max Retries', type: 'number', default: 0 },
    { name: 'retryDelay', label: 'Retry Delay (ms)', type: 'number', default: 1000 },
    { name: 'onError', label: 'On Error', type: 'select', options: ['abort','continue','retry','fallback'], default: 'abort' },
  ]},
  'parallel':          { name: 'Parallel Fork',      icon: 'split',      description: 'Run branches in parallel', extraConfig: [
    { name: 'branches', label: 'Number of Branches', type: 'number', default: 2, min: 1, max: 50 },
    { name: 'waitAll', label: 'Wait For All', type: 'boolean', default: true },
  ]},
  'sequence':          { name: 'Sequential',         icon: 'list',       description: 'Run steps sequentially', extraConfig: [
    { name: 'failFast', label: 'Fail Fast', type: 'boolean', default: true },
  ]},
  'wait-for-event':    { name: 'Wait For Event',     icon: 'pause',      description: 'Pause and wait for external event', extraConfig: [
    { name: 'eventType', label: 'Event Type', type: 'select', options: ['webhook','file-created','file-modified','approval','timer','custom'], default: 'webhook' },
    { name: 'timeout', label: 'Timeout (s)', type: 'number', default: 3600 },
    { name: 'eventConfig', label: 'Event Config', type: 'json' },
  ]},
  'abort-pipeline':    { name: 'Abort Pipeline',     icon: 'x-circle',   description: 'Abort execution with message', extraConfig: [
    { name: 'message', label: 'Reason', type: 'string', placeholder: 'Pipeline aborted: condition not met' },
  ]},
  'notify-approval':   { name: 'Request Approval',   icon: 'user-check',  description: 'Pause and wait for human approval', extraConfig: [
    { name: 'approvers', label: 'Approvers (emails)', type: 'string', required: true },
    { name: 'message', label: 'Approval Message', type: 'string', required: true },
    { name: 'timeout', label: 'Timeout (hours)', type: 'number', default: 24 },
  ]},
};

Object.entries(controlDefs).forEach(([id, def]) => {
  COMPONENTS[id] = { id, category: 'control', color: '#eab308', ...def,
    inputs: [{ name: 'data', label: 'Input', type: 'any', description: 'Data to evaluate' }],
    outputs: [{ name: 'result', label: 'Result', type: 'any', description: 'Branch output' }],
    configFields: def.extraConfig, defaultConfig: {},
  };
});

const utilDefs: Record<string, { name: string; icon: string; description: string; extraConfig: ComponentIO[] }> = {
  'template':          { name: 'Template String',    icon: 'file-text', description: 'Render template with variables', extraConfig: [
    { name: 'template', label: 'Template', type: 'string', required: true, placeholder: 'Hello {{ squid.user.name }}' },
    { name: 'outputVar', label: 'Output Variable', type: 'string', placeholder: 'my_greeting' },
  ]},
  'format-date':       { name: 'Format Date',        icon: 'calendar',  description: 'Format or parse dates', extraConfig: [
    { name: 'input', label: 'Input', type: 'string', placeholder: '{{ squid.timestamp }}' },
    { name: 'inputFormat', label: 'Input Format', type: 'select', options: ['auto','iso','unix','unix_ms','rfc2822'], default: 'auto' },
    { name: 'outputFormat', label: 'Output Format', type: 'select', options: ['iso','date','time','datetime','relative','custom'], default: 'datetime' },
    { name: 'timezone', label: 'Timezone', type: 'string', placeholder: 'America/New_York' },
  ]},
  'json-parse':        { name: 'Parse JSON',         icon: 'file-json', description: 'Parse JSON string to object' },
  'json-stringify':    { name: 'Stringify JSON',     icon: 'file-json', description: 'Serialize object to JSON', extraConfig: [
    { name: 'pretty', label: 'Pretty Print', type: 'boolean', default: true },
  ]},
  'math-evaluate':     { name: 'Math Evaluate',      icon: 'calculator', description: 'Evaluate math expression', extraConfig: [
    { name: 'expression', label: 'Expression', type: 'string', placeholder: '{{ squid.file.size }} / 1048576' },
  ]},
  'custom-script':     { name: 'Run Custom Script',  icon: 'terminal',  description: 'Execute a custom JavaScript/TypeScript snippet', extraConfig: [
    { name: 'code', label: 'Script Code', type: 'string', required: true, placeholder: 'return input.map(x => x * 2);' },
    { name: 'timeout', label: 'Timeout (ms)', type: 'number', default: 30000 },
    { name: 'sandbox', label: 'Sandbox', type: 'boolean', default: true },
  ]},
  'config-file':      { name: 'Config File',        icon: 'settings',   description: 'Read/write pipeline config files', extraConfig: [
    { name: 'action', label: 'Action', type: 'select', options: ['read','write','merge','validate'], default: 'read' },
    { name: 'format', label: 'Config Format', type: 'select', options: ['json','yaml','toml','env'], default: 'json' },
    { name: 'path', label: 'Config Path', type: 'string', placeholder: '/config/app.json' },
  ]},
  'cache-get':         { name: 'Cache Get',          icon: 'database',  description: 'Retrieve cached value', extraConfig: [
    { name: 'key', label: 'Cache Key', type: 'string', required: true },
    { name: 'ttl', label: 'TTL (seconds)', type: 'number', default: 300 },
  ]},
  'cache-set':         { name: 'Cache Set',          icon: 'database',  description: 'Store value in cache', extraConfig: [
    { name: 'key', label: 'Cache Key', type: 'string', required: true },
    { name: 'value', label: 'Value', type: 'string', required: true },
    { name: 'ttl', label: 'TTL (seconds)', type: 'number', default: 300 },
  ]},
  'url-parse':         { name: 'Parse URL',          icon: 'link',      description: 'Parse URL into components', extraConfig: [
    { name: 'url', label: 'URL', type: 'string', required: true },
  ]},
  'html-to-text':      { name: 'HTML to Text',       icon: 'file-text', description: 'Strip HTML tags to plain text' },
  'slugify':           { name: 'Slugify String',     icon: 'hash',      description: 'Convert string to URL-safe slug', extraConfig: [
    { name: 'input', label: 'Input', type: 'string' },
    { name: 'separator', label: 'Separator', type: 'string', default: '-' },
  ]},
  'truncate':          { name: 'Truncate String',    icon: 'type',      description: 'Truncate string to max length', extraConfig: [
    { name: 'maxLength', label: 'Max Length', type: 'number', default: 100 },
    { name: 'ellipsis', label: 'Ellipsis', type: 'string', default: '...' },
  ]},
  'compare-strings':   { name: 'Compare Strings',    icon: 'copy',      description: 'Compare two strings or files', extraConfig: [
    { name: 'a', label: 'String A', type: 'string' },
    { name: 'b', label: 'String B', type: 'string' },
    { name: 'caseSensitive', label: 'Case Sensitive', type: 'boolean', default: true },
  ]},
  'regex-extract':     { name: 'Regex Extract',      icon: 'code',      description: 'Extract data using regex', extraConfig: [
    { name: 'pattern', label: 'Regex Pattern', type: 'string', required: true, placeholder: '(\\\\d{4})-(\\\\d{2})-(\\\\d{2})' },
    { name: 'input', label: 'Input Text', type: 'string' },
    { name: 'flags', label: 'Flags', type: 'string', default: 'g' },
  ]},
};

Object.entries(utilDefs).forEach(([id, def]) => {
  COMPONENTS[id] = { id, category: 'utilities', color: '#64748b', ...def,
    inputs: [{ name: 'input', label: 'Input', type: 'any', description: 'Input data' }],
    outputs: [{ name: 'output', label: 'Output', type: 'any', description: 'Processed result' }],
    configFields: def.extraConfig || [], defaultConfig: {},
  };
});

const storageDefs: Record<string, { name: string; icon: string; description: string; extraConfig: ComponentIO[] }> = {
  'archive-files':     { name: 'Create Archive',     icon: 'archive',    description: 'Create ZIP/TAR archive from files', extraConfig: [
    { name: 'format', label: 'Format', type: 'select', options: ['zip','tar.gz','tar','7z'], default: 'zip' },
    { name: 'name', label: 'Archive Name', type: 'string', required: true, placeholder: 'backup-{{ date.YYYY-MM-DD }}' },
    { name: 'password', label: 'Password', type: 'string' },
    { name: 'splitSize', label: 'Split Size (MB)', type: 'number' },
  ]},
  'vault-store':       { name: 'Store in Vault',     icon: 'lock',       description: 'Move file to encrypted vault', extraConfig: [
    { name: 'vaultName', label: 'Vault Name', type: 'string', placeholder: 'Personal Vault' },
    { name: 'deleteOriginal', label: 'Delete Original', type: 'boolean', default: true },
  ]},
  'vault-retrieve':    { name: 'Retrieve from Vault', icon: 'unlock',    description: 'Restore file from vault' },
  'backup-file':       { name: 'Backup File',        icon: 'save',       description: 'Create timestamped backup', extraConfig: [
    { name: 'retention', label: 'Retention (days)', type: 'number', default: 30 },
    { name: 'versioning', label: 'Keep Versions', type: 'boolean', default: true },
  ]},
  'create-vault':      { name: 'Create Vault',       icon: 'lock',       description: 'Create a new encrypted vault', extraConfig: [
    { name: 'name', label: 'Vault Name', type: 'string', required: true },
    { name: 'password', label: 'Vault Password', type: 'string', required: true },
    { name: 'enableFingerprint', label: 'Enable Fingerprint', type: 'boolean', default: false },
  ]},
};

Object.entries(storageDefs).forEach(([id, def]) => {
  COMPONENTS[id] = { id, category: 'storage', color: '#8b5cf6', ...def,
    inputs: [{ name: 'files', label: 'Files', type: 'file', description: 'Files to process' }],
    outputs: [{ name: 'result', label: 'Result', type: 'any', description: 'Operation result' }],
    configFields: def.extraConfig, defaultConfig: {},
  };
});

const systemDefs: Record<string, { name: string; icon: string; description: string; extraConfig: ComponentIO[] }> = {
  'log-message':       { name: 'Log Message',        icon: 'terminal',   description: 'Write to pipeline execution log', extraConfig: [
    { name: 'level', label: 'Level', type: 'select', options: ['info','warn','error','debug'], default: 'info' },
    { name: 'message', label: 'Message', type: 'string', required: true, placeholder: 'Processing file {{ squid.file.name }}' },
  ]},
  'emit-metric':       { name: 'Emit Metric',        icon: 'gauge',      description: 'Track pipeline metric', extraConfig: [
    { name: 'name', label: 'Metric Name', type: 'string', required: true },
    { name: 'value', label: 'Value', type: 'number' },
    { name: 'labels', label: 'Labels (JSON)', type: 'json' },
  ]},
  'set-variable':      { name: 'Set Variable',       icon: 'hash',       description: 'Set a pipeline variable', extraConfig: [
    { name: 'name', label: 'Variable Name', type: 'string', required: true, placeholder: 'my_var' },
    { name: 'value', label: 'Value', type: 'string' },
    { name: 'scope', label: 'Scope', type: 'select', options: ['step','job','pipeline','global'], default: 'pipeline' },
  ]},
  'debug-point':       { name: 'Debug Breakpoint',   icon: 'bug',        description: 'Pause and inspect pipeline state', extraConfig: [
    { name: 'inspect', label: 'Inspect Variables', type: 'json' },
    { name: 'condition', label: 'Break Condition', type: 'string' },
  ]},
  'export-logs':       { name: 'Export Logs',        icon: 'file-text',  description: 'Export pipeline logs to file', extraConfig: [
    { name: 'format', label: 'Format', type: 'select', options: ['json','text','csv'], default: 'json' },
    { name: 'includeSteps', label: 'Include Steps', type: 'boolean', default: true },
  ]},
  'send-report':       { name: 'Send Report',        icon: 'presentation', description: 'Generate and send execution report', extraConfig: [
    { name: 'format', label: 'Report Format', type: 'select', options: ['summary','detailed','html','pdf'], default: 'summary' },
    { name: 'recipients', label: 'Recipients', type: 'string', placeholder: 'Comma-separated emails' },
  ]},
  'system-info':       { name: 'System Info',        icon: 'monitor',    description: 'Get system/environment information' },
  'list-files':        { name: 'List Directory',     icon: 'folder',     description: 'List files in a directory', extraConfig: [
    { name: 'path', label: 'Directory Path', type: 'string', required: true, placeholder: '/' },
    { name: 'recursive', label: 'Recursive', type: 'boolean', default: false },
    { name: 'includeHidden', label: 'Include Hidden', type: 'boolean', default: false },
  ]},
  // run-subpipeline is admin-only
};

Object.entries(systemDefs).forEach(([id, def]) => {
  COMPONENTS[id] = { id, category: 'system', color: '#6b7280', ...def,
    inputs: [{ name: 'data', label: 'Data', type: 'any', description: 'System data' }],
    outputs: [{ name: 'result', label: 'Result', type: 'any', description: 'Operation result' }],
    configFields: def.extraConfig, defaultConfig: {},
  };
});

export function getComponentsByCategory(categoryId: string): ComponentDefinition[] {
  return Object.values(COMPONENTS).filter(c => c.category === categoryId);
}

export function getComponent(id: string): ComponentDefinition | undefined {
  return COMPONENTS[id];
}

export function getCategory(id: string): ComponentCategory | undefined {
  return COMPONENT_CATEGORIES.find(c => c.id === id);
}

export function getAllComponents(): ComponentDefinition[] {
  return Object.values(COMPONENTS);
}

export function componentCount(): number {
  return Object.keys(COMPONENTS).length;
}
