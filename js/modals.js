// js/modals.js - Funciones para manejar modales

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
  
  const email = document.getElementById('register-email').value;
  const name = document.getElementById('register-name').value;
  const errorDiv = document.getElementById('register-error');
  const submitBtn = document.getElementById('register-submit');

  // Validación
  if (!email || !name) {
    errorDiv.textContent = 'Por favor completa todos los campos';
    errorDiv.style.display = 'block';
    return;
  }

  if (!email.includes('@')) {
    errorDiv.textContent = 'Por favor ingresa un email válido';
    errorDiv.style.display = 'block';
    return;
  }

  // Deshabilitar botón
  submitBtn.disabled = true;
  submitBtn.textContent = 'Registrando...';

  // Registrar
  const result = await window.promptLabLimits.register(email, name);

  if (result.success) {
    // Cerrar modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('register-modal'));
    modal.hide();

    // Mostrar mensaje de éxito
    alert('¡Bienvenido! Ahora tienes 15 prompts por semana 🎉');

    // Limpiar form
    document.getElementById('register-form').reset();
  } else {
    errorDiv.textContent = result.message || 'Hubo un error';
    errorDiv.style.display = 'block';
  }

  // Rehabilitar botón
  submitBtn.disabled = false;
  submitBtn.textContent = 'Registrarme gratis';
}

// Abrir modal de activación Premium
function openActivateModal() {
  const modal = document.getElementById('activate-modal');
  if (modal) {
    const bootstrapModal = new bootstrap.Modal(modal);
    bootstrapModal.show();
  }
}

// Manejar activación Premium
async function handleActivatePremium(event) {
  event.preventDefault();
  
  const code = document.getElementById('premium-code').value;
  const errorDiv = document.getElementById('activate-error');
  const successDiv = document.getElementById('activate-success');
  const submitBtn = document.getElementById('activate-submit');

  // Validación
  if (!code || code.length < 5) {
    errorDiv.textContent = 'Por favor ingresa un código válido';
    errorDiv.style.display = 'block';
    return;
  }

  // Deshabilitar botón
  submitBtn.disabled = true;
  submitBtn.textContent = 'Verificando...';
  errorDiv.style.display = 'none';

  // Activar
  const result = await window.promptLabLimits.activatePremium(code);

  if (result.success) {
    // Mostrar éxito
    successDiv.style.display = 'block';
    document.getElementById('activate-form-content').style.display = 'none';

    // Recargar después de 2 segundos
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

// Ir a página de compra Premium
function goToPremiumPurchase() {
  window.open('https://tu-thinkific.com/premium', '_blank');
}
