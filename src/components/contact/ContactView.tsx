'use client';

import { useRef, useState } from 'react';
import { business, mapLink, telHref, whatsappHref } from '@/config/business';
import { loc } from '@/lib/i18n';
import { useLang } from '@/lib/i18n/LanguageProvider';
import { isValidPhone } from '@/lib/validation';
import { MapEmbed } from '../fields/MapEmbed';
import { FadeIn } from '../ui/FadeIn';
import { Honeypot, Turnstile, type TurnstileHandle } from '../ui/BotProtection';
import { FormField } from '../ui/FormField';
import { CheckIcon, ClockIcon, MailIcon, MapPinIcon, PhoneIcon, SpinnerIcon, WhatsAppIcon } from '../ui/icons';
import { CenterCircle } from '../ui/PitchDecor';

export function ContactView() {
  const { t, lang } = useLang();

  const cards = [
    { Icon: PhoneIcon, title: t.contact.phone, value: business.phone, href: telHref(business.phone), ltr: true },
    { Icon: WhatsAppIcon, title: t.contact.whatsapp, value: t.contact.whatsappCta, href: whatsappHref(business.whatsapp), external: true },
    { Icon: MailIcon, title: t.contact.email, value: business.email, href: `mailto:${business.email}`, ltr: true },
    { Icon: ClockIcon, title: t.contact.hours, value: loc(business.hours.label, lang) },
  ];

  return (
    <>
      <section className="relative overflow-hidden border-b-2 border-white/60 bg-pitch-dark">
        <CenterCircle className="pointer-events-none absolute -end-24 -top-28 h-96 w-96 text-white/10" />
        <div className="relative mx-auto max-w-6xl px-4 py-12 sm:py-16">
          <h1 className="heading text-5xl sm:text-7xl">{t.contact.title}</h1>
          <p className="mt-3 max-w-xl text-white/85 sm:text-lg">{t.contact.subtitle}</p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-10">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map(({ Icon, title, value, href, ltr, external }, i) => {
            const inner = (
              <>
                <span className="grid h-12 w-12 place-items-center rounded-full bg-pitch text-card">
                  <Icon width={22} height={22} />
                </span>
                <span className="mt-4 block text-sm font-semibold uppercase tracking-wide text-ink/65">{title}</span>
                <span dir={ltr ? 'ltr' : undefined} className="mt-1 block break-words text-lg font-bold">
                  {value}
                </span>
              </>
            );
            return (
              <li key={title}>
                <FadeIn delay={i * 0.06} className="h-full">
                  {href ? (
                    <a
                      href={href}
                      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                      className="panel block h-full p-5 transition hover:-translate-y-1 hover:shadow-2xl motion-reduce:hover:translate-y-0"
                    >
                      {inner}
                    </a>
                  ) : (
                    <div className="panel h-full p-5">{inner}</div>
                  )}
                </FadeIn>
              </li>
            );
          })}
        </ul>

        <div className="mt-10 grid gap-8 lg:grid-cols-2">
          <section aria-labelledby="loc-title" className="space-y-4">
            <h2 id="loc-title" className="heading text-3xl">
              {t.contact.location}
            </h2>
            <p className="flex items-start gap-2 text-white/90">
              <MapPinIcon className="mt-0.5 shrink-0 text-card" />
              {loc(business.address, lang)}
            </p>
            <MapEmbed lat={business.coordinates.lat} lng={business.coordinates.lng} title={`${t.contact.location} — HAJZI`} />
            <a href={mapLink(business.coordinates.lat, business.coordinates.lng)} target="_blank" rel="noopener noreferrer" className="btn-outline">
              <MapPinIcon width={18} height={18} />
              {t.field.directions}
            </a>
          </section>
          <ContactForm />
        </div>
      </div>
    </>
  );
}

function ContactForm() {
  const { t } = useLang();
  const [v, setV] = useState({ name: '', contact: '', message: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof v, string>>>({});
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const captchaRef = useRef<TurnstileHandle>(null);

  const validate = (x = v) => {
    const e: typeof errors = {};
    if (!x.name.trim()) e.name = t.contact.errors.name;
    const c = x.contact.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c) && !isValidPhone(c)) e.contact = t.contact.errors.contact;
    if (x.message.trim().length < 10) e.message = t.contact.errors.message;
    return e;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      document.getElementById(`c-${Object.keys(e)[0]}`)?.focus();
      return;
    }
    setState('sending');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...v, website: honeypot || undefined, turnstileToken: captchaToken || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(
          data.code === 'CAPTCHA' ? t.contact.errors.captcha : res.status === 429 ? t.contact.errors.rateLimited : t.contact.errors.generic,
        );
        captchaRef.current?.reset();
        setState('error');
        return;
      }
      setState('sent');
      setV({ name: '', contact: '', message: '' });
    } catch {
      setErrorMsg(t.contact.errors.generic);
      setState('error');
    }
  };

  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const next = { ...v, [k]: e.target.value };
    setV(next);
    if (errors[k]) setErrors(validate(next));
  };

  return (
    <section aria-labelledby="form-title" className="panel p-5 sm:p-7">
      <h2 id="form-title" className="text-2xl font-bold">
        {t.contact.formTitle}
      </h2>
      {state === 'sent' ? (
        <div role="status" className="mt-6 flex items-start gap-3 rounded-xl bg-pitch/10 p-4 font-semibold text-pitch-dark">
          <CheckIcon className="mt-0.5 shrink-0" />
          {t.contact.sent}
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="mt-5 space-y-4">
          <FormField id="c-name" label={t.contact.name} error={errors.name}>
            <input className="input" autoComplete="name" value={v.name} onChange={set('name')} />
          </FormField>
          <FormField id="c-contact" label={t.contact.contact} error={errors.contact}>
            <input className="input" autoComplete="email" dir="ltr" value={v.contact} onChange={set('contact')} />
          </FormField>
          <FormField id="c-message" label={t.contact.message} error={errors.message}>
            <textarea className="input min-h-[140px] resize-y" rows={5} maxLength={2000} value={v.message} onChange={set('message')} />
          </FormField>
          <Honeypot value={honeypot} onChange={setHoneypot} />
          <Turnstile ref={captchaRef} onToken={setCaptchaToken} />
          {state === 'error' && (
            <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">
              {errorMsg || t.contact.errors.generic}
            </p>
          )}
          <button type="submit" disabled={state === 'sending'} className="btn-primary w-full sm:w-auto">
            {state === 'sending' ? (
              <>
                <SpinnerIcon width={18} height={18} /> {t.contact.sending}
              </>
            ) : (
              t.contact.send
            )}
          </button>
        </form>
      )}
    </section>
  );
}
