import { requirePermission } from '@/lib/auth';
import { getStore } from '@/lib/db';
import { json, limit, route } from '@/lib/security/request';

export const dynamic = 'force-dynamic';

/** GET /api/admin/messages — contact-form messages (staff/admin). */
export const GET = route(async (req) => {
  const auth = await requirePermission('viewMessages');
  if ('res' in auth) return auth.res;
  const limited = await limit(req, 'admin', auth.user.id);
  if (limited) return limited;
  return json({ messages: await getStore().listMessages(200) });
});
