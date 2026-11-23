'use client';

import { useEffect, useRef, useState } from 'react';
import { business } from '@/config/business';
import { useLang } from '@/lib/i18n/LanguageProvider';
import { AMENITIES, type Field, type FieldInput, type Localized } from '@/lib/types';
import { CloseIcon, SpinnerIcon } from '../ui/icons';

export function FieldForm({
  id,
  initial,
  onClose,
  onSaved,
}: {
  id: string | null;
  initial: FieldInput;
  onClose: () => void;
  onSaved: (f: Field) => void;
}) {
  const { t } = useLang();
  const f = t.admin.form;
  const [v, setV] = useState<FieldInput>(initial);
  const [images, setImages] = useState(initial.images.join('\n'));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [uploading, setUploading] = useState(false);

  /** Upload → server validates type by content, size (5 MB), strips EXIF and returns a random-named URL. */
  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return setError('File too large (max 5 MB)');
    setUploading(true);
    setError('');
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/uploads', { method: 'POST', body: fd }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (res?.ok && data.url) setImages((s) => [s.trim(), data.url].filter(Boolean).join('\n'));
    else setError(data?.error || t.admin.error);
    setUploading(false);
  };

  // Open as a modal (focus trap + Esc to close). No close() in cleanup: it would fire
  // onClose during React Strict Mode's effect re-run; unmounting removes the dialog anyway.
  useEffect(() => {
    const d = dialogRef.current;
    if (d && !d.open) d.showModal();
  }, []);

  const set = <K extends keyof FieldInput>(k: K, val: FieldInput[K]) => setV((p) => ({ ...p, [k]: val }));
  const setLoc = (k: 'name' | 'area' | 'address' | 'description', l: keyof Localized, val: string) =>
    setV((p) => ({ ...p, [k]: { ...p[k], [l]: val } }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const body: FieldInput = { ...v, images: images.split('\n').map((s) => s.trim()).filter(Boolean) };
    const res = await fetch(id ? `/api/fields/${id}` : '/api/fields', {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    if (res?.ok) onSaved(data.field);
    else setError(data?.error || t.admin.error);
    setSaving(false);
  };

  const text = (label: string, value: string, onChange: (s: string) => void, opts: { dir?: 'rtl' | 'ltr'; required?: boolean; id: string }) => (
    <div>
      <label htmlFor={opts.id} className="label">
        {label}
      </label>
      <input id={opts.id} className="input" dir={opts.dir} required={opts.required} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onCancel={onClose}
      aria-labelledby="field-form-title"
      className="m-auto w-[min(760px,calc(100vw-24px))] rounded-2xl bg-white p-0 text-ink shadow-2xl backdrop:bg-black/60"
    >
      <form onSubmit={submit}>
        <div className="sticky top-0 z-10 flex items-center justify-between bg-pitch-dark px-5 py-4 text-white">
          <h2 id="field-form-title" className="text-xl font-bold">
            {id ? t.admin.editField : t.admin.newField}
          </h2>
          <button type="button" onClick={onClose} aria-label={t.admin.close} className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/10">
            <CloseIcon />
          </button>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          {text(f.nameEn, v.name.en, (s) => setLoc('name', 'en', s), { id: 'ff-name-en', required: true, dir: 'ltr' })}
          {text(f.nameAr, v.name.ar, (s) => setLoc('name', 'ar', s), { id: 'ff-name-ar', required: true, dir: 'rtl' })}
          <div>
            <label htmlFor="ff-type" className="label">
              {f.type}
            </label>
            <select
              id="ff-type"
              className="input"
              value={v.type}
              onChange={(e) => {
                const type = e.target.value as FieldInput['type'];
                setV((p) => ({
                  ...p,
                  type,
                  // Switch to the default price for that type if the price was still a default.
                  pricePerHour: Object.values(business.prices).includes(p.pricePerHour as never) ? business.prices[type] : p.pricePerHour,
                }));
              }}
            >
              <option value="5v5">5v5</option>
              <option value="11v11">11v11</option>
            </select>
          </div>
          <div>
            <label htmlFor="ff-price" className="label">
              {f.price}
            </label>
            <input
              id="ff-price"
              className="input"
              type="number"
              min={v.onlineBooking === false ? 0 : 1}
              step="0.5"
              required
              value={v.pricePerHour}
              onChange={(e) => set('pricePerHour', Number(e.target.value))}
            />
          </div>
          {text(f.areaEn, v.area.en, (s) => setLoc('area', 'en', s), { id: 'ff-area-en', required: true, dir: 'ltr' })}
          {text(f.areaAr, v.area.ar, (s) => setLoc('area', 'ar', s), { id: 'ff-area-ar', dir: 'rtl' })}
          {text(f.addressEn, v.address.en, (s) => setLoc('address', 'en', s), { id: 'ff-addr-en', dir: 'ltr' })}
          {text(f.addressAr, v.address.ar, (s) => setLoc('address', 'ar', s), { id: 'ff-addr-ar', dir: 'rtl' })}
          <div>
            <label htmlFor="ff-lat" className="label">
              {f.lat}
            </label>
            <input
              id="ff-lat"
              className="input"
              type="number"
              step="any"
              value={v.coordinates.lat}
              onChange={(e) => set('coordinates', { ...v.coordinates, lat: Number(e.target.value) })}
            />
          </div>
          <div>
            <label htmlFor="ff-lng" className="label">
              {f.lng}
            </label>
            <input
              id="ff-lng"
              className="input"
              type="number"
              step="any"
              value={v.coordinates.lng}
              onChange={(e) => set('coordinates', { ...v.coordinates, lng: Number(e.target.value) })}
            />
          </div>
          {text(f.phone, v.phone, (s) => set('phone', s), { id: 'ff-phone', required: true, dir: 'ltr' })}
          {text(f.whatsapp, v.whatsapp, (s) => set('whatsapp', s), { id: 'ff-wa', dir: 'ltr' })}
          {text(f.size, v.size, (s) => set('size', s), { id: 'ff-size', dir: 'ltr' })}
          {text(f.mapsQuery, v.mapsQuery ?? '', (s) => set('mapsQuery', s), { id: 'ff-maps' })}
          <div>
            <label htmlFor="ff-surface" className="label">
              {f.surface}
            </label>
            <select id="ff-surface" className="input" value={v.surface} onChange={(e) => set('surface', e.target.value as FieldInput['surface'])}>
              <option value="artificial">{t.field.artificial}</option>
              <option value="natural">{t.field.natural}</option>
              <option value="unknown">{t.field.unknown}</option>
            </select>
          </div>

          <fieldset className="sm:col-span-2">
            <legend className="label">{f.amenities}</legend>
            <div className="flex flex-wrap gap-2">
              {AMENITIES.map((a) => (
                <label key={a} className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-ink/15 px-3 py-2 text-sm font-semibold has-[:checked]:border-pitch has-[:checked]:bg-pitch/10">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-pitch"
                    checked={v.amenities.includes(a)}
                    onChange={(e) => set('amenities', e.target.checked ? [...v.amenities, a] : v.amenities.filter((x) => x !== a))}
                  />
                  {t.field.amenity[a]}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-wrap gap-5 sm:col-span-2">
            <label className="inline-flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" className="h-4 w-4 accent-pitch" checked={v.lighting} onChange={(e) => set('lighting', e.target.checked)} />
              {f.lighting}
            </label>
            <label className="inline-flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" className="h-4 w-4 accent-pitch" checked={v.featured} onChange={(e) => set('featured', e.target.checked)} />
              {f.featured}
            </label>
            <label className="inline-flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                className="h-4 w-4 accent-pitch"
                checked={v.onlineBooking !== false}
                onChange={(e) => set('onlineBooking', e.target.checked)}
              />
              {f.onlineBooking}
            </label>
            <label className="inline-flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                className="h-4 w-4 accent-pitch"
                checked={Boolean(v.priceEstimated)}
                onChange={(e) => set('priceEstimated', e.target.checked)}
              />
              {f.priceEstimated}
            </label>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="ff-desc-en" className="label">
              {f.descEn}
            </label>
            <textarea id="ff-desc-en" dir="ltr" className="input" rows={2} value={v.description.en} onChange={(e) => setLoc('description', 'en', e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="ff-desc-ar" className="label">
              {f.descAr}
            </label>
            <textarea id="ff-desc-ar" dir="rtl" className="input" rows={2} value={v.description.ar} onChange={(e) => setLoc('description', 'ar', e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="ff-images" className="label">
              {f.images}
            </label>
            <textarea
              id="ff-images"
              dir="ltr"
              className="input font-mono text-sm"
              rows={3}
              placeholder="https://example.com/pitch-1.jpg"
              value={images}
              onChange={(e) => setImages(e.target.value)}
            />
            <label className="btn-ghost mt-2 cursor-pointer !min-h-[40px] text-sm">
              {uploading ? t.admin.uploading : t.admin.upload}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={uploading} onChange={upload} />
            </label>
          </div>
        </div>
        {error && (
          <p role="alert" className="mx-5 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">
            {error}
          </p>
        )}
        <div className="sticky bottom-0 flex justify-end gap-3 border-t border-ink/10 bg-white px-5 py-4">
          <button type="button" className="btn-ghost" onClick={onClose}>
            {t.admin.close}
          </button>
          <button type="submit" className="btn-dark" disabled={saving}>
            {saving ? (
              <>
                <SpinnerIcon width={18} height={18} /> {t.admin.saving}
              </>
            ) : (
              t.admin.save
            )}
          </button>
        </div>
      </form>
    </dialog>
  );
}
