// Site-wide behaviour: header state, services dropdown, mobile menu, scroll reveals.
// Every feature degrades to plain links and visible content when this script does not run.

const header = document.querySelector<HTMLElement>('[data-header]');

function initHeader() {
  if (!header) return;
  const update = () => header.toggleAttribute('data-compact', window.scrollY > 64);
  update();
  window.addEventListener('scroll', update, { passive: true });
}

function initDropdowns() {
  document.querySelectorAll<HTMLElement>('[data-dropdown]').forEach((root) => {
    const trigger = root.querySelector<HTMLButtonElement>('[data-dropdown-trigger]');
    const panel = root.querySelector<HTMLElement>('[data-dropdown-panel]');
    if (!trigger || !panel) return;

    let hoverTimer: number | undefined;
    const setOpen = (open: boolean) => {
      trigger.setAttribute('aria-expanded', String(open));
      panel.hidden = !open;
    };
    const isOpen = () => trigger.getAttribute('aria-expanded') === 'true';

    trigger.addEventListener('click', () => setOpen(!isOpen()));

    // Hover opens only for real pointers, after a short intent delay.
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      root.addEventListener('mouseenter', () => {
        hoverTimer = window.setTimeout(() => setOpen(true), 120);
      });
      root.addEventListener('mouseleave', () => {
        window.clearTimeout(hoverTimer);
        setOpen(false);
      });
    }

    root.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && isOpen()) {
        setOpen(false);
        trigger.focus();
      }
    });
    root.addEventListener('focusout', (event) => {
      if (!root.contains(event.relatedTarget as Node | null)) setOpen(false);
    });
    document.addEventListener('click', (event) => {
      if (!root.contains(event.target as Node)) setOpen(false);
    });
  });
}

function initMobileMenu() {
  const dialog = document.querySelector<HTMLDialogElement>('[data-menu]');
  const openButton = document.querySelector<HTMLButtonElement>('[data-menu-open]');
  if (!dialog || !openButton) return;

  const close = () => dialog.close();
  openButton.addEventListener('click', () => {
    dialog.showModal();
    openButton.setAttribute('aria-expanded', 'true');
  });
  dialog.addEventListener('close', () => {
    openButton.setAttribute('aria-expanded', 'false');
    openButton.focus();
  });
  dialog.querySelector('[data-menu-close]')?.addEventListener('click', close);
  // Clicking the dimmed backdrop closes the menu.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });
  dialog.querySelectorAll('a').forEach((link) => link.addEventListener('click', close));
  // Close if the viewport grows to desktop while open.
  window.matchMedia('(min-width: 1024px)').addEventListener('change', (e) => e.matches && close());
}

function initReveal() {
  const items = document.querySelectorAll<HTMLElement>('[data-reveal]');
  if (!('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('is-visible'));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: '0px 0px -10% 0px', threshold: 0.1 },
  );
  items.forEach((el) => observer.observe(el));
}

initHeader();
initDropdowns();
initMobileMenu();
initReveal();
