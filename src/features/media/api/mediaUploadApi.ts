import { z } from 'zod';
import { ApiError, requestJson } from '../../../shared/api/httpClient';
import { apiResponseSchema } from '../../../shared/api/apiResponseSchema';

export type UploadScene = 'task_cover' | 'task_image' | 'task_video' | 'task_attachment';
const ticketSchema = z.object({
  mediaNo: z.string().min(1),
  key: z.string().min(1),
  token: z.string().min(1),
  uploadUrl: z.url().refine((url) => new URL(url).protocol === 'https:'),
  expiresAt: z.number(),
});
const mediaSchema = z.object({
  mediaNo: z.string(),
  type: z.enum(['image', 'video', 'file']),
  previewUrl: z.string(),
});
export type UploadedMedia = z.infer<typeof mediaSchema>;
export interface UploadInput {
  file: File;
  scene: UploadScene;
  requirementNo: string;
  signal?: AbortSignal;
  onProgress?: (percent: number) => void;
}
const types: Record<UploadScene, string[]> = {
  task_cover: ['image/jpeg', 'image/png', 'image/webp'],
  task_image: ['image/jpeg', 'image/png', 'image/webp'],
  task_video: ['video/mp4'],
  task_attachment: ['application/pdf', 'application/zip'],
};
/** 凭证只能由后端生成；跨域直传不携带业务登录Cookie。 */
export async function uploadMedia(input: UploadInput): Promise<UploadedMedia> {
  const { file, scene, requirementNo, signal, onProgress } = input;
  if (!types[scene].includes(file.type) || file.size <= 0 || file.size > 50 * 1024 * 1024)
    throw new ApiError('文件类型不支持或大小超过 50MB', 400, 'MEDIA_INVALID');
  const ticket = await requestJson(
    `/api/v1/task-media/upload-token?requirementNo=${encodeURIComponent(requirementNo)}`,
    apiResponseSchema(ticketSchema),
    {
      method: 'POST',
      signal,
      body: JSON.stringify({ scene, filename: file.name, mimeType: file.type, size: file.size }),
    },
  );
  await directUpload(file, ticket, signal, onProgress);
  return requestJson(
    `/api/v1/task-media/complete?mediaNo=${encodeURIComponent(ticket.mediaNo)}`,
    apiResponseSchema(mediaSchema),
    { method: 'POST', signal },
  );
}
function directUpload(
  file: File,
  ticket: z.infer<typeof ticketSchema>,
  signal?: AbortSignal,
  onProgress?: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    const cleanup = () => signal?.removeEventListener('abort', abort);
    xhr.open('POST', ticket.uploadUrl);
    xhr.timeout = 120_000;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      cleanup();
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new ApiError('上传七牛云失败，请重试', xhr.status, 'UPLOAD_FAILED'));
        return;
      }
      try {
        const result: unknown = JSON.parse(xhr.responseText);
        const parsed = z.object({ key: z.literal(ticket.key) }).safeParse(result);
        if (!parsed.success) throw new Error('invalid');
        resolve();
      } catch {
        reject(new ApiError('上传响应无效，请重试', 502, 'INVALID_API_RESPONSE'));
      }
    };
    xhr.onerror = () => {
      cleanup();
      reject(new ApiError('上传连接失败，请检查网络及七牛云跨域配置', 0, 'UPLOAD_NETWORK_ERROR'));
    };
    xhr.ontimeout = () => {
      cleanup();
      reject(new ApiError('上传超时，请重试', 408, 'UPLOAD_TIMEOUT'));
    };
    xhr.onabort = () => {
      cleanup();
      reject(new DOMException('上传已取消', 'AbortError'));
    };
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) {
      cleanup();
      reject(new DOMException('上传已取消', 'AbortError'));
      return;
    }
    const body = new FormData();
    body.append('token', ticket.token);
    body.append('key', ticket.key);
    body.append('file', file, file.name);
    xhr.send(body);
  });
}
