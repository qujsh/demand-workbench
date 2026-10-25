import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteWorkItems } from '../api/workItemApi';

export function useDeleteWorkItems() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteWorkItems,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['requirement-decomposition'] });
    },
  });
}
