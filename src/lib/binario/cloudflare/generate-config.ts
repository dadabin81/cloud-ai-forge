// Cloudflare Configuration Generator
// Generate wrangler.toml and project configurations

/**
 * Wrangler configuration options
 */
export interface WranglerConfig {
  projectName: string;
  useAI?: boolean;
  useD1?: boolean;
  d1DatabaseName?: string;
  useKV?: boolean;
  kvNamespaceName?: string;
  useR2?: boolean;
  r2BucketName?: string;
  useDurableObjects?: boolean;
  durableObjectName?: string;
  customDomains?: string[];
  routes?: string[];
  compatibilityDate?: string;
  nodeCompat?: boolean;
  minify?: boolean;
  sourceMaps?: boolean;
  vars?: Record<string, string>;
  secrets?: string[];
}

/**
 * Generate wrangler.toml content
 */
export function generateWranglerConfig(config: WranglerConfig): string {
  const lines: string[] = [];

  // Basic configuration
  lines.push(`name = "${config.projectName}"`);
  lines.push('main = "src/index.ts"');
  lines.push(`compatibility_date = "${config.compatibilityDate || '2024-01-01'}"`);
  lines.push('');

  // Node.js compatibility
  if (config.nodeCompat) {
    lines.push('node_compat = true');
    lines.push('');
  }

  // Build settings
  if (config.minify !== false) {
    lines.push('[build]');
    lines.push('command = "npm run build"');
    lines.push('');
  }

  // AI binding
  if (config.useAI !== false) {
    lines.push('[ai]');
    lines.push('binding = "AI"');
    lines.push('');
  }

  // D1 Database
  if (config.useD1) {
    lines.push('[[d1_databases]]');
    lines.push('binding = "DB"');
    lines.push(`database_name = "${config.d1DatabaseName || 'binario-db'}"`);
    lines.push('database_id = "<YOUR_DATABASE_ID>"');
    lines.push('');
  }

  // KV Namespace
  if (config.useKV) {
    lines.push('[[kv_namespaces]]');
    lines.push('binding = "CACHE"');
    lines.push('id = "<YOUR_KV_NAMESPACE_ID>"');
    lines.push('');
  }

  // R2 Bucket
  if (config.useR2) {
    lines.push('[[r2_buckets]]');
    lines.push('binding = "BUCKET"');
    lines.push(`bucket_name = "${config.r2BucketName || 'binario-storage'}"`);
    lines.push('');
  }

  // Durable Objects
  if (config.useDurableObjects) {
    lines.push('[[durable_objects.bindings]]');
    lines.push(`name = "${config.durableObjectName || 'CHAT_SESSION'}"`);
    lines.push(`class_name = "${config.durableObjectName || 'ChatSession'}"`);
    lines.push('');
    lines.push('[[migrations]]');
    lines.push('tag = "v1"');
    lines.push(`new_classes = ["${config.durableObjectName || 'ChatSession'}"]`);
    lines.push('');
  }

  // Custom domains
  if (config.customDomains?.length) {
    lines.push('[env.production]');
    for (const domain of config.customDomains) {
      lines.push(`routes = [{ pattern = "${domain}", custom_domain = true }]`);
    }
    lines.push('');
  }

  // Routes
  if (config.routes?.length) {
    lines.push('[routes]');
    for (const route of config.routes) {
      lines.push(`pattern = "${route}"`);
    }
    lines.push('');
  }

  // Environment variables
  if (config.vars && Object.keys(config.vars).length > 0) {
    lines.push('[vars]');
    for (const [key, value] of Object.entries(config.vars)) {
      lines.push(`${key} = "${value}"`);
    }
    lines.push('');
  }

  // Comments for secrets
  if (config.secrets?.length) {
    lines.push('# Secrets (set via wrangler secret put):');
    for (const secret of config.secrets) {
      lines.push(`# wrangler secret put ${secret}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generate TypeScript types for Worker environment
 */
export function generateEnvTypes(config: WranglerConfig): string {
  const lines: string[] = [];

  lines.push('// Auto-generated Cloudflare Worker environment types');
  lines.push('// Do not edit manually');
  lines.push('');
  lines.push('export interface Env {');

  if (config.useAI !== false) {
    lines.push('  AI: Ai;');
  }

  if (config.useD1) {
    lines.push('  DB: D1Database;');
  }

  if (config.useKV) {
    lines.push('  CACHE: KVNamespace;');
  }

  if (config.useR2) {
    lines.push('  BUCKET: R2Bucket;');
  }

  if (config.useDurableObjects) {
    lines.push(`  ${config.durableObjectName || 'CHAT_SESSION'}: DurableObjectNamespace;`);
  }

  // Add secrets as strings
  if (config.secrets?.length) {
    for (const secret of config.secrets) {
      lines.push(`  ${secret}?: string;`);
    }
  }

  // Add vars
  if (config.vars) {
    for (const key of Object.keys(config.vars)) {
      lines.push(`  ${key}: string;`);
    }
  }

  lines.push('}');

  return lines.join('\n');
}

/**
 * Generate basic Worker entry file
 */
export function generateWorkerEntry(config: WranglerConfig): string {
  return `// Binario AI Worker
// Generated with binario/cloudflare

import type { Env } from './env';
import { createWorkerHandler } from 'binario/cloudflare';

export default createWorkerHandler({
  systemPrompt: 'You are a helpful AI assistant.',
  model: '@cf/meta/llama-3.2-1b-instruct',
  ${config.useD1 ? 'enableD1: true,' : ''}
  ${config.useKV ? 'enableKV: true,' : ''}
  ${config.useR2 ? 'enableR2: true,' : ''}
});
`;
}

/**
 * Generate package.json scripts for Cloudflare deployment
 */
export function generatePackageScripts(): Record<string, string> {
  return {
    'dev': 'wrangler dev',
    'deploy': 'wrangler deploy',
    'tail': 'wrangler tail',
    'd1:init': 'wrangler d1 execute DB --local --file=./schema.sql',
    'd1:migrate': 'wrangler d1 execute DB --file=./schema.sql',
    'kv:list': 'wrangler kv:namespace list',
    'r2:list': 'wrangler r2 bucket list',
  };
}

/**
 * Generate D1 schema for chat application
 */
export function generateD1Schema(): string {
  return `-- Binario Chat Application Schema

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('system', 'user', 'assistant', 'tool')),
  content TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  tokens_in INTEGER DEFAULT 0,
  tokens_out INTEGER DEFAULT 0,
  model TEXT,
  latency_ms INTEGER,
  neurons_used INTEGER
);

CREATE INDEX IF NOT EXISTS idx_conversations_session ON conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created ON conversations(created_at);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  last_activity TEXT DEFAULT CURRENT_TIMESTAMP,
  metadata TEXT DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS usage_daily (
  date TEXT PRIMARY KEY,
  neurons_used INTEGER DEFAULT 0,
  request_count INTEGER DEFAULT 0,
  tokens_in INTEGER DEFAULT 0,
  tokens_out INTEGER DEFAULT 0
);

-- Trigger to update usage stats
CREATE TRIGGER IF NOT EXISTS update_usage_on_message
AFTER INSERT ON conversations
BEGIN
  INSERT INTO usage_daily (date, neurons_used, request_count, tokens_in, tokens_out)
  VALUES (date(NEW.created_at), COALESCE(NEW.neurons_used, 0), 1, NEW.tokens_in, NEW.tokens_out)
  ON CONFLICT(date) DO UPDATE SET
    neurons_used = usage_daily.neurons_used + COALESCE(NEW.neurons_used, 0),
    request_count = usage_daily.request_count + 1,
    tokens_in = usage_daily.tokens_in + NEW.tokens_in,
    tokens_out = usage_daily.tokens_out + NEW.tokens_out;
END;
`;
}

/**
 * Generate complete project structure
 */
export function generateProjectStructure(config: WranglerConfig): Record<string, string> {
  return {
    'wrangler.toml': generateWranglerConfig(config),
    'src/env.d.ts': generateEnvTypes(config),
    'src/index.ts': generateWorkerEntry(config),
    'schema.sql': generateD1Schema(),
  };
}

/**
 * CLI helper to create new project
 */
export function getProjectSetupCommands(config: WranglerConfig): string[] {
  const commands: string[] = [];

  commands.push('# Initialize Cloudflare project');
  commands.push(`mkdir ${config.projectName} && cd ${config.projectName}`);
  commands.push('npm init -y');
  commands.push('npm install binario zod');
  commands.push('npm install -D wrangler typescript @cloudflare/workers-types');
  commands.push('');

  if (config.useD1) {
    commands.push('# Create D1 database');
    commands.push(`wrangler d1 create ${config.d1DatabaseName || 'binario-db'}`);
    commands.push('# Copy the database_id to wrangler.toml');
    commands.push('');
  }

  if (config.useKV) {
    commands.push('# Create KV namespace');
    commands.push(`wrangler kv:namespace create ${config.kvNamespaceName || 'CACHE'}`);
    commands.push('# Copy the namespace id to wrangler.toml');
    commands.push('');
  }

  if (config.useR2) {
    commands.push('# Create R2 bucket');
    commands.push(`wrangler r2 bucket create ${config.r2BucketName || 'binario-storage'}`);
    commands.push('');
  }

  if (config.secrets?.length) {
    commands.push('# Set secrets');
    for (const secret of config.secrets) {
      commands.push(`wrangler secret put ${secret}`);
    }
    commands.push('');
  }

  commands.push('# Deploy');
  commands.push('wrangler deploy');

  return commands;
}
