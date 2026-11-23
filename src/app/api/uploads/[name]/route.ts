import { fail, limit, route } from '@/lib/security/request';
import { readUpload } from '@/lib/security/uploads';

export const runtime = 'nodejs';
type Ctx = { params: Promise<{ name: string }> };

/** GET /api/uploads/:name — serves processed field images (only server-generated names are accepted). */
export const GET = route<Ctx>(async (req, { params }) => {
  const limited = await limit(req, 'publicRead');
  if (limited) return limited;
  const data = await readUpload((await params).name);
  if (!data) return fail('Not found', 404);
  return new Response(new Uint8Array(data), {
    headers: {
      'Content-Type': 'image/webp',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    },
  });
});
