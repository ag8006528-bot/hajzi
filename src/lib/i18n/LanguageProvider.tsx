'use client';

import { createContext, useCallback, useContext, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { dirOf, getDictionary, LANG_COOKIE, type Dictionary } from './index';
import type { Lang } from '../types';

interface LangCtx {
  lang: Lang;
  t: Dictionary;
  dir: 'ltr' | 'rtl';
  setLang: (l: Lang) => void;
  pending: boolean;
}

const Ctx = createContext<LangCtx | null>(null);

export function LanguageProvider({ initialLang, children }: { initialLang: Lang; children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const setLang = useCallback(
    (l: Lang) => {
      document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
      document.documentElement.lang = l;
      document.documentElement.dir = dirOf(l);
      setLangState(l);
      // Re-render server components (metadata, server-rendered text) in the new language.
      startTransition(() => router.refresh());
    },
    [router],
  );

  const value = useMemo(
    () => ({ lang, t: getDictionary(lang), dir: dirOf(lang), setLang, pending }),
    [lang, setLang, pending],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLang() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useLang must be used inside <LanguageProvider>');
  return ctx;
}
