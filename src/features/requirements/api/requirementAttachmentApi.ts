import { z } from 'zod';
import { requestJson } from '../../../shared/api/httpClient';
import { apiResponseSchema } from '../../../shared/api/apiResponseSchema';
export const requestAttachmentLink = (requirementNo: string, storageKey: string) =>
  requestJson(
    '/api/v1/requirements/attachment-link?requirementNo=' + encodeURIComponent(requirementNo),
    apiResponseSchema(z.string().url()),
    { method: 'POST', body: JSON.stringify({ storageKey }) },
  );
