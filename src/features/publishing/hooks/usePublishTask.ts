import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getPublishTask,
  savePublishTask,
  discardPublishDraft,
  type PublishTaskInput,
} from '../api/publishTaskApi';

export function usePublishTask(requirementNo: string) {
  const queryClient = useQueryClient();
  const queryKey = ['publish-task', requirementNo] as const;
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => getPublishTask(requirementNo, signal),
    enabled: Boolean(requirementNo),
    refetchOnWindowFocus: false,
  });
  const mutation = useMutation({
    mutationFn: (input: PublishTaskInput) => savePublishTask(requirementNo, input),
    onSuccess: async (task) => {
      queryClient.setQueryData(queryKey, task);
      if (task.status === 'published') {
        await queryClient.invalidateQueries({ queryKey: ['requirements'] });
        await queryClient.invalidateQueries({ queryKey: ['publish-versions', requirementNo] });
      }
    },
  });
  const discard = useMutation({
    mutationFn: () => discardPublishDraft(requirementNo),
    onSuccess: (task) => {
      queryClient.setQueryData(queryKey, task);
    },
  });
  return {
    ...query,
    save: mutation.mutateAsync,
    discard: discard.mutateAsync,
    isSaving: mutation.isPending || discard.isPending,
  };
}
