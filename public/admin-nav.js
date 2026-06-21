import { getCurrentIdToken } from './firebase-client.js';
import { lbdApiBase } from './lbd-credits.js';

/** Admin nav only appears on session surfaces (LbD header, in-call header) — never the welcome screen. */
export async function syncAdminNav(containerSelector = '.lbd-auth-actions, .call-header-actions') {
  document.querySelectorAll('[data-admin-link]').forEach((el) => el.remove());

  const containers = document.querySelectorAll(containerSelector);
  if (!containers.length) return;

  try {
    const token = await getCurrentIdToken();
    if (!token) return;
    const res = await fetch(`${lbdApiBase()}/api/admin/check`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const { admin } = await res.json();
    if (!admin) return;

    for (const container of containers) {
      const anchor = document.createElement('a');
      anchor.className = container.classList.contains('call-header-actions')
        ? 'call-admin-link'
        : 'lbd-mini-btn lbd-nav-link';
      anchor.href = '/admin';
      anchor.dataset.adminLink = '1';
      anchor.textContent = 'Admin';
      const account = container.querySelector('#call-account-menu, #account-menu, .lbd-account');
      if (account) container.insertBefore(anchor, account);
      else container.appendChild(anchor);
    }
  } catch {
    /* not admin or offline */
  }
}

/** @deprecated use syncAdminNav */
export const maybeShowAdminLink = syncAdminNav;