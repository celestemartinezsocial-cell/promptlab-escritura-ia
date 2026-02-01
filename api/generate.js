// Security: Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'https://promptlab-escritura-ia.vercel.app',
  'https://www.celestemartinez.net',
];

// Security: Rate limiting per IP (in-memory, resets on cold start)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 10; // max requests per window

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { windowStart: now, count: 1 });
    return false;
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) return true;
  return false;
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

  // Rate limiting
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress || 'unknown';

  if (isRateLimited(clientIp)) {
    return res.status(429).json({ error: 'Demasiadas solicitudes. Intenta de nuevo en un minuto.' });
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
        return res.status(400).json({ error: 'Formato de mensajes inválido' });
      }
      apiMessages = messages;
    } else if (prompt) {
      if (typeof prompt !== 'string' || prompt.trim().length === 0) {
        return res.status(400).json({ error: 'Prompt inválido' });
      }
      if (prompt.length > MAX_PROMPT_LENGTH) {
        return res.status(400).json({ error: 'Prompt demasiado largo (máximo 5000 caracteres)' });
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

    return res.status(200).json({ text });

  } catch (error) {
    // Security: Don't expose internal error details to client
    console.error('Error:', error);
    return res.status(500).json({ error: 'Error al generar contenido' });
  }
}
