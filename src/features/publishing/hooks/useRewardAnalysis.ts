import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRewardAnalysis, submitRewardAnalysis } from '../api/rewardAnalysisApi';
import type { RewardItem } from '../api/taskContentApi';

/** 提交和轮询集中在 Hook，终态停止；再次进入页面可按草稿任务编号恢复。 */
export function useRewardAnalysis(requirementNo: string, taskId?: string | null) {
  const client = useQueryClient();
  const submit = useMutation({
    mutationFn: ({ description, rewards }: { description: string; rewards?: RewardItem[] }) =>
      submitRewardAnalysis(requirementNo, description, rewards),
    onSuccess: (job) => {
      client.setQueryData(['reward-analysis', job.taskId], job);
    },
  });
  const query = useQuery({
    queryKey: ['reward-analysis', taskId],
    queryFn: ({ signal }) => getRewardAnalysis(taskId!, signal),
    enabled: Boolean(taskId),
    refetchInterval: (q) =>
      q.state.data && ['QUEUED', 'PROCESSING'].includes(q.state.data.status) ? 1500 : false,
    retry: 1,
  });
  return {
    submit,
    query,
    busy:
      submit.isPending ||
      Boolean(query.data && ['QUEUED', 'PROCESSING'].includes(query.data.status)),
  };
}
