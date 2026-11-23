import { ar } from './ar';
import { en, type Dictionary } from './en';
import type { Lang, Localized } from '../types';

export type { Dictionary };
export const LANG_COOKIE = 'hajzi_lang';
export const dictionaries: Record<Lang, Dictionary> = { en, ar };

export const getDictionary = (lang: Lang) => dictionaries[lang];
export const isLang = (v: unknown): v is Lang => v === 'en' || v === 'ar';
export const dirOf = (lang: Lang): 'rtl' | 'ltr' => (lang === 'ar' ? 'rtl' : 'ltr');

/** Replace {placeholders} in a translated string. */
export function fmt(str: string, vars: Record<string, string | number>) {
  return str.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

/** Pick the right language from a bilingual value (falls back to English). */
export const loc = (v: Localized, lang: Lang) => (lang === 'ar' ? v.ar || v.en : v.en || v.ar);

export function formatPrice(amount: number, lang: Lang) {
  const n = Number.isInteger(amount) ? amount.toString() : amount.toFixed(2);
  return lang === 'ar' ? `${n} ${ar.common.currency}` : `${n} ${en.common.currency}`;
}
