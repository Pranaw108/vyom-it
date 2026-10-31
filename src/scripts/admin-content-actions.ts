// Buttons with data-content-action post one content action (restore a version, trash, untrash) and reload.
const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-content-action]')) {
  button.addEventListener('click', async () => {
    const { contentAction, collection, key, versionId, confirmText, after } = button.dataset;
    if (confirmText && !window.confirm(confirmText)) return;
    const status = document.querySelector<HTMLElement>(button.dataset.status ?? '[data-action-status]');
    button.disabled = true;
    try {
      const response = await fetch('/api/admin/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        body: JSON.stringify({ action: contentAction, collection, key, ...(versionId ? { versionId: Number(versionId) } : {}) }),
      });
      if (response.ok) {
        window.location.assign(after ?? window.location.pathname);
        return;
      }
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (status) {
        status.textContent = data.error ?? 'That did not work. Please try again.';
        status.hidden = false;
      }
    } catch {
      if (status) {
        status.textContent = 'Could not reach the server. Check your connection and try again.';
        status.hidden = false;
      }
    }
    button.disabled = false;
  });
}
