import { afterEach, describe, expect, it, vi } from 'vitest';
import { uploadMedia } from './mediaUploadApi';
const response = (msg: unknown) =>
  new Response(JSON.stringify({ success: true, msg, errorCode: '', errorMsg: '' }));
const ticket = {
  mediaNo: 'MEDIA-1',
  key: 'task/cover/2026/10/image.png',
  token: 'short-lived-token',
  uploadUrl: 'https://upload.qiniup.com',
  expiresAt: 1900000000,
};
let mode: 'success' | 'failure' | 'wrong-key' = 'success';
class UploadRequest {
  upload = {
    onprogress: (_event: { lengthComputable: boolean; loaded: number; total: number }) => {},
  };
  status = 200;
  responseText = '';
  timeout = 0;
  onload = () => {};
  onerror = () => {};
  ontimeout = () => {};
  onabort = () => {};
  open = vi.fn();
  send = vi.fn((body: FormData) => {
    expect(body.get('key')).toBe(ticket.key);
    expect(body.get('token')).toBe(ticket.token);
    this.upload.onprogress({ lengthComputable: true, loaded: 12, total: 12 });
    this.status = mode === 'failure' ? 403 : 200;
    this.responseText = JSON.stringify({ key: mode === 'wrong-key' ? 'other' : ticket.key });
    this.onload();
  });
  abort() {
    this.onabort();
  }
}
afterEach(() => {
  vi.unstubAllGlobals();
  mode = 'success';
});
function setup() {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(response(ticket))
    .mockResolvedValueOnce(response({ mediaNo: 'MEDIA-1', type: 'image', previewUrl: '/preview' }));
  vi.stubGlobal('fetch', fetcher);
  vi.stubGlobal('XMLHttpRequest', UploadRequest);
  return fetcher;
}
const input = () => ({
  file: new File(['image-bytes'], 'cover.png', { type: 'image/png' }),
  scene: 'task_cover' as const,
  requirementNo: 'REQ-1',
});
describe('registered direct upload', () => {
  it('registers scene and source before uploading, and confirms before returning media', async () => {
    const fetcher = setup();
    const progress = vi.fn();
    expect((await uploadMedia({ ...input(), onProgress: progress })).mediaNo).toBe('MEDIA-1');
    expect(fetcher.mock.calls[0][0]).toContain('upload-token?requirementNo=REQ-1');
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({
      scene: 'task_cover',
      filename: 'cover.png',
      mimeType: 'image/png',
    });
    expect(fetcher.mock.calls[0][1].credentials).toBe('include');
    expect(fetcher.mock.calls[1][0]).toContain('complete?mediaNo=MEDIA-1');
    expect(progress).toHaveBeenCalledWith(100);
  });
  it.each(['failure', 'wrong-key'] as const)('never confirms a %s upload', async (value) => {
    mode = value;
    const fetcher = setup();
    await expect(uploadMedia(input())).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('rejects unsupported scene types before requesting a token', async () => {
    const fetcher = setup();
    await expect(
      uploadMedia({ ...input(), file: new File(['pdf'], 'a.pdf', { type: 'application/pdf' }) }),
    ).rejects.toMatchObject({ code: 'MEDIA_INVALID' });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('does not confirm after cancellation', async () => {
    const fetcher = setup();
    const controller = new AbortController();
    controller.abort();
    await expect(uploadMedia({ ...input(), signal: controller.signal })).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
