export function showAlert(container, message, type = 'info', timeout = 5000) {
  if (!container) return;
  const alert = document.createElement('div');
  alert.className = `alert alert-${type}`;
  alert.textContent = message;
  container.innerHTML = '';
  container.appendChild(alert);
  if (timeout) setTimeout(() => alert.remove(), timeout);
}

export function toggleState(element, shouldShow) {
  if (!element) return;
  element.classList[shouldShow ? 'remove' : 'add']('hidden');
}

export function renderRows(target, data, template) {
  if (!target) return;
  target.innerHTML = data.map(template).join('');
}

export function formatDate(timestamp) {
  if (!timestamp) return '--';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
