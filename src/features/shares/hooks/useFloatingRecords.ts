import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getFloating, saveFloating } from '../api/shareApi';
export function useFloatingRecords() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ['shares', 'floating'],
    queryFn: ({ signal }) => getFloating(signal),
  });
  const write = useMutation({
    mutationFn: ({ id, remove }: { id: string; remove?: boolean }) => saveFloating(id, remove),
    onSuccess: () => client.invalidateQueries({ queryKey: ['shares', 'floating'] }),
  });
  return { query, write };
}
