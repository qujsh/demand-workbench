import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSecurityEvents, getSessions, revokeSession, securityEventsKey, sessionsKey } from '../api/authApi';

export function useAccountSecurity() {
  const client = useQueryClient();
  const sessions = useQuery({ queryKey: sessionsKey, queryFn: getSessions });
  const events = useQuery({ queryKey: securityEventsKey, queryFn: getSecurityEvents });
  const revoke = useMutation({
    mutationFn: revokeSession,
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: sessionsKey }),
        client.invalidateQueries({ queryKey: securityEventsKey }),
      ]);
    },
  });
  return { sessions, events, revoke };
}
