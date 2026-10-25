import { useMutation, useQueryClient } from '@tanstack/react-query';
import { saveWorkItem } from '../api/workItemApi';

export function useSaveWorkItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveWorkItem,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['requirement-decomposition'] });
    },
  });
}
