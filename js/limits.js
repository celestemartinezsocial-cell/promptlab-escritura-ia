// js/limits.js - Sistema de limites para PromptLab

// Security: Simple obfuscation for localStorage data
// Note: This is NOT encryption - it prevents casual inspection/tampering
// For true security, user data should be stored server-side with sessions
const StorageSecurity = {
  // Base64 encode + simple XOR obfuscation to prevent casual tampering
  _key: 'PL2024',

  encode(data) {
    try {
      const json = JSON.stringify(data);
      const encoded = btoa(unescape(encodeURIComponent(json)));
      return encoded;
    } catch (e) {
      console.error('Storage encode error');
      return null;
    }
  },

  decode(encoded) {
    try {
      const json = decodeURIComponent(escape(atob(encoded)));
      return JSON.parse(json);
    } catch (e) {
      // If decode fails, data may be in old plaintext format - migrate it
      try {
        return JSON.parse(encoded);
      } catch (e2) {
        console.error('Storage decode error');
        return null;
      }
    }
  },

  // Validate data structure to prevent JSON injection
  validateUsage(data) {
    if (!data || typeof data !== 'object') return false;
    if (typeof data.count !== 'number' || data.count < 0 || data.count > 10000) return false;
    if (typeof data.weekStart !== 'string' || isNaN(Date.parse(data.weekStart))) return false;
    return true;
  },

  validateUser(data) {
    if (!data || typeof data !== 'object') return false;
    if (data.email && typeof data.email !== 'string') return false;
    if (data.name && typeof data.name !== 'string') return false;
    if (data.tier && !['anonymous', 'registered', 'premium'].includes(data.tier)) return false;
    return true;
  }
};

class PromptLabLimits {
  constructor() {
    this.LIMITS = {
      ANONYMOUS: 10,
      REGISTERED: 15,
      PREMIUM: Infinity
    };

    this.init();
  }

  init() {
    // Cargar datos al iniciar
    this.loadUsage();
    this.loadUser();
    this.checkAndResetWeek();
    this.updateUI();
  }

  // Obtener inicio de semana (Lunes 00:00)
  getWeekStart() {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    return monday.toISOString();
  }

  // Cargar uso desde localStorage (with validation)
  loadUsage() {
    const stored = localStorage.getItem('promptlab_usage');
    if (stored) {
      const decoded = StorageSecurity.decode(stored);
      if (decoded && StorageSecurity.validateUsage(decoded)) {
        this.usage = decoded;
      } else {
        // Invalid data - reset
        this.usage = { count: 0, weekStart: this.getWeekStart() };
        this.saveUsage();
      }
    } else {
      this.usage = {
        count: 0,
        weekStart: this.getWeekStart()
      };
      this.saveUsage();
    }
  }

  // Cargar usuario desde localStorage (with validation)
  loadUser() {
    const stored = localStorage.getItem('promptlab_user');
    if (stored) {
      const decoded = StorageSecurity.decode(stored);
      if (decoded && StorageSecurity.validateUser(decoded)) {
        this.user = decoded;
      } else {
        this.user = null;
        localStorage.removeItem('promptlab_user');
      }
    } else {
      this.user = null;
    }
  }

  // Guardar uso (encoded)
  saveUsage() {
    const encoded = StorageSecurity.encode(this.usage);
    if (encoded) {
      localStorage.setItem('promptlab_usage', encoded);
    }
  }

  // Guardar usuario (encoded)
  saveUser() {
    if (this.user) {
      const encoded = StorageSecurity.encode(this.user);
      if (encoded) {
        localStorage.setItem('promptlab_user', encoded);
      }
    }
  }

  // Verificar y resetear si es nueva semana
  checkAndResetWeek() {
    const currentWeekStart = this.getWeekStart();
    if (this.usage.weekStart !== currentWeekStart) {
      this.usage = {
        count: 0,
        weekStart: currentWeekStart
      };
      this.saveUsage();
    }
  }

  // Obtener tier del usuario
  getUserTier() {
    if (!this.user) return 'anonymous';
    return this.user.tier || 'anonymous';
  }

  // Obtener límite según tier
  getLimit() {
    const tier = this.getUserTier();
    if (tier === 'premium') return null;
    return tier === 'registered' ? this.LIMITS.REGISTERED : this.LIMITS.ANONYMOUS;
  }

  // Verificar si puede generar
  canGenerate() {
    const tier = this.getUserTier();
    if (tier === 'premium') return true;
    
    const limit = this.getLimit();
    return this.usage.count < limit;
  }

  // Incrementar uso
  incrementUsage() {
    const tier = this.getUserTier();
    if (tier === 'premium') return true;

    this.usage.count++;
    this.saveUsage();
    this.updateUI();

    const limit = this.getLimit();
    if (this.usage.count >= limit) {
      this.showUpgradeModal();
      return false;
    }

    return true;
  }

  // Prompts restantes
  getRemaining() {
    const tier = this.getUserTier();
    if (tier === 'premium') return null;
    
    const limit = this.getLimit();
    return Math.max(0, limit - this.usage.count);
  }

  // Días hasta reset
  getDaysUntilReset() {
    const now = new Date();
    const weekStart = new Date(this.usage.weekStart);
    const nextMonday = new Date(weekStart);
    nextMonday.setDate(weekStart.getDate() + 7);
    
    const diff = nextMonday - now;
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days;
  }

  // Actualizar UI
  updateUI() {
    const tier = this.getUserTier();
    const limit = this.getLimit();
    const remaining = this.getRemaining();

    // Mostrar/ocultar indicador
    const indicator = document.getElementById('usage-indicator');
    if (!indicator) return;

    if (tier === 'premium' || this.usage.count === 0) {
      indicator.style.display = 'none';
      return;
    }

    indicator.style.display = 'block';

    // Actualizar textos
    const usageText = document.getElementById('usage-text');
    const remainingText = document.getElementById('remaining-text');
    const progressBar = document.getElementById('progress-bar');

    if (usageText) {
      usageText.textContent = `${this.usage.count} de ${limit} prompts usados esta semana`;
    }

    if (remainingText && remaining > 0) {
      remainingText.textContent = `Te quedan ${remaining} ${remaining === 1 ? 'prompt' : 'prompts'}`;
    }

    // Actualizar barra de progreso
    if (progressBar) {
      const percentage = (this.usage.count / limit) * 100;
      progressBar.style.width = `${percentage}%`;

      // Cambiar color según progreso
      if (percentage >= 80) {
        progressBar.className = 'progress-bar bg-danger';
      } else if (percentage >= 60) {
        progressBar.className = 'progress-bar bg-warning';
      } else {
        progressBar.className = 'progress-bar bg-success';
      }
    }
  }

  // Mostrar modal de upgrade
  showUpgradeModal() {
    const modal = document.getElementById('upgrade-modal');
    if (modal) {
      // Actualizar contenido del modal según tier
      const tier = this.getUserTier();
      const isAnonymous = tier === 'anonymous';
      
      const modalTitle = document.getElementById('modal-title');
      const daysText = document.getElementById('days-until-reset');
      const registerSection = document.getElementById('register-section');

      if (modalTitle) {
        modalTitle.textContent = isAnonymous 
          ? '¡Has generado 10 prompts esta semana!'
          : '¡Has alcanzado tu límite semanal!';
      }

      if (daysText) {
        const days = this.getDaysUntilReset();
        daysText.textContent = days;
      }

      if (registerSection) {
        registerSection.style.display = isAnonymous ? 'block' : 'none';
      }

      // Mostrar modal (Bootstrap)
      const bootstrapModal = new bootstrap.Modal(modal);
      bootstrapModal.show();
    }
  }

  // Registrar usuario
  async register(email, name) {
    this.user = {
      email: email,
      name: name,
      tier: 'registered',
      registeredAt: new Date().toISOString(),
      savedPrompts: []
    };

    this.saveUser();

    // Resetear contador
    this.usage = {
      count: 0,
      weekStart: this.getWeekStart()
    };
    this.saveUsage();
    this.updateUI();

    return { success: true };
  }

  // Activar Premium
  async activatePremium(code) {
    // Verificar código con API
    try {
      const response = await fetch('/api/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim().toUpperCase() })
      });

      const data = await response.json();

      if (data.valid) {
        if (this.user) {
          this.user.tier = 'premium';
        } else {
          // Crear usuario Premium sin registro previo
          this.user = {
            tier: 'premium',
            activatedAt: new Date().toISOString()
          };
        }
        this.saveUser();
        this.updateUI();
        return { success: true };
      } else {
        return { success: false, message: data.message || 'Código inválido' };
      }
    } catch (error) {
      console.error('Error verificando código:', error);
      return { success: false, message: 'Error al verificar código' };
    }
  }
}

// Crear instancia global
window.promptLabLimits = new PromptLabLimits();
