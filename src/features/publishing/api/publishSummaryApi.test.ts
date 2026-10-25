import { describe, expect, it } from 'vitest';
import { extractSseEvents } from './publishSummaryApi';

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
