import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getFloating, saveFloating } from '../api/noteApi';
export function useFloatingRecords() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ['notes', 'floating'],
    queryFn: ({ signal }) => getFloating(signal),
  });
  const write = useMutation({
    mutationFn: ({ id, remove }: { id: string; remove?: boolean }) => saveFloating(id, remove),
    onSuccess: () => client.invalidateQueries({ queryKey: ['notes', 'floating'] }),
  });
  return { query, write };
}
