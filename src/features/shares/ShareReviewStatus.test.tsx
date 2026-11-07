import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { expect, it, vi, afterEach } from 'vitest';
import { ShareReviewStatus } from './ShareReviewStatus';
import type { ShareRecord, ShareReview } from './shareDemo';

afterEach(cleanup);

const review: ShareReview = {
  taskNo: 'REVIEW-1',
  status: 'queued',
  completedCount: 0,
  totalCount: 3,
  message: '',
  policyVersion: 'v1',
};
const record: ShareRecord = {
  id: 'SHARE-1',
  title: '记录',
  body: '正文',
  date: '2022-05-01T09:00',
  tags: [],
  visibility: 'private',
  images: [],
  review,
};
it('排队审核显示进度状态，不显示重试按钮', () => {
  render(<ShareReviewStatus record={record} retrying={false} onRetry={vi.fn()} />);
  expect(screen.getByRole('status').textContent).toContain('等待公开审核');
  expect(screen.queryByRole('button', { name: '重试审核' })).toBeNull();
});
it('服务异常提供重试，不误报为内容违规', () => {
  const retry = vi.fn();
  render(
    <ShareReviewStatus
      record={{ ...record, review: { ...review, status: 'failed' } }}
      retrying={false}
      onRetry={retry}
    />,
  );
  expect(screen.getByRole('status').textContent).toContain('审核暂未完成');
  fireEvent.click(screen.getByRole('button', { name: '重试审核' }));
  expect(retry).toHaveBeenCalledOnce();
});
