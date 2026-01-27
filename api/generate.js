export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt, messages } = req.body;
    
    // Construir mensajes según lo que recibimos
    let apiMessages;
    if (messages) {
      // Si recibimos array de mensajes (conversación con memoria)
      apiMessages = messages;
    } else if (prompt) {
      // Si recibimos prompt simple (primera generación)
      apiMessages = [{ role: "user", content: prompt }];
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
      throw new Error(errorData.error?.message || 'Error en la API de Anthropic');
    }

    const data = await response.json();
    const text = data.content[0]?.text || '';

    return res.status(200).json({ text });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ 
      error: error.message || 'Error al generar contenido' 
    });
  }
}
