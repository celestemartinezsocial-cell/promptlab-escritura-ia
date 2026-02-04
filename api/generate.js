// Security: Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'https://promptlab-escritura-ia.vercel.app',
  'https://www.celestemartinez.net',
];

// ---- Upstash Redis helpers (persistent rate limiting & usage tracking) ----
// Falls back to in-memory if UPSTASH env vars are not set

const inMemoryRateLimit = new Map();
const inMemoryUsage = new Map(); // Fallback usage tracking when Redis is down
const RATE_LIMIT_WINDOW_SEC = 60;
const RATE_LIMIT_MAX = 10;

// Weekly usage limits enforced server-side
const USAGE_LIMITS = {
  anonymous: 10,
  registered: 15,
  premium: 50
};

async function redisCommand(command, args) {
  // Check all common Upstash env var names (integration may use different names)
  const url = process.env.UPSTASH_REDIS_REST_URL
    || process.env.KV_REST_API_URL
    || process.env.REDIS_REST_URL
    || process.env.KV_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
    || process.env.KV_REST_API_TOKEN
    || process.env.REDIS_REST_TOKEN
    || process.env.KV_REST_API_READ_ONLY_TOKEN;
  if (!url || !token) return null;

  try {
    const res = await fetch(`${url}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([command, ...args])
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.result;
  } catch {
    return null;
  }
}

async function isRateLimited(ip) {
  const key = `rl:${ip}`;

  // Try Redis first
  const count = await redisCommand('INCR', [key]);
  if (count !== null) {
    if (count === 1) {
      await redisCommand('EXPIRE', [key, RATE_LIMIT_WINDOW_SEC]);
    }
    return count > RATE_LIMIT_MAX;
  }

  // Fallback: in-memory
  const now = Date.now();
  const entry = inMemoryRateLimit.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_SEC * 1000) {
    inMemoryRateLimit.set(ip, { windowStart: now, count: 1 });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

// Server-side weekly usage tracking
function getWeekKey() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  // Key format: week:2026-01-26
  return `week:${monday.toISOString().split('T')[0]}`;
}

function getSecondsUntilNextMonday() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + daysUntilMonday);
  nextMonday.setHours(0, 0, 0, 0);
  return Math.ceil((nextMonday - now) / 1000);
}

async function checkAndIncrementUsage(ip, tier, premiumToken) {
  // Premium users: verify token in Redis before granting unlimited access
  if (tier === 'premium' && premiumToken) {
    const tokenKey = `premium:${premiumToken}`;
    const tokenData = await redisCommand('GET', [tokenKey]);
    if (tokenData !== null) {
      // Valid premium token confirmed server-side
      return { allowed: true };
    }
    // Invalid or expired token - fall through to anonymous limits
  }

  // Non-premium or unverified premium: enforce limits
  const limit = USAGE_LIMITS[tier === 'premium' ? 'anonymous' : tier] || USAGE_LIMITS.anonymous;
  const weekKey = getWeekKey();
  const usageKey = `usage:${weekKey}:${ip}`;

  // Try Redis
  const count = await redisCommand('INCR', [usageKey]);
  if (count !== null) {
    if (count === 1) {
      // Set expiry to end of week + 1 day buffer
      const ttl = getSecondsUntilNextMonday() + 86400;
      await redisCommand('EXPIRE', [usageKey, ttl]);
    }
    if (count > limit) {
      return { allowed: false, remaining: 0, limit };
    }
    return { allowed: true, remaining: limit - count, limit };
  }

  // Redis unavailable fallback: use in-memory tracking with strict limits
  const fallbackKey = `usage:${ip}`;
  const now = Date.now();
  const entry = inMemoryUsage.get(fallbackKey);
  const weekMs = 7 * 24 * 60 * 60 * 1000;

  if (!entry || now - entry.start > weekMs) {
    inMemoryUsage.set(fallbackKey, { start: now, count: 1 });
    return { allowed: true, remaining: limit - 1, limit };
  }

  entry.count++;
  if (entry.count > limit) {
    return { allowed: false, remaining: 0, limit };
  }
  return { allowed: true, remaining: limit - entry.count, limit };
}

// ---- Request helpers ----

function getAllowedOrigin(req) {
  const origin = req.headers?.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (!origin) return ALLOWED_ORIGINS[0];
  return null;
}

function setSecurityHeaders(res, allowedOrigin) {
  if (allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Tier, X-Premium-Token');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
}

// Security: Max allowed content length (characters) to prevent abuse
const MAX_PROMPT_LENGTH = 5000;
const MAX_MESSAGES = 10;

function validateMessages(messages) {
  if (!Array.isArray(messages)) return false;
  if (messages.length === 0 || messages.length > MAX_MESSAGES) return false;

  for (const msg of messages) {
    if (!msg || typeof msg !== 'object') return false;
    if (!['user', 'assistant'].includes(msg.role)) return false;
    if (typeof msg.content !== 'string') return false;
    if (msg.content.length > MAX_PROMPT_LENGTH) return false;
    if (msg.content.trim().length === 0) return false;
  }
  return true;
}

export default async function handler(req, res) {
  const allowedOrigin = getAllowedOrigin(req);
  setSecurityHeaders(res, allowedOrigin);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CSRF protection: reject cross-origin requests from unknown origins
  if (req.headers?.origin && !allowedOrigin) {
    return res.status(403).json({ error: 'Origen no autorizado' });
  }

  // Get client IP
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress || 'unknown';

  // Rate limiting (per-minute burst protection)
  if (await isRateLimited(clientIp)) {
    return res.status(429).json({ error: 'Demasiadas solicitudes. Intenta de nuevo en un minuto.' });
  }

  // Server-side weekly usage enforcement
  const claimedTier = req.headers['x-tier'] || 'anonymous';
  const validTiers = ['anonymous', 'registered', 'premium'];
  const tier = validTiers.includes(claimedTier) ? claimedTier : 'anonymous';

  // Premium claims require a server-issued token for validation
  const premiumToken = req.headers['x-premium-token'] || null;

  // Only premium users with valid tokens can generate
  if (tier !== 'premium' || !premiumToken) {
    return res.status(403).json({ error: 'Se requiere acceso premium. Adquiere tu código en Thinkific.' });
  }

  const usageCheck = await checkAndIncrementUsage(clientIp, tier, premiumToken);

  if (!usageCheck.allowed) {
    return res.status(429).json({
      error: 'Has alcanzado tu limite semanal de generaciones.',
      remaining: 0,
      limit: usageCheck.limit
    });
  }

  // Verify API key is configured
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not configured');
    return res.status(500).json({ error: 'Servicio no disponible' });
  }

  try {
    const { prompt, messages } = req.body;

    // Input validation and sanitization
    let apiMessages;
    if (messages) {
      if (!validateMessages(messages)) {
        return res.status(400).json({ error: 'Formato de mensajes invalido' });
      }
      apiMessages = messages;
    } else if (prompt) {
      if (typeof prompt !== 'string' || prompt.trim().length === 0) {
        return res.status(400).json({ error: 'Prompt invalido' });
      }
      if (prompt.length > MAX_PROMPT_LENGTH) {
        return res.status(400).json({ error: 'Prompt demasiado largo (maximo 5000 caracteres)' });
      }
      apiMessages = [{ role: "user", content: prompt.trim() }];
    } else {
      return res.status(400).json({ error: 'Se requiere prompt o messages' });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: apiMessages
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      // Security: Don't expose upstream API error details to client
      console.error('Anthropic API error:', errorData);
      return res.status(502).json({ error: 'Error al generar contenido' });
    }

    const data = await response.json();
    const text = data.content[0]?.text || '';

    // Include remaining usage info in response
    return res.status(200).json({
      text,
      ...(usageCheck.remaining != null ? { remaining: usageCheck.remaining } : {})
    });

  } catch (error) {
    // Security: Don't expose internal error details to client
    console.error('Error:', error);
    return res.status(500).json({ error: 'Error al generar contenido' });
  }
}
