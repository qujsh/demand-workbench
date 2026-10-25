import { z } from 'zod';
import { apiResponseSchema } from '../../../shared/api/apiResponseSchema';
import { requestJson } from '../../../shared/api/httpClient';
import type { WorkItemNode } from '../../../shared/types/workItem';
import { workItemNodeSchema } from './decompositionSchemas';

const deleteWorkItemsResponseSchema = apiResponseSchema(
  z.object({ deletedCount: z.number().int().nonnegative() }),
);

const saveWorkItemResponseSchema = apiResponseSchema(workItemNodeSchema);

export interface SaveWorkItemInput {
  decompositionNo: string;
  parentWorkItemNo?: string | null;
  node: WorkItemNode;
  isNew: boolean;
}

export function isPersistedWorkItemNo(workItemNo: string): boolean {
  return workItemNo.startsWith('DEC-');
}

export function deleteWorkItems(workItemNos: string[]): Promise<{ deletedCount: number }> {
  return requestJson('/api/v1/work-items/delete', deleteWorkItemsResponseSchema, {
    method: 'POST',
    body: JSON.stringify({ workItemNos }),
  });
}

export function saveWorkItem(input: SaveWorkItemInput): Promise<WorkItemNode> {
  const { node } = input;
  return requestJson('/api/v1/work-items/save', saveWorkItemResponseSchema, {
    method: 'POST',
    body: JSON.stringify({
      workItemNo: input.isNew ? null : node.id,
      decompositionNo: input.decompositionNo,
      parentWorkItemNo: input.parentWorkItemNo ?? null,
      type: node.type,
      name: node.name,
      description: node.description ?? '',
      status: node.status ?? '未开始',
      role: node.role || null,
      priority: node.priority ?? '',
      startDate: node.startDate || null,
      endDate: node.endDate || null,
      dependency: node.dependency || null,
    }),
  }).then(saved => {
    delete saved.children;
    delete saved.selected;
    return saved;
  });
}
