// js/prompt-security.js - Sistema de detección de prompt injection

const DANGEROUS_PATTERNS = [
    // Comandos de ignorar instrucciones
    /ignore\s+(all\s+)?(previous|prior|above|system)\s+instructions?/gi,
    /forget\s+(everything|all|previous|instructions)/gi,
    /disregard\s+(previous|all|above)\s+(instructions?|prompts?)/gi,
    
    // Intentos de role switching
    /you\s+are\s+now\s+(in\s+)?(admin|root|system|developer)\s+mode/gi,
    /\[?(system|admin|root|developer)\]?\s*:/gi,
    /act\s+as\s+(a\s+)?(admin|root|system|hacker)/gi,
    
    // Intentos de extraer información del sistema
    /show\s+(me\s+)?(your|the)\s+(prompt|instructions|system\s+prompt)/gi,
    /what\s+(is|are)\s+your\s+(instructions|rules|prompt)/gi,
    /reveal\s+your\s+(prompt|instructions|system)/gi,
    
    // Inyección de comandos
    /<!--.*?-->/g,
    /<script[\s\S]*?<\/script>/gi,
    /\${.*?}/g,
    /eval\s*\(/gi,
    
    // Intentos de bypass
    /bypass\s+(security|filter|check)/gi,
    /disable\s+(security|filter|safety)/gi,
    /override\s+(security|safety|rules)/gi,
    
    // Prompts maliciosos comunes
    /new\s+instructions?:/gi,
    /updated\s+instructions?:/gi,
    /\[new\s+task\]/gi,
    /\[\/INST\]/gi, // Llama 2 injection
    /###\s+Instruction:/gi
];

const SUSPICIOUS_KEYWORDS = [
    'api key', 'password', 'secret', 'token', 'credential',
    'admin', 'root', 'sudo', 'system prompt', 'jailbreak',
    'DAN mode', 'developer mode', 'ignore', 'disregard'
];

class PromptSecurity {
    static analyze(text) {
        if (!text || typeof text !== 'string') {
            return { safe: true, threats: [] };
        }

        const threats = [];
        const lowerText = text.toLowerCase();

        // Check dangerous patterns
        DANGEROUS_PATTERNS.forEach((pattern, index) => {
            if (pattern.test(text)) {
                threats.push({
                    type: 'pattern',
                    severity: 'high',
                    pattern: pattern.source,
                    description: 'Patrón sospechoso detectado'
                });
            }
        });

        // Check suspicious keywords (multiple occurrences = higher risk)
        const keywordMatches = SUSPICIOUS_KEYWORDS.filter(keyword => 
            lowerText.includes(keyword.toLowerCase())
        );

        if (keywordMatches.length >= 2) {
            threats.push({
                type: 'keywords',
                severity: 'medium',
                keywords: keywordMatches,
                description: 'Múltiples palabras sospechosas detectadas'
            });
        }

        // Check for excessive special characters (possible obfuscation)
        const specialCharCount = (text.match(/[^\w\s\.,!?¿¡\-]/g) || []).length;
        const specialCharRatio = specialCharCount / text.length;
        
        if (specialCharRatio > 0.15) {
            threats.push({
                type: 'obfuscation',
                severity: 'medium',
                ratio: specialCharRatio,
                description: 'Posible ofuscación detectada'
            });
        }

        // Check for role-play attempts
        if (/\[.*?\]/g.test(text) && /system|admin|root/.test(lowerText)) {
            threats.push({
                type: 'roleplay',
                severity: 'high',
                description: 'Intento de cambio de rol detectado'
            });
        }

        return {
            safe: threats.length === 0,
            threats: threats,
            riskLevel: this.calculateRiskLevel(threats)
        };
    }

    static calculateRiskLevel(threats) {
        if (threats.length === 0) return 'safe';
        
        const hasHighSeverity = threats.some(t => t.severity === 'high');
        const mediumCount = threats.filter(t => t.severity === 'medium').length;
        
        if (hasHighSeverity || mediumCount >= 3) return 'high';
        if (mediumCount >= 1) return 'medium';
        return 'low';
    }

    static sanitize(text) {
        if (!text) return text;
        
        // Remove HTML tags
        let clean = text.replace(/<[^>]*>/g, '');
        
        // Remove script attempts
        clean = clean.replace(/javascript:/gi, '');
        clean = clean.replace(/on\w+\s*=/gi, '');
        
        // Remove template literals
        clean = clean.replace(/\${.*?}/g, '');
        
        // Normalize whitespace
        clean = clean.replace(/\s+/g, ' ').trim();
        
        return clean;
    }
}

window.PromptSecurity = PromptSecurity;
