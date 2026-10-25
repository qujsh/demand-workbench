import { useMutation, useQueryClient } from '@tanstack/react-query';
import { cancelPublishTask } from '../api/publishTaskApi';

export function useCancelPublishTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: cancelPublishTask,
    onSuccess: async (_, requirementNo) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['requirements'] }),
        queryClient.invalidateQueries({ queryKey: ['publish-task', requirementNo] }),
      ]);
    },
  });
}
