import 'server-only';
import { cookies } from 'next/headers';
import { getDictionary, isLang, LANG_COOKIE } from './index';
import type { Lang } from '../types';

export async function getLang(): Promise<Lang> {
  const v = (await cookies()).get(LANG_COOKIE)?.value;
  return isLang(v) ? v : 'en';
}

export async function getServerT() {
  const lang = await getLang();
  return { lang, t: getDictionary(lang) };
}
