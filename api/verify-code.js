// api/verify-code.js

// Security: Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'https://promptlab-escritura-ia.vercel.app',
  'https://www.celestemartinez.net',
];

function getAllowedOrigin(req) {
  const origin = req.headers?.origin || '';
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  // Allow same-origin requests (no Origin header)
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
        message: 'Código es requerido'
      });
    }

    // Input validation: enforce format PL-XXXXXX (2-20 alphanumeric chars after PL-)
    const sanitizedCode = code.trim().toUpperCase();
    if (!/^PL-[A-Z0-9]{2,20}$/.test(sanitizedCode)) {
      return res.status(400).json({
        valid: false,
        message: 'Formato de código inválido'
      });
    }

    // Security: Premium codes loaded from environment variable (not hardcoded)
    // Set PREMIUM_CODES env var as comma-separated values: "PL-ABC12345,PL-XYZ67890"
    const validCodesEnv = process.env.PREMIUM_CODES || '';
    const validCodes = validCodesEnv
      .split(',')
      .map(c => c.trim().toUpperCase())
      .filter(c => c.length > 0);

    if (validCodes.length === 0) {
      console.error('PREMIUM_CODES environment variable is not configured');
      return res.status(500).json({
        valid: false,
        message: 'Sistema de códigos no disponible'
      });
    }

    if (validCodes.includes(sanitizedCode)) {
      return res.status(200).json({
        valid: true,
        message: 'Código válido'
      });
    } else {
      // Use consistent timing to prevent timing attacks
      return res.status(200).json({
        valid: false,
        message: 'Código inválido o ya usado'
      });
    }

  } catch (error) {
    // Security: Don't expose internal error details
    console.error('Error verificando código:', error);
    return res.status(500).json({
      valid: false,
      message: 'Error al verificar código'
    });
  }
}
