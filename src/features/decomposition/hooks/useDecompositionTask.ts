import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { queryDecomposition, submitDecomposition } from '../api/decompositionApi';

export function useDecompositionTask(initialTaskId?: string) {
  const [taskId, setTaskId] = useState<string | undefined>(initialTaskId);
  const [submittedAt, setSubmittedAt] = useState(0);

  const submitMutation = useMutation({
    mutationFn: submitDecomposition,
    onSuccess: response => {
      setTaskId(response.taskId);
      setSubmittedAt(Date.now());
    },
  });

  const taskQuery = useQuery({
    queryKey: ['requirement-decomposition', taskId],
    queryFn: ({ signal }) => queryDecomposition(taskId!, signal),
    enabled: Boolean(taskId),
    retry: 1,
    refetchInterval: query => {
      const status = query.state.data?.status;
      if (status === 'SUCCESS' || status === 'FAILED') return false;
      const elapsed = Date.now() - submittedAt;
      return elapsed < 10_000 ? 2_000 : elapsed < 30_000 ? 3_000 : 5_000;
    },
  });

  const error = submitMutation.error ?? taskQuery.error;
  const task = taskQuery.data ?? submitMutation.data;

  return {
    task,
    error,
    isPending: submitMutation.isPending || taskQuery.isFetching,
    start: async (content: string) => {
      setTaskId(undefined);
      return submitMutation.mutateAsync(content);
    },
    reset: () => {
      setTaskId(undefined);
      submitMutation.reset();
    },
  };
}
