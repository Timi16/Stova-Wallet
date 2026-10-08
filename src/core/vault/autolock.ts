import { getSession, isUnlocked, lock, subscribe } from './session';

/**
 * Wipes the in-memory key after N minutes idle, after N minutes with the tab
 * hidden, and immediately on "Lock now" (which calls `lock()` directly).
 * Lock is broadcast to every tab by the session.
 */

let idleTimer: ReturnType<typeof setTimeout> | null = null;
let hiddenTimer: ReturnType<typeof setTimeout> | null = null;
let lastActivity = Date.now();

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'touchstart', 'wheel'];

function minutes(): number {
  return getSession().vault?.settings.autoLockMinutes ?? 5;
}

function armIdle() {
  if (idleTimer) clearTimeout(idleTimer);
  if (!isUnlocked()) return;
  idleTimer = setTimeout(() => {
    if (Date.now() - lastActivity >= minutes() * 60_000 - 50) lock();
    else armIdle();
  }, minutes() * 60_000);
}

function onActivity() {
  lastActivity = Date.now();
  if (idleTimer === null && isUnlocked()) armIdle();
}

function onVisibility() {
  if (document.visibilityState === 'hidden') {
    if (hiddenTimer) clearTimeout(hiddenTimer);
    hiddenTimer = setTimeout(() => {
      if (document.visibilityState === 'hidden') lock();
    }, minutes() * 60_000);
  } else {
    if (hiddenTimer) clearTimeout(hiddenTimer);
    hiddenTimer = null;
    onActivity();
  }
}

let installed = false;

export function installAutoLock(): () => void {
  if (installed || typeof window === 'undefined') return () => {};
  installed = true;
  for (const ev of ACTIVITY_EVENTS) window.addEventListener(ev, onActivity, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);
  const unsub = subscribe(() => {
    if (isUnlocked()) {
      lastActivity = Date.now();
      armIdle();
    } else if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  });
  return () => {
    installed = false;
    for (const ev of ACTIVITY_EVENTS) window.removeEventListener(ev, onActivity);
    document.removeEventListener('visibilitychange', onVisibility);
    unsub();
    if (idleTimer) clearTimeout(idleTimer);
    if (hiddenTimer) clearTimeout(hiddenTimer);
  };
}

/** Seconds until auto-lock fires if nothing else happens. Used by the Receive sheet's "auto in 4:32". */
export function secondsUntilAutoLock(): number {
  if (!isUnlocked()) return 0;
  return Math.max(0, Math.round((lastActivity + minutes() * 60_000 - Date.now()) / 1000));
}
