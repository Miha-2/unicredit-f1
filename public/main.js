function togglePrize(id) {
  document.getElementById(id).classList.toggle('open');
}

function toggle(id) {
  document.getElementById(id).classList.toggle('checked');
  clearError(id === 'cb1' ? 'error-cb1' : 'error-cb2');
}

function toggleReward() {
  document.getElementById('cb2').classList.toggle('checked');
}

function scrollToPrizes() {
  document.getElementById('prizes-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function scrollToForm() {
  document.getElementById('mainForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function clearError(errorId) {
  var el = document.getElementById(errorId);
  if (el) el.style.display = 'none';
}

function showError(errorId, message) {
  var el = document.getElementById(errorId);
  if (el) { el.textContent = message; el.style.display = 'block'; }
}

function showSuccess() {
  document.getElementById('mainForm').style.display = 'none';
  document.querySelector('.submit-wrap').style.display = 'none';
  var s = document.getElementById('success-msg');
  s.style.display = 'flex';
  s.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function validateForm() {
  var ime = document.getElementById('field-ime').value.trim();
  var priimek = document.getElementById('field-priimek').value.trim();
  var email = document.getElementById('field-email').value.trim();
  var cb1 = document.getElementById('cb1').classList.contains('checked');
  var cb2 = document.getElementById('cb2').classList.contains('checked');
  var valid = true;

  ['error-ime', 'error-priimek', 'error-email', 'error-cb1'].forEach(clearError);

  if (!ime) { showError('error-ime', 'Vnesite svoje ime.'); valid = false; }
  if (!priimek) { showError('error-priimek', 'Vnesite svoj priimek.'); valid = false; }

  var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email) { showError('error-email', 'Vnesite e-poštni naslov.'); valid = false; }
  else if (!emailRegex.test(email)) { showError('error-email', 'E-poštni naslov ni veljaven.'); valid = false; }

  if (!cb1) { showError('error-cb1', 'Strinjanje s pravili je obvezno.'); valid = false; }

  if (!valid) {
    var first = document.querySelector('.field-error[style*="block"]');
    if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  var btn = document.querySelector('.submit-btn');
  btn.disabled = true;
  btn.style.opacity = '0.6';

  try {
    var res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ime, priimek, email, consent_rules: cb1, consent_marketing: cb2 })
    });
    var data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Napaka pri pošiljanju.');
    showSuccess();
  } catch (err) {
    showError('error-cb1', err.message);
    btn.disabled = false;
    btn.style.opacity = '1';
  }
}

document.addEventListener('DOMContentLoaded', function () {
  document.querySelector('.submit-btn').addEventListener('click', validateForm);
  document.getElementById('mainForm').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); validateForm(); }
  });
  ['field-ime', 'field-priimek', 'field-email'].forEach(function (id) {
    document.getElementById(id).addEventListener('input', function () {
      clearError('error-' + id.replace('field-', ''));
    });
  });
});
