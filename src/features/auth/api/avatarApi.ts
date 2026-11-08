import { z } from 'zod';
import { ApiError, buildApiUrl, requestJson } from '../../../shared/api/httpClient';
import { apiResponseSchema } from '../../../shared/api/apiResponseSchema';

export const avatarUrl = (no?: string | null) => no ? buildApiUrl(`/api/v1/users/avatar/content?mediaNo=${encodeURIComponent(no)}`) : undefined;

/** 只上传到服务端签发的对象地址，不携带业务会话。完成后才返回可引用编号。 */
export async function uploadAvatar(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size < 1 || file.size > 5 * 1024 * 1024)
    throw new ApiError('请选择5MB以内的JPEG、PNG或WebP图片', 400, 'INVALID_AVATAR');
  const ticket = await requestJson('/api/v1/users/avatar/upload-token', apiResponseSchema(z.object({
    mediaNo: z.string(), key: z.string(), token: z.string(), uploadUrl: z.url().refine((url) => new URL(url).protocol === 'https:'),
  })), { method: 'POST', body: JSON.stringify({ filename: file.name, mimeType: file.type, size: file.size }) });
  const body = new FormData();
  body.append('file', file); body.append('key', ticket.key); body.append('token', ticket.token);
  const response = await fetch(ticket.uploadUrl, { method: 'POST', body, credentials: 'omit' });
  const uploaded = z.object({ key: z.literal(ticket.key) }).safeParse(await response.json().catch(() => null));
  if (!response.ok || !uploaded.success) throw new ApiError('头像上传失败，请重试', response.status, 'AVATAR_UPLOAD_FAILED');
  const result = await requestJson(`/api/v1/users/avatar/complete?mediaNo=${encodeURIComponent(ticket.mediaNo)}`,
    apiResponseSchema(z.object({ mediaNo: z.literal(ticket.mediaNo), contentUrl: z.string() })), { method: 'POST', body: '{}' });
  return result.mediaNo;
}
