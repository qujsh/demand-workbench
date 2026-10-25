import { requestJson } from '../../../shared/api/httpClient';
import type { Requirement } from '../../../shared/types/workItem';
import {
  requirementApiResponseSchema,
  requirementListApiResponseSchema,
  type RequirementResponse,
} from './requirementSchemas';
import { apiResponseSchema } from '../../../shared/api/apiResponseSchema';
import { z } from 'zod';

const persistedRequirementPattern = /^REQ-[A-Z0-9]{1,6}-\d{6,}$/;

export interface SaveRequirementInput {
  requirement: Requirement;
  title?: string;
  description?: string;
  aiDescription?: string;
}

export function isPersistedRequirement(requirementNo: string): boolean {
  return persistedRequirementPattern.test(requirementNo);
}

export function saveRequirement(input: SaveRequirementInput): Promise<RequirementResponse> {
  const { requirement } = input;
  const query = isPersistedRequirement(requirement.id)
    ? `?requirementNo=${encodeURIComponent(requirement.id)}`
    : '';
  return requestJson(`/api/v1/requirements/save${query}`, requirementApiResponseSchema, {
    method: 'POST',
    body: JSON.stringify({
      title: input.title ?? requirement.title,
      userDescription: input.description ?? requirement.description ?? '',
      aiDescription: input.aiDescription ?? requirement.aiDescription ?? '',
      stage: 'draft',
      currentDecompositionNo: requirement.currentDecompositionNo ?? null,
      attachments: [],
    }),
  });
}

export function listRequirements(signal?: AbortSignal): Promise<RequirementResponse[]> {
  return requestJson('/api/v1/requirements/list', requirementListApiResponseSchema, { signal });
}

export function deleteRequirement(requirementNo: string): Promise<'deleted'> {
  return requestJson(
    `/api/v1/requirements/delete?requirementNo=${encodeURIComponent(requirementNo)}`,
    apiResponseSchema(z.literal('deleted')),
    { method: 'POST' },
  );
}
