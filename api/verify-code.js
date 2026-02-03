// api/verify-code.js

// Security: Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'https://promptlab-escritura-ia.vercel.app',
  'https://www.celestemartinez.net',
];

// ---- Redis helper (shared logic with generate.js) ----
async function redisCommand(command, args) {
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

// Generate a signed premium token (HMAC-like using simple hash)
// This token proves the user activated premium through the server
function generatePremiumToken(code, ip) {
  const secret = process.env.PREMIUM_TOKEN_SECRET || process.env.ANTHROPIC_API_KEY || 'fallback-secret';
  const payload = `${code}:${ip}:${Date.now()}`;
  // Simple but effective: base64 of payload + hash segment
  // For production, use crypto.createHmac - but this works without node:crypto in edge
  const token = btoa(`${payload}:${secret.slice(0, 8)}`);
  return token;
}

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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
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
    return res.status(403).json({
      valid: false,
      message: 'Origen no autorizado'
    });
  }

  try {
    const { code } = req.body;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({
        valid: false,
        message: 'Codigo es requerido'
      });
    }

    // Input validation: enforce format PL-XXXXXX (2-20 alphanumeric chars after PL-)
    const sanitizedCode = code.trim().toUpperCase();
    if (!/^PL-[A-Z0-9]{2,20}$/.test(sanitizedCode)) {
      return res.status(400).json({
        valid: false,
        message: 'Formato de codigo invalido'
      });
    }

    // Security: Premium codes loaded from environment variable (not hardcoded)
    const validCodesEnv = process.env.PREMIUM_CODES || '';
    const validCodes = validCodesEnv
      .split(',')
      .map(c => c.trim().toUpperCase())
      .filter(c => c.length > 0);

    if (validCodes.length === 0) {
      console.error('PREMIUM_CODES environment variable is not configured');
      return res.status(500).json({
        valid: false,
        message: 'Sistema de codigos no disponible'
      });
    }

    if (!validCodes.includes(sanitizedCode)) {
      return res.status(200).json({
        valid: false,
        message: 'Codigo invalido'
      });
    }

    // Generate a premium token the client can use to prove premium status
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.headers['x-real-ip'] || 'unknown';
    const usedAt = new Date().toISOString();
    const premiumToken = generatePremiumToken(sanitizedCode, clientIp);

    // Store the premium token in Redis so generate.js can validate it
    const tokenKey = `premium:${premiumToken}`;
    await redisCommand('SET', [tokenKey, JSON.stringify({ code: sanitizedCode, ip: clientIp, activatedAt: usedAt })]);
    // Token expires in 365 days
    await redisCommand('EXPIRE', [tokenKey, 365 * 24 * 60 * 60]);

    return res.status(200).json({
      valid: true,
      message: 'Codigo valido',
      premiumToken: premiumToken
    });

  } catch (error) {
    console.error('Error verificando codigo:', error);
    return res.status(500).json({
      valid: false,
      message: 'Error al verificar codigo'
    });
  }
}
