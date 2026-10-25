import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import type { Requirement } from '../../../shared/types/workItem';
import { listRequirements } from '../api/requirementApi';
import type { RequirementResponse } from '../api/requirementSchemas';

export const stageLabels: Record<RequirementResponse['stage'], Requirement['stage']> = {
  draft: '草稿',
  published: '已发布',
  cancelled: '已取消',
};

function formatUpdatedAt(value: string): string {
  const updated = dayjs(value);
  const now = dayjs();
  if (updated.isSame(now, 'day')) return updated.format('HH:mm');
  if (updated.isSame(now.subtract(1, 'day'), 'day')) return '昨天';
  return updated.format('M 月 D 日');
}

export function mapRequirement(response: RequirementResponse): Requirement {
  return {
    id: response.requirementNo,
    title: response.title,
    description: response.userDescription ?? '',
    aiDescription: response.aiDescription ?? '',
    updated: formatUpdatedAt(response.updatedAt),
    stage: stageLabels[response.stage],
    modules: response.moduleCount,
    items: response.workItemCount,
    currentDecompositionNo: response.currentDecompositionNo ?? undefined,
  };
}

export function useRequirements() {
  return useQuery({
    queryKey: ['requirements'],
    queryFn: ({ signal }) => listRequirements(signal),
    select: responses => responses.map(mapRequirement),
  });
}
