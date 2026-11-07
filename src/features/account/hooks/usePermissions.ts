import { useQuery } from '@tanstack/react-query';
import { accountKeys, getOverview } from '../api/accountApi';

/** 权限来自服务端有效授权；前端显隐不替代接口校验。 */
export function usePermissions() {
  const query = useQuery({ queryKey: accountKeys.overview, queryFn: ({ signal }) => getOverview(signal), retry: false, refetchOnWindowFocus: true });
  const permissions = query.isError ? [] : query.data?.permissions ?? [];
  return { ...query, permissions, can: (permission: string) => permissions.includes(permission) };
}
