import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getPermissionDirectory, permissionKeys, savePermissionNode, reorderPermissions, type PermissionInput } from '../api/permissionApi';

export function usePermissionDirectory() {
  const client = useQueryClient();
  const directory = useQuery({ queryKey: permissionKeys.directory, queryFn: ({ signal }) => getPermissionDirectory(signal) });
  const save = useMutation({ mutationFn: ({ input, creating }: { input: PermissionInput; creating: boolean }) => savePermissionNode(input, creating), onSuccess: () => client.invalidateQueries({ queryKey: ['account'] }) });
  const reorder = useMutation({ mutationFn: reorderPermissions, onSuccess: () => client.invalidateQueries({ queryKey: ['account'] }) });
  return { directory, save, reorder };
}
