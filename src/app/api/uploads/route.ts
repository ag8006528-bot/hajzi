import { requirePermission } from '@/lib/auth';
import { audit } from '@/lib/logger';
import { fail, json, limit, route } from '@/lib/security/request';
import { MAX_UPLOAD_BYTES, processImage, saveUpload, sniffImageType } from '@/lib/security/uploads';

export const runtime = 'nodejs';

/** POST /api/uploads (multipart "file") — admin only. Returns { url }. */
export const POST = route(async (req) => {
  const auth = await requirePermission('uploadImages');
  if ('res' in auth) return auth.res;
  const limited = await limit(req, 'upload', auth.user.id);
  if (limited) return limited;

  if (Number(req.headers.get('content-length') || 0) > MAX_UPLOAD_BYTES + 64 * 1024) return fail('File too large (max 5 MB)', 413);
  if (!(req.headers.get('content-type') || '').startsWith('multipart/form-data')) return fail('Unsupported content type', 415);

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return fail('No file uploaded');
  if (file.size > MAX_UPLOAD_BYTES) return fail('File too large (max 5 MB)', 413);

  const buf = Buffer.from(await file.arrayBuffer());
  const type = sniffImageType(buf);
  if (!type) return fail('Only JPG, PNG or WebP images are allowed', 415);

  let webp: Buffer;
  try {
    webp = await processImage(buf);
  } catch {
    return fail('The image could not be processed', 415);
  }
  const name = await saveUpload(webp);
  await audit(auth.user.email, 'image_uploaded', name, { sourceType: type, bytes: file.size });
  return json({ url: `/api/uploads/${name}` }, 201);
});
