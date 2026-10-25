import { requestJson } from '../../../shared/api/httpClient';
import {
  decompositionApiResponseSchema,
  submitApiResponseSchema,
  type DecompositionTask,
  type SubmitResponse,
} from './decompositionSchemas';

export function submitDecomposition(content: string): Promise<SubmitResponse> {
  return requestJson('/api/v1/requirements/decompose', submitApiResponseSchema, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

export function queryDecomposition(taskId: string, signal?: AbortSignal): Promise<DecompositionTask> {
  return requestJson(
    `/api/v1/requirements/decompose?taskId=${encodeURIComponent(taskId)}`,
    decompositionApiResponseSchema,
    { signal },
  );
}
