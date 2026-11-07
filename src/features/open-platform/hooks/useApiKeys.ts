import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiKeyQueryKey, createApiKey, listApiKeys, revokeApiKey } from '../api/apiKeyApi';

export function useApiKeys() {
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: apiKeyQueryKey });
  const query = useQuery({
    queryKey: apiKeyQueryKey,
    queryFn: ({ signal }) => listApiKeys(signal),
  });
  // 明文不进入 mutation / Query 缓存，由调用方短暂展示。
  const revoke = useMutation({ mutationFn: revokeApiKey, onSuccess: refresh });
  return { query, revoke, createKey: createApiKey, refresh };
}
