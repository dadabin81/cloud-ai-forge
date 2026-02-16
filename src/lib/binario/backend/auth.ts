// Binario Backend - Authentication & API Key Management

export interface User {
  id: string;
  email: string;
  plan: 'free' | 'pro' | 'enterprise';
  createdAt: string;
  stripeCustomerId?: string;
}

export interface ApiKey {
  id: string;
  userId: string;
  name: string;
  keyPrefix: string;
  keyHash: string;
  createdAt: string;
  lastUsedAt?: string;
  isActive: boolean;
}

// Generate a new API key
export function generateApiKey(type: 'live' | 'test' = 'live'): { key: string; prefix: string } {
  const prefix = `bsk_${type}_`;
  const randomPart = generateRandomString(32);
  const key = `${prefix}${randomPart}`;
  
  return {
    key,
    prefix: key.substring(0, 12), // Store first 12 chars for display
  };
}

// Hash API key for storage
export async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Validate API key format
export function validateApiKeyFormat(key: string): boolean {
  // Format: bsk_live_xxxxx or bsk_test_xxxxx
  const pattern = /^bsk_(live|test)_[a-zA-Z0-9]{32}$/;
  return pattern.test(key);
}

// Database operations for auth
export class AuthManager {
  constructor(private db: D1Database) {}

  // Create a new user
  async createUser(email: string, plan: 'free' | 'pro' | 'enterprise' = 'free'): Promise<User> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await this.db.prepare(`
      INSERT INTO users (id, email, plan, created_at)
      VALUES (?, ?, ?, ?)
    `).bind(id, email, plan, now).run();

    return { id, email, plan, createdAt: now };
  }

  // Get user by email
  async getUserByEmail(email: string): Promise<User | null> {
    const result = await this.db.prepare(`
      SELECT id, email, plan, created_at as createdAt, stripe_customer_id as stripeCustomerId
      FROM users WHERE email = ?
    `).bind(email).first();

    return result as User | null;
  }

  // Get user by ID
  async getUserById(id: string): Promise<User | null> {
    const result = await this.db.prepare(`
      SELECT id, email, plan, created_at as createdAt, stripe_customer_id as stripeCustomerId
      FROM users WHERE id = ?
    `).bind(id).first();

    return result as User | null;
  }

  // Create API key for user
  async createApiKey(userId: string, name: string, type: 'live' | 'test' = 'live'): Promise<{ key: string; apiKey: ApiKey }> {
    const { key, prefix } = generateApiKey(type);
    const keyHash = await hashApiKey(key);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await this.db.prepare(`
      INSERT INTO api_keys (id, user_id, name, key_prefix, key_hash, created_at, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `).bind(id, userId, name, prefix, keyHash, now).run();

    const apiKey: ApiKey = {
      id,
      userId,
      name,
      keyPrefix: prefix,
      keyHash,
      createdAt: now,
      isActive: true,
    };

    // Return full key only once - user must save it
    return { key, apiKey };
  }

  // List user's API keys
  async listApiKeys(userId: string): Promise<ApiKey[]> {
    const results = await this.db.prepare(`
      SELECT id, user_id as userId, name, key_prefix as keyPrefix, 
             created_at as createdAt, last_used_at as lastUsedAt, is_active as isActive
      FROM api_keys 
      WHERE user_id = ? AND is_active = 1
      ORDER BY created_at DESC
    `).bind(userId).all();

    return (results.results || []) as unknown as ApiKey[];
  }

  // Revoke API key
  async revokeApiKey(keyId: string, userId: string): Promise<boolean> {
    await this.db.prepare(`
      UPDATE api_keys SET is_active = 0 
      WHERE id = ? AND user_id = ?
    `).bind(keyId, userId).run();

    return true;
  }

  // Validate API key and return user info
  async validateApiKey(key: string): Promise<{ user: User; keyId: string } | null> {
    if (!validateApiKeyFormat(key)) {
      return null;
    }

    const keyHash = await hashApiKey(key);

    const result = await this.db.prepare(`
      SELECT ak.id as keyId, u.id, u.email, u.plan, u.created_at as createdAt
      FROM api_keys ak
      JOIN users u ON ak.user_id = u.id
      WHERE ak.key_hash = ? AND ak.is_active = 1
    `).bind(keyHash).first<{ keyId: string; id: string; email: string; plan: string; createdAt: string }>();

    if (!result) return null;

    // Update last used
    await this.db.prepare(`
      UPDATE api_keys SET last_used_at = ? WHERE key_hash = ?
    `).bind(new Date().toISOString(), keyHash).run();

    return {
      user: {
        id: result.id,
        email: result.email,
        plan: result.plan as 'free' | 'pro' | 'enterprise',
        createdAt: result.createdAt,
      },
      keyId: result.keyId,
    };
  }

  // Update user plan
  async updateUserPlan(userId: string, plan: 'free' | 'pro' | 'enterprise'): Promise<void> {
    await this.db.prepare(`
      UPDATE users SET plan = ? WHERE id = ?
    `).bind(plan, userId).run();
  }

  // Set Stripe customer ID
  async setStripeCustomerId(userId: string, stripeCustomerId: string): Promise<void> {
    await this.db.prepare(`
      UPDATE users SET stripe_customer_id = ? WHERE id = ?
    `).bind(stripeCustomerId, userId).run();
  }
}

// Helper function to generate random string
function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => chars[byte % chars.length]).join('');
}

// Rate limiting helper
export class RateLimiter {
  constructor(private kv: KVNamespace) {}

  async checkLimit(
    keyId: string,
    limits: { requestsPerMinute: number; requestsPerDay: number }
  ): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    const now = Date.now();
    const minuteWindow = Math.floor(now / 60000);
    const dayWindow = Math.floor(now / 86400000);

    const minuteKey = `rate:${keyId}:min:${minuteWindow}`;
    const dayKey = `rate:${keyId}:day:${dayWindow}`;

    // Check minute limit
    const minuteValue = (await this.kv.get(minuteKey)) as string | null;
    const minuteCount = parseInt(minuteValue ?? '0');
    if (minuteCount >= limits.requestsPerMinute) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: (minuteWindow + 1) * 60000,
      };
    }

    // Check day limit
    const dayValue = (await this.kv.get(dayKey)) as string | null;
    const dayCount = parseInt(dayValue ?? '0');
    if (dayCount >= limits.requestsPerDay) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: (dayWindow + 1) * 86400000,
      };
    }

    // Increment counters
    await this.kv.put(minuteKey, String(minuteCount + 1), { expirationTtl: 120 });
    await this.kv.put(dayKey, String(dayCount + 1), { expirationTtl: 86400 });

    return {
      allowed: true,
      remaining: Math.min(
        limits.requestsPerMinute - minuteCount - 1,
        limits.requestsPerDay - dayCount - 1
      ),
      resetAt: (minuteWindow + 1) * 60000,
    };
  }
}
