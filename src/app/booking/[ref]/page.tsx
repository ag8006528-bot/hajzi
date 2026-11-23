import type { Metadata } from 'next';
import { Confirmation } from '@/components/booking/Confirmation';
import { getStore } from '@/lib/db';
import { getServerT } from '@/lib/i18n/server';
import { safeEqual, sha256 } from '@/lib/security/crypto';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerT();
  return { title: t.meta.confirmTitle, robots: { index: false, follow: false }, referrer: 'no-referrer' };
}

type Props = { params: Promise<{ ref: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * IDOR protection: knowing (or guessing) a booking reference is NOT enough.
 * The page also requires the secret 256-bit token that only the customer received;
 * only its SHA-256 is stored and it is compared in constant time.
 * Wrong ref and wrong token produce the same "not found" page.
 */
export default async function BookingPage({ params, searchParams }: Props) {
  const [{ ref }, sp] = await Promise.all([params, searchParams]);
  const token = typeof sp.t === 'string' ? sp.t.slice(0, 128) : '';
  const cleanRef = decodeURIComponent(ref).slice(0, 20);

  const store = getStore();
  const booking = /^HZ-[A-Z0-9]{6,10}$/i.test(cleanRef) ? await store.getBookingByRef(cleanRef) : null;
  const authorised = !!booking && !!token && !!booking.accessTokenHash && safeEqual(sha256(token), booking.accessTokenHash);
  if (!authorised) return <Confirmation booking={null} coordinates={null} />;

  const field = await store.getField(booking.fieldId);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { accessTokenHash, phone, notes, ...safe } = booking; // only what the confirmation needs
  return <Confirmation booking={{ ...safe, phone: '' }} coordinates={field?.coordinates ?? null} />;
}
