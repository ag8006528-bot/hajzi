import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AccountView } from '@/components/account/AccountView';
import { getCurrentCustomer, toPublicCustomer } from '@/lib/auth';
import { getStore } from '@/lib/db';

export const metadata: Metadata = { title: 'My account', robots: { index: false, follow: false } };

export default async function AccountPage() {
  const customer = await getCurrentCustomer();
  if (!customer) redirect('/account/login');
  // Only bookings made while signed in to THIS account (never matched by phone number).
  const bookings = (await getStore().listBookings({ customerId: customer.id })).map((b) => ({
    id: b.id,
    ref: b.ref,
    fieldId: b.fieldId,
    fieldName: b.fieldName,
    fieldType: b.fieldType,
    date: b.date,
    startMinutes: b.startMinutes,
    durationMinutes: b.durationMinutes,
    totalPrice: b.totalPrice,
    status: b.status,
  }));
  return <AccountView customer={toPublicCustomer(customer)} bookings={bookings} />;
}
