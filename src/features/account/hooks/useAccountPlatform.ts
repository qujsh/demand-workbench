import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { accountKeys, activateContractor, getAdminUsers, getAudits, getOverview, getRules, saveAdmin } from '../api/accountApi';

export function useAccountPlatform() {
  const client = useQueryClient();
  const overview = useQuery({ queryKey: accountKeys.overview, queryFn: ({ signal }) => getOverview(signal) });
  const rules = useQuery({ queryKey: accountKeys.rules, queryFn: ({ signal }) => getRules(signal) });
  const activate = useMutation({ mutationFn: activateContractor, onSuccess: (data) => client.setQueryData(accountKeys.overview, data) });
  return { overview, rules, activate };
}
export function useAdmin(permissions: string[]) {
  const client = useQueryClient();
  const users = useQuery({ queryKey: accountKeys.users, queryFn: ({ signal }) => getAdminUsers(signal), enabled: permissions.includes('accounts.manage') });
  const audits = useQuery({ queryKey: accountKeys.audits, queryFn: ({ signal }) => getAudits(signal), enabled: permissions.includes('audit.read') });
  const save = useMutation({ mutationFn: saveAdmin, onSuccess: async () => {
    await Promise.all([client.invalidateQueries({ queryKey: ['account'] }), client.invalidateQueries({ queryKey: ['auth', 'current-user'] }), client.invalidateQueries({ queryKey: ['auth', 'publisher-eligibility'] })]);
  } });
  return { users, audits, save };
}
