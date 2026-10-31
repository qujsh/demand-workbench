import { z } from 'zod';
import { requestJson } from '../../../shared/api/httpClient';
import { apiResponseSchema } from '../../../shared/api/apiResponseSchema';
import { rewardItemSchema, type RewardItem } from './taskContentApi';
export const rewardAnalysisSchema = z.object({
  taskId: z.string(),
  requirementNo: z.string(),
  description: z.string(),
  status: z.preprocess(
    (value) => (typeof value === 'string' ? value.toUpperCase() : value),
    z.enum(['QUEUED', 'PROCESSING', 'SUCCESS', 'FAILED']),
  ),
  result: z
    .object({
      rewards: z.array(rewardItemSchema),
      missingInformation: z.array(z.string()),
      reviewStatus: z.enum(['allowed', 'needs_changes', 'blocked']),
      reviewMessage: z.string().nullable(),
    })
    .nullable(),
});
export type RewardAnalysisJob = z.infer<typeof rewardAnalysisSchema>;
export const submitRewardAnalysis = (
  requirementNo: string,
  description: string,
  rewards?: RewardItem[],
) =>
  requestJson(
    `/api/v1/reward-analysis?requirementNo=${encodeURIComponent(requirementNo)}`,
    apiResponseSchema(rewardAnalysisSchema),
    { method: 'POST', body: JSON.stringify({ description, rewards }) },
  );
export const getRewardAnalysis = (taskId: string, signal?: AbortSignal) =>
  requestJson(
    `/api/v1/reward-analysis?taskId=${encodeURIComponent(taskId)}`,
    apiResponseSchema(rewardAnalysisSchema),
    { signal },
  );
