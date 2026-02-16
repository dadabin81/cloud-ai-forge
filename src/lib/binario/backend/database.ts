// Binario Backend - D1 Database Schema

// SQL schema for creating tables
export const SCHEMA_SQL = `
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
  stripe_customer_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- API Keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT UNIQUE NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at TEXT
);

-- Usage tracking table
CREATE TABLE IF NOT EXISTS usage (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  model TEXT NOT NULL,
  tokens_input INTEGER DEFAULT 0,
  tokens_output INTEGER DEFAULT 0,
  requests INTEGER DEFAULT 0,
  neurons_used INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, date, model)
);

-- Sessions table (for web auth)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_usage_user_date ON usage(user_id, date);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- Trigger to update updated_at
CREATE TRIGGER IF NOT EXISTS users_updated_at 
AFTER UPDATE ON users
BEGIN
  UPDATE users SET updated_at = datetime('now') WHERE id = NEW.id;
END;
`;

// Migration scripts
export const MIGRATIONS = [
  {
    version: 1,
    name: 'initial_schema',
    sql: SCHEMA_SQL,
  },
  {
    version: 2,
    name: 'add_agent_logs',
    sql: `
      CREATE TABLE IF NOT EXISTS agent_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        session_id TEXT,
        message TEXT NOT NULL,
        tool_calls TEXT,
        output TEXT,
        iterations INTEGER DEFAULT 0,
        latency_ms INTEGER,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      
      CREATE INDEX IF NOT EXISTS idx_agent_logs_user ON agent_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_agent_logs_session ON agent_logs(session_id);
    `,
  },
];

// Database manager for common operations
export class DatabaseManager {
  constructor(private db: D1Database) {}

  // Initialize database with schema
  async init(): Promise<void> {
    await this.db.exec(SCHEMA_SQL);
  }

  // Run migrations
  async migrate(): Promise<void> {
    // Create migrations table if not exists
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    // Get current version
    const result = await this.db.prepare(
      'SELECT MAX(version) as version FROM migrations'
    ).first<{ version: number | null }>();
    const currentVersion = result?.version ?? 0;

    // Apply pending migrations
    for (const migration of MIGRATIONS) {
      if (migration.version > currentVersion) {
        await this.db.exec(migration.sql);
        await this.db.prepare(
          'INSERT INTO migrations (version, name) VALUES (?, ?)'
        ).bind(migration.version, migration.name).run();
        console.log(`Applied migration: ${migration.name}`);
      }
    }
  }

  // Get usage stats for a user
  async getUsageStats(userId: string, days: number = 30): Promise<{
    totalRequests: number;
    totalTokens: number;
    totalNeurons: number;
    byModel: { model: string; requests: number; tokens: number }[];
    byDate: { date: string; requests: number; tokens: number }[];
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    // Totals
    const totals = await this.db.prepare(`
      SELECT 
        SUM(requests) as totalRequests,
        SUM(tokens_input + tokens_output) as totalTokens,
        SUM(neurons_used) as totalNeurons
      FROM usage 
      WHERE user_id = ? AND date >= ?
    `).bind(userId, startDateStr).first<{ totalRequests: number | null; totalTokens: number | null; totalNeurons: number | null }>();

    // By model
    const byModel = await this.db.prepare(`
      SELECT 
        model,
        SUM(requests) as requests,
        SUM(tokens_input + tokens_output) as tokens
      FROM usage 
      WHERE user_id = ? AND date >= ?
      GROUP BY model
      ORDER BY requests DESC
    `).bind(userId, startDateStr).all<{ model: string; requests: number; tokens: number }>();

    // By date
    const byDate = await this.db.prepare(`
      SELECT 
        date,
        SUM(requests) as requests,
        SUM(tokens_input + tokens_output) as tokens
      FROM usage 
      WHERE user_id = ? AND date >= ?
      GROUP BY date
      ORDER BY date DESC
    `).bind(userId, startDateStr).all<{ date: string; requests: number; tokens: number }>();

    return {
      totalRequests: totals?.totalRequests ?? 0,
      totalTokens: totals?.totalTokens ?? 0,
      totalNeurons: totals?.totalNeurons ?? 0,
      byModel: byModel.results ?? [],
      byDate: byDate.results ?? [],
    };
  }

  // Log agent execution
  async logAgentRun(data: {
    userId: string;
    sessionId?: string;
    message: string;
    toolCalls: any[];
    output: string;
    iterations: number;
    latencyMs: number;
  }): Promise<void> {
    await this.db.prepare(`
      INSERT INTO agent_logs (id, user_id, session_id, message, tool_calls, output, iterations, latency_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      data.userId,
      data.sessionId || null,
      data.message,
      JSON.stringify(data.toolCalls),
      data.output,
      data.iterations,
      data.latencyMs
    ).run();
  }

  // Clean up old data
  async cleanup(retentionDays: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    // Delete old usage records
    await this.db.prepare(
      'DELETE FROM usage WHERE date < ?'
    ).bind(cutoffStr).run();

    // Delete old agent logs
    await this.db.prepare(
      "DELETE FROM agent_logs WHERE created_at < datetime(?)"
    ).bind(cutoffDate.toISOString()).run();

    // Delete expired sessions
    await this.db.prepare(
      "DELETE FROM sessions WHERE expires_at < datetime('now')"
    ).run();

    return 0; // Simplified - actual count not critical
  }
}

// Export schema for use in wrangler setup
export function getSchemaSQL(): string {
  return SCHEMA_SQL;
}
