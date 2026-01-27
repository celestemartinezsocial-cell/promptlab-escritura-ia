// api/verify-code.js
export default async function handler(req, res) {
  // Permitir CORS para tu dominio
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ 
        valid: false, 
        message: 'Código es requerido' 
      });
    }

    // AQUÍ VAN TUS CÓDIGOS - Reemplaza con los que generes
    const validCodes = [
      'PL-ABC12345',
      'PL-XYZ67890',
      'PL-TEST1234',
      // Agrega más códigos aquí
    ];

    const normalizedCode = code.trim().toUpperCase();
    
    if (validCodes.includes(normalizedCode)) {
      return res.status(200).json({ 
        valid: true,
        message: 'Código válido' 
      });
    } else {
      return res.status(200).json({ 
        valid: false,
        message: 'Código inválido o ya usado' 
      });
    }

  } catch (error) {
    console.error('Error verificando código:', error);
    return res.status(500).json({ 
      valid: false,
      message: 'Error al verificar código' 
    });
  }
}
