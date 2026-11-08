import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiKeyQueryKey, createApiKey, listApiKeys, deleteApiKey } from '../api/apiKeyApi';

export function useApiKeys() {
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: apiKeyQueryKey });
  const query = useQuery({
    queryKey: apiKeyQueryKey,
    queryFn: ({ signal }) => listApiKeys(signal),
  });
  // 明文不进入 mutation / Query 缓存，由调用方短暂展示。
  const remove = useMutation({ mutationFn: deleteApiKey, onSuccess: refresh });
  return { query, remove, createKey: createApiKey, refresh };
}
