import { SECURITY } from '@/config';

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

let clearTimer: ReturnType<typeof setTimeout> | null = null;

/** Copies a secret and overwrites the clipboard 60 s later (best effort). Never called automatically. */
export async function copySecret(text: string): Promise<boolean> {
  const ok = await copyText(text);
  if (ok) {
    if (clearTimer) clearTimeout(clearTimer);
    clearTimer = setTimeout(() => {
      void navigator.clipboard.writeText(' ').catch(() => {});
    }, SECURITY.clipboardClearSeconds * 1000);
  }
  return ok;
}

export async function readClipboard(): Promise<string | null> {
  try {
    return await navigator.clipboard.readText();
  } catch {
    return null;
  }
}
