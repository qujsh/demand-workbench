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

export function getPublishSummary(
  requirementNo: string,
  signal?: AbortSignal,
): Promise<PublishSummary> {
  return requestJson(
    `/api/v1/requirements/publish-summary?requirementNo=${encodeURIComponent(requirementNo)}`,
    publishSummaryApiResponseSchema,
    { signal },
  );
}

export async function streamPublishSummary(
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
      } else if (item.event === 'error') {
        const error = z.object({ errorCode: z.string(), message: z.string() }).parse(payload);
        throw new ApiError(error.message, 502, error.errorCode);
      }
    }
    if (done) break;
  }
}
