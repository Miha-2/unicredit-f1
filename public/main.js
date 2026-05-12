function toggle(id) {
  document.getElementById(id).classList.toggle('checked');
  clearError('error-' + id);
}

function toggleReward() {
  document.getElementById('cb2').classList.toggle('checked');
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

function showUpgraded() {
  document.getElementById('mainForm').style.display = 'none';
  document.querySelector('.submit-wrap').style.display = 'none';
  var s = document.getElementById('upgraded-msg');
  s.style.display = 'flex';
  s.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function showDupModal(scenario) {
  var modal = document.getElementById('dup-modal');
  var title = document.getElementById('dup-title');
  var desc = document.getElementById('dup-desc');
  var actions = document.getElementById('dup-actions');
  var icon = document.getElementById('dup-icon');

  icon.textContent = '✓';
  title.textContent = 'Že sodeluješ!';
  desc.textContent = 'Ta e-poštni naslov je že prijavljen in se poteguješ za nagrado na F1 simulatorju. Vse je že urejeno!';
  actions.innerHTML = '<button onclick="closeDupModal()" style="flex:1;height:52px;background:var(--red);border:none;color:#fff;font-family:\'Barlow Condensed\',sans-serif;font-weight:900;font-style:italic;font-size:18px;letter-spacing:0.1em;text-transform:uppercase;cursor:pointer;">V redu</button>';

  modal.style.display = 'flex';
}

function closeDupModal() {
  document.getElementById('dup-modal').style.display = 'none';
}

async function validateForm() {
  var ime = document.getElementById('field-ime').value.trim();
  var priimek = document.getElementById('field-priimek').value.trim();
  var email = document.getElementById("field-email").value.trim();
  var telefon = document.getElementById("field-telefon").value.trim();
  var cb1 = document.getElementById('cb1').classList.contains('checked');
  var cbAge = document.getElementById('cb-age').classList.contains('checked');
  var cb2 = document.getElementById('cb2').classList.contains('checked');
  var valid = true;

  ['error-ime', 'error-priimek', 'error-email', 'error-telefon', 'error-cb1', 'error-cb-age'].forEach(clearError);

  if (!ime) { showError('error-ime', 'Vnesite svoje ime.'); valid = false; }
  if (!priimek) { showError('error-priimek', 'Vnesite svoj priimek.'); valid = false; }

  var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email) { showError('error-email', 'Vnesite e-poštni naslov.'); valid = false; }
  else if (!emailRegex.test(email)) { showError('error-email', 'E-poštni naslov ni veljaven.'); valid = false; }

  var telefonRegex = /^\+?[\d\s\-()]{7,20}$/;
  if (!telefon) { showError('error-telefon', 'Vnesite telefonsko številko.'); valid = false; }
  else if (!telefonRegex.test(telefon)) { showError('error-telefon', 'Telefonska številka ni veljavna.'); valid = false; }

  if (!cb1) { showError('error-cb1', 'Strinjanje s pravili je obvezno.'); valid = false; }
  if (!cbAge) { showError('error-cb-age', 'Potrditev starosti je obvezna.'); valid = false; }

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
      body: JSON.stringify({ ime, priimek, email, telefon, consent_rules: cb1, consent_age: cbAge, consent_marketing: cb2 })
    });
    var data = await res.json();
    if (res.status === 409 && data.duplicate) {
      btn.disabled = false;
      btn.style.opacity = '1';
      if (data.scenario === 'has_consent') {
        showDupModal();
      } else {
        showError('error-email', 'Ta e-poštni naslov je že prijavljen.');
      }
      return;
    }
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
  ['field-ime', 'field-priimek', 'field-email', 'field-telefon'].forEach(function (id) {
    document.getElementById(id).addEventListener('input', function () {
      clearError('error-' + id.replace('field-', ''));
    });
  });
});
