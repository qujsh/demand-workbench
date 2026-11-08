import { afterEach, expect, it, vi } from 'vitest';
import { uploadAvatar } from './avatarApi';

const envelope = (msg: unknown) =>
  new Response(JSON.stringify({ success: true, msg, errorCode: '', errorMsg: '' }));
afterEach(() => vi.unstubAllGlobals());
it('rejects invalid avatars before requesting credentials', async () => {
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  await expect(uploadAvatar(new File(['svg'], 'a.svg', { type: 'image/svg+xml' }))).rejects.toThrow(
    '5MB',
  );
  expect(fetcher).not.toHaveBeenCalled();
});
it('binds confirmed upload only and omits session credentials for cloud upload', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      envelope({
        mediaNo: 'MEDIA-1',
        key: 'avatar/key',
        token: 'ticket',
        uploadUrl: 'https://upload.example',
      }),
    )
    .mockResolvedValueOnce(new Response(JSON.stringify({ key: 'avatar/key' })))
    .mockResolvedValueOnce(envelope({ mediaNo: 'MEDIA-1', contentUrl: '/avatar' }));
  vi.stubGlobal('fetch', fetcher);
  expect(await uploadAvatar(new File(['png'], 'a.png', { type: 'image/png' }))).toBe('MEDIA-1');
  expect(fetcher.mock.calls[1][1].credentials).toBe('omit');
  expect(fetcher.mock.calls[2][0]).toContain('avatar/complete?mediaNo=MEDIA-1');
});
it('never confirms an upload whose returned object key does not match', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      envelope({
        mediaNo: 'MEDIA-1',
        key: 'avatar/key',
        token: 'ticket',
        uploadUrl: 'https://upload.example',
      }),
    )
    .mockResolvedValueOnce(new Response(JSON.stringify({ key: 'wrong-key' })));
  vi.stubGlobal('fetch', fetcher);
  await expect(uploadAvatar(new File(['png'], 'a.png', { type: 'image/png' }))).rejects.toThrow(
    '上传失败',
  );
  expect(fetcher).toHaveBeenCalledTimes(2);
});
