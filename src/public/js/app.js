// TechPulse AI Public Interactions

let targetEmail = '';
let countdownInterval = null;
let remainingSeconds = 15 * 60;

const subscribeForm = document.getElementById('subscribe-form');
const emailInput = document.getElementById('email-input');
const submitBtn = document.getElementById('submit-btn');
const btnText = document.getElementById('btn-text');
const btnSpinner = document.getElementById('btn-spinner');
const formAlert = document.getElementById('form-alert');

const codeModal = document.getElementById('code-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const targetEmailDisplay = document.getElementById('target-email-display');
const verifyCodeForm = document.getElementById('verify-code-form');
const codeInput = document.getElementById('code-input');
const verifySubmitBtn = document.getElementById('verify-submit-btn');
const modalAlert = document.getElementById('modal-alert');
const countdownTimer = document.getElementById('countdown-timer');
const resendCodeBtn = document.getElementById('resend-code-btn');

function showAlert(elem, text, isSuccess = false) {
  elem.classList.remove('hidden');
  if (isSuccess) {
    elem.className = 'mt-3 text-sm px-4 py-2.5 rounded-lg text-left bg-emerald-950/80 text-emerald-300 border border-emerald-800/80';
  } else {
    elem.className = 'mt-3 text-sm px-4 py-2.5 rounded-lg text-left bg-rose-950/80 text-rose-300 border border-rose-800/80';
  }
  elem.innerText = text;
}

function startCountdown() {
  clearInterval(countdownInterval);
  remainingSeconds = 15 * 60;
  updateTimerDisplay();

  countdownInterval = setInterval(() => {
    remainingSeconds--;
    if (remainingSeconds <= 0) {
      clearInterval(countdownInterval);
      countdownTimer.innerText = 'Expiré';
      showAlert(modalAlert, 'Le code a expiré. Veuillez cliquer sur "Renvoyer le code".', false);
    } else {
      updateTimerDisplay();
    }
  }, 1000);
}

function updateTimerDisplay() {
  const m = Math.floor(remainingSeconds / 60);
  const s = remainingSeconds % 60;
  countdownTimer.innerText = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Request code submission
subscribeForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  targetEmail = emailInput.value.trim();
  formAlert.classList.add('hidden');

  btnText.innerText = 'Envoi du code...';
  btnSpinner.classList.remove('hidden');
  submitBtn.disabled = true;

  try {
    const res = await fetch('/api/subscribe/request-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: targetEmail })
    });

    const data = await res.json();

    if (data.alreadyActive) {
      showAlert(formAlert, data.message, true);
      return;
    }

    if (data.success) {
      // Open modal
      targetEmailDisplay.innerText = targetEmail;
      codeModal.classList.remove('hidden');
      codeInput.value = '';
      codeInput.focus();
      modalAlert.classList.add('hidden');
      startCountdown();
    } else {
      showAlert(formAlert, data.error || 'Erreur lors de la demande.', false);
    }
  } catch (err) {
    showAlert(formAlert, 'Impossible de joindre le serveur. Vérifiez votre connexion.', false);
  } finally {
    btnText.innerText = "S'abonner gratuitement";
    btnSpinner.classList.add('hidden');
    submitBtn.disabled = false;
  }
});

// Verify 6-digit code
verifyCodeForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const code = codeInput.value.trim();
  modalAlert.classList.add('hidden');

  verifySubmitBtn.disabled = true;
  verifySubmitBtn.innerText = 'Vérification...';

  try {
    const res = await fetch('/api/subscribe/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: targetEmail, code })
    });

    const data = await res.json();

    if (data.success) {
      showAlert(modalAlert, data.message, true);
      clearInterval(countdownInterval);
      setTimeout(() => {
        codeModal.classList.add('hidden');
        showAlert(formAlert, `Félicitations ! Votre abonnement avec ${targetEmail} est actif. Vous recevrez nos deux éditions à 6h15 et 16h30.`, true);
        emailInput.value = '';
      }, 1500);
    } else {
      showAlert(modalAlert, data.error || 'Code invalide.', false);
    }
  } catch (err) {
    showAlert(modalAlert, 'Erreur de communication avec le serveur.', false);
  } finally {
    verifySubmitBtn.disabled = false;
    verifySubmitBtn.innerText = 'Valider mon abonnement';
  }
});

// Resend Code
resendCodeBtn.addEventListener('click', async () => {
  resendCodeBtn.disabled = true;
  resendCodeBtn.innerText = 'Envoi...';

  try {
    const res = await fetch('/api/subscribe/request-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: targetEmail })
    });
    const data = await res.json();
    if (data.success) {
      showAlert(modalAlert, 'Un nouveau code vous a été envoyé.', true);
      startCountdown();
    } else {
      showAlert(modalAlert, data.error || 'Erreur lors du renvoi.', false);
    }
  } catch (err) {
    showAlert(modalAlert, 'Erreur lors du renvoi.', false);
  } finally {
    resendCodeBtn.disabled = false;
    resendCodeBtn.innerText = 'Renvoyer le code';
  }
});

// Close Modal
closeModalBtn.addEventListener('click', () => {
  codeModal.classList.add('hidden');
  clearInterval(countdownInterval);
});

codeModal.addEventListener('click', (e) => {
  if (e.target === codeModal) {
    codeModal.classList.add('hidden');
    clearInterval(countdownInterval);
  }
});
