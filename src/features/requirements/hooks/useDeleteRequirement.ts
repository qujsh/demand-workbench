import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteRequirement } from '../api/requirementApi';

export function useDeleteRequirement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteRequirement,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['requirements'] });
    },
  });
}
