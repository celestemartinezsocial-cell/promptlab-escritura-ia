// js/modals.js - Funciones para manejar modales

// Security: Input sanitization utilities
const InputSecurity = {
  // RFC 5322 compliant email regex
  EMAIL_REGEX: /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
  // Premium code format: PL- followed by alphanumeric
  CODE_REGEX: /^PL-[A-Z0-9]{2,20}$/i,
  MAX_NAME_LENGTH: 100,
  MAX_EMAIL_LENGTH: 254,
  MAX_CODE_LENGTH: 25,

  sanitizeText(str) {
    if (typeof str !== 'string') return '';
    return str.trim().slice(0, 500);
  },

  isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    if (email.length > this.MAX_EMAIL_LENGTH) return false;
    return this.EMAIL_REGEX.test(email);
  },

  isValidName(name) {
    if (!name || typeof name !== 'string') return false;
    const trimmed = name.trim();
    return trimmed.length >= 1 && trimmed.length <= this.MAX_NAME_LENGTH;
  },

  isValidCode(code) {
    if (!code || typeof code !== 'string') return false;
    if (code.length > this.MAX_CODE_LENGTH) return false;
    return this.CODE_REGEX.test(code.trim());
  }
};

// Abrir modal de registro
function openRegisterModal() {
  const modal = document.getElementById('register-modal');
  if (modal) {
    const bootstrapModal = new bootstrap.Modal(modal);
    bootstrapModal.show();
  }
}

// Manejar registro
async function handleRegister(event) {
  event.preventDefault();

  const email = InputSecurity.sanitizeText(document.getElementById('register-email').value);
  const name = InputSecurity.sanitizeText(document.getElementById('register-name').value);
  const errorDiv = document.getElementById('register-error');
  const submitBtn = document.getElementById('register-submit');

  // Validation
  if (!email || !name) {
    errorDiv.textContent = 'Por favor completa todos los campos';
    errorDiv.style.display = 'block';
    return;
  }

  if (!InputSecurity.isValidName(name)) {
    errorDiv.textContent = 'Nombre debe tener entre 1 y 100 caracteres';
    errorDiv.style.display = 'block';
    return;
  }

  if (!InputSecurity.isValidEmail(email)) {
    errorDiv.textContent = 'Por favor ingresa un email valido (ej: usuario@dominio.com)';
    errorDiv.style.display = 'block';
    return;
  }

  // Deshabilitar boton
  submitBtn.disabled = true;
  submitBtn.textContent = 'Registrando...';

  // Registrar
  const result = await window.promptLabLimits.register(email, name);

  if (result.success) {
    // Cerrar modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('register-modal'));
    modal.hide();

    // Mostrar mensaje de exito
    alert('Bienvenido! Ahora tienes 15 prompts por semana');

    // Limpiar form
    document.getElementById('register-form').reset();
  } else {
    errorDiv.textContent = result.message || 'Hubo un error';
    errorDiv.style.display = 'block';
  }

  // Rehabilitar boton
  submitBtn.disabled = false;
  submitBtn.textContent = 'Registrarme gratis';
}

// Abrir modal de activacion Premium
function openActivateModal() {
  const modal = document.getElementById('activate-modal');
  if (modal) {
    const bootstrapModal = new bootstrap.Modal(modal);
    bootstrapModal.show();
  }
}

// Manejar activacion Premium
async function handleActivatePremium(event) {
  event.preventDefault();

  const codeInput = InputSecurity.sanitizeText(document.getElementById('premium-code').value);
  const errorDiv = document.getElementById('activate-error');
  const successDiv = document.getElementById('activate-success');
  const submitBtn = document.getElementById('activate-submit');

  // Security: Validate code format before sending to server
  if (!InputSecurity.isValidCode(codeInput)) {
    errorDiv.textContent = 'Formato invalido. El codigo debe ser PL- seguido de caracteres alfanumericos (ej: PL-ABC12345)';
    errorDiv.style.display = 'block';
    return;
  }

  // Deshabilitar boton
  submitBtn.disabled = true;
  submitBtn.textContent = 'Verificando...';
  errorDiv.style.display = 'none';

  // Activar
  const result = await window.promptLabLimits.activatePremium(codeInput);

  if (result.success) {
    // Mostrar exito
    successDiv.style.display = 'block';
    document.getElementById('activate-form-content').style.display = 'none';

    // Recargar despues de 2 segundos
    setTimeout(() => {
      location.reload();
    }, 2000);
  } else {
    errorDiv.textContent = result.message;
    errorDiv.style.display = 'block';
    submitBtn.disabled = false;
    submitBtn.textContent = 'Activar Premium';
  }
}

// Ir a pagina de compra Premium
function goToPremiumPurchase() {
  window.open('https://tu-thinkific.com/premium', '_blank');
}
