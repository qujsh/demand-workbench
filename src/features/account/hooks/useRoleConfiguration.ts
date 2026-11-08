import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getRoleConfiguration, roleKeys, saveRoleConfiguration } from '../api/roleApi';

export function useRoleConfiguration() {
  const client = useQueryClient();
  const configuration = useQuery({
    queryKey: roleKeys.configuration,
    queryFn: ({ signal }) => getRoleConfiguration(signal),
  });
  const save = useMutation({
    mutationFn: saveRoleConfiguration,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['account'] });
    },
  });
  return { configuration, save };
}
