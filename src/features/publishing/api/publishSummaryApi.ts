import { z } from 'zod';
import { apiResponseSchema } from '../../../shared/api/apiResponseSchema';
import { ApiError, buildApiUrl, requestJson } from '../../../shared/api/httpClient';

export const publishSummarySchema = z.object({
  requirementNo: z.string(),
  status: z.enum(['pending', 'generating', 'success', 'failed']),
  content: z.string().nullable(),
  promptVersion: z.string().nullable(),
  generatedAt: z.string().nullable(),
});

const publishSummaryApiResponseSchema = apiResponseSchema(publishSummarySchema);

export type PublishSummary = z.infer<typeof publishSummarySchema>;

interface PublishSummaryStreamHandlers {
  signal?: AbortSignal;
  onContent: (text: string) => void;
  onComplete: (summary: PublishSummary) => void;
}

interface SseEvent {
  event: string;
  data: string;
}

export function extractSseEvents(buffer: string): { events: SseEvent[]; remainder: string } {
  const normalized = buffer.replace(/\r\n/g, '\n');
  const blocks = normalized.split('\n\n');
  const remainder = blocks.pop() ?? '';
  const events = blocks.flatMap((block) => {
    let event = 'message';
    const data: string[] = [];
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
    }
    return data.length ? [{ event, data: data.join('\n') }] : [];
  });
  return { events, remainder };
}

export async function getPublishSummary(
  requirementNo: string,
  signal?: AbortSignal,
): Promise<PublishSummary> {
  try {
    return await requestJson(
      `/api/v1/requirements/publish-summary?requirementNo=${encodeURIComponent(requirementNo)}`,
      publishSummaryApiResponseSchema,
      { signal },
    );
  } catch (error) {
    throw summaryRequestError(error);
  }
}

async function readPublishSummaryStream(
  requirementNo: string,
  handlers: PublishSummaryStreamHandlers,
): Promise<void> {
  const response = await fetch(
    buildApiUrl(
      `/api/v1/requirements/publish-summary/generate?requirementNo=${encodeURIComponent(requirementNo)}`,
    ),
    {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'text/event-stream' },
      signal: handlers.signal,
    },
  );
  if (!response.ok || !response.body) {
    throw new ApiError(`任务简介生成失败（${response.status}）`, response.status);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let completed = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const parsed = extractSseEvents(buffer);
      buffer = parsed.remainder;
      for (const item of parsed.events) {
        const payload = JSON.parse(item.data) as unknown;
        if (item.event === 'content') {
          handlers.onContent(z.object({ text: z.string() }).parse(payload).text);
        } else if (item.event === 'complete') {
          handlers.onComplete(publishSummarySchema.parse(payload));
          completed = true;
        } else if (item.event === 'error') {
          const error = z.object({ errorCode: z.string(), message: z.string() }).parse(payload);
          throw new ApiError(error.message, 502, error.errorCode);
        }
      }
      if (completed) return;
      if (done) break;
    }
    if (!completed)
      throw new ApiError(
        '任务简介生成连接已中断，请重新生成；当前输入内容已保留',
        502,
        'SUMMARY_STREAM_INTERRUPTED',
      );
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

function summaryRequestError(error: unknown): Error {
  if (error instanceof ApiError) return error;
  if (error instanceof Error && error.name === 'AbortError') return error;
  if (error instanceof SyntaxError || error instanceof z.ZodError) {
    return new ApiError('任务简介响应格式异常，请稍后重试', 502, 'INVALID_API_RESPONSE');
  }
  return new ApiError(
    '任务简介连接异常，请检查后端服务或网络后重新生成；当前输入内容已保留',
    0,
    'SUMMARY_CONNECTION_ERROR',
  );
}

export async function streamPublishSummary(
  requirementNo: string,
  handlers: PublishSummaryStreamHandlers,
): Promise<void> {
  try {
    await readPublishSummaryStream(requirementNo, handlers);
  } catch (error) {
    throw summaryRequestError(error);
  }
}
