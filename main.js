function togglePrize(id) {
  document.getElementById(id).classList.toggle('open');
}

function toggle(id) {
  document.getElementById(id).classList.toggle('checked');
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
