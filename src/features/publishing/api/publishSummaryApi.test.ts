import { afterEach, describe, expect, it, vi } from 'vitest';
import { extractSseEvents, streamPublishSummary } from './publishSummaryApi';

describe('extractSseEvents', () => {
  it('解析完整事件并保留未完成片段', () => {
    const parsed = extractSseEvents(
      'event: content\ndata: {"text":"任务"}\n\nevent: content\ndata: {"text":"简介',
    );

    expect(parsed.events).toEqual([{ event: 'content', data: '{"text":"任务"}' }]);
    expect(parsed.remainder).toBe('event: content\ndata: {"text":"简介');
  });

  it('兼容 CRLF 和多行 data', () => {
    const parsed = extractSseEvents('event: content\r\ndata: 第一行\r\ndata: 第二行\r\n\r\n');

    expect(parsed.events).toEqual([{ event: 'content', data: '第一行\n第二行' }]);
    expect(parsed.remainder).toBe('');
  });
});

afterEach(() => vi.unstubAllGlobals());

function mockStream(content: string) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(content, { status: 200 })));
}

it('连接失败显示中文信息，不暴露底层network error', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network error')));
  await expect(streamPublishSummary('REQ-1', {onContent: vi.fn(), onComplete: vi.fn()}))
    .rejects.toMatchObject({code:'SUMMARY_CONNECTION_ERROR', message:expect.stringContaining('连接异常')});
});

it('已收到部分文本但缺少完成事件时报告中断，不误报成功', async () => {
  mockStream('event: content\ndata: {"text":"部分简介"}\n\n');
  const onContent = vi.fn(), onComplete = vi.fn();
  await expect(streamPublishSummary('REQ-1', {onContent, onComplete}))
    .rejects.toMatchObject({code:'SUMMARY_STREAM_INTERRUPTED'});
  expect(onContent).toHaveBeenCalledWith('部分简介');
  expect(onComplete).not.toHaveBeenCalled();
});

it('只有收到合法完成事件才反馈成功', async () => {
  const summary = {requirementNo:'REQ-1',status:'success',content:'完整简介',promptVersion:null,generatedAt:null};
  mockStream('event: complete\ndata: ' + JSON.stringify(summary) + '\n\n');
  const onComplete = vi.fn();
  await streamPublishSummary('REQ-1', {onContent: vi.fn(), onComplete});
  expect(onComplete).toHaveBeenCalledWith(summary);
});
