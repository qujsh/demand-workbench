import { z } from 'zod';
import { apiResponseSchema } from '../../../shared/api/apiResponseSchema';

const attachmentSchema = z.object({
  id: z.number(),
  fileName: z.string(),
  storageKey: z.string(),
  contentType: z.string().nullable(),
  fileSize: z.number(),
  sortOrder: z.number(),
});

export const requirementSchema = z.object({
  requirementNo: z.string(),
  title: z.string(),
  userDescription: z.string().nullable(),
  aiDescription: z.string().nullable(),
  stage: z.enum(['draft', 'published', 'cancelled']),
  currentDecompositionNo: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  moduleCount: z.number(),
  workItemCount: z.number(),
  attachments: z.array(attachmentSchema),
});

export const requirementApiResponseSchema = apiResponseSchema(requirementSchema);
export const requirementListApiResponseSchema = apiResponseSchema(z.array(requirementSchema));

export type RequirementResponse = z.infer<typeof requirementSchema>;
