import { writable, derived, get } from 'svelte/store';
import en from './en.json';
import hr from './hr.json';

export type Locale = 'en' | 'hr';
const dictionaries: Record<Locale, any> = { en, hr };

function getInitialLocale(): Locale {
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem('locale') as Locale | null;
    if (stored && dictionaries[stored]) return stored;
  }
  if (typeof navigator !== 'undefined' && navigator.language.startsWith('hr')) return 'hr';
  return 'en';
}

export const locale = writable<Locale>(getInitialLocale());
locale.subscribe((val) => {
  if (typeof localStorage !== 'undefined') localStorage.setItem('locale', val);
});

export const t = derived(locale, ($locale) => dictionaries[$locale]);

export function translate(path: string): string {
  const dict = dictionaries[get(locale)];
  return path.split('.').reduce((obj: any, key) => (obj ? obj[key] : undefined), dict) ?? path;
}
