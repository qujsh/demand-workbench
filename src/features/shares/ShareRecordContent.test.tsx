import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ShareRecordContent } from './ShareRecordContent';
import type { ShareRecord } from './shareModels';

afterEach(cleanup);
it('preserves body, tag selection and review retry actions', () => {
  const onTag = vi.fn();
  const onRetry = vi.fn();
  const record: ShareRecord = {
    id: 'record',
    title: '标题',
    body: '原有正文',
    date: '2026-11-08T10:00',
    images: [],
    tags: ['思考'],
    visibility: 'private',
    review: {
      taskNo: 'review',
      status: 'failed',
      completedCount: 0,
      totalCount: 1,
      message: '失败',
      policyVersion: 'v1',
    },
  };
  render(
    <ShareRecordContent
      record={record}
      retrying={false}
      canRetry
      onTag={onTag}
      onRetry={onRetry}
      onOpen={vi.fn()}
    />,
  );
  expect(screen.getByText('原有正文')).toBeTruthy();
  fireEvent.click(screen.getByText('# 思考'));
  expect(onTag).toHaveBeenCalledWith('思考');
  fireEvent.click(screen.getByRole('button', { name: /重试/ }));
  expect(onRetry).toHaveBeenCalledWith(record);
});
