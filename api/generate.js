export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const { prompt } = req.body;
    
    if (!prompt) {
        return res.status(400).json({ error: 'Prompt requerido' });
    }
    
    try {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": process.env.ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01"
            },
            body: JSON.stringify({
                model: "claude-sonnet-4-20250514",
                max_tokens: 2048,
                messages: [{ role: "user", content: prompt }]
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            return res.status(response.status).json({ 
                error: errorData.error?.message || 'Error en API' 
            });
        }
        
        const json = await response.json();
        const text = json.content?.find(i => i.type === "text")?.text || "";
        
        res.status(200).json({ text });
        
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message });
    }
}
