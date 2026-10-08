import { SECURITY } from '@/config';

export interface PasswordStrength {
  /** 0 empty · 1 too short · 2 weak · 3 good · 4 strong */
  score: 0 | 1 | 2 | 3 | 4;
  longEnough: boolean;
  mixed: boolean;
  notPhrase: boolean;
  hint: string;
}

export function passwordStrength(pw: string, phraseWords: string[] = []): PasswordStrength {
  const len = pw.length;
  const longEnough = len >= SECURITY.minPasswordLength;
  const mixed = /[0-9]/.test(pw) && /[A-Za-z]/.test(pw);
  const lower = pw.toLowerCase();
  const notPhrase = len === 0 || !phraseWords.some((w) => w.length >= 4 && lower.includes(w));
  let score: PasswordStrength['score'] = 0;
  if (len === 0) score = 0;
  else if (!longEnough) score = 1;
  else if (!mixed || !notPhrase) score = 2;
  else if (len >= 14 && /[^A-Za-z0-9]/.test(pw)) score = 4;
  else score = 3;
  const hints = ["Pick something you don't use anywhere else", 'Too short', notPhrase ? 'Add numbers to make it stronger' : "Don't reuse your recovery words", 'Good password', 'Strong password'];
  return { score, longEnough, mixed, notPhrase, hint: hints[score] };
}

export function strengthColor(score: number): string {
  return score <= 1 ? 'var(--color-bad)' : score === 2 ? 'var(--color-warn)' : 'var(--color-good)';
}
