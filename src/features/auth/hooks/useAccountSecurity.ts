import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { eligibilityKey, getPublisherEligibility, getSecurityEvents, getSessions, revokeSession, securityEventsKey, sessionsKey } from '../api/authApi';

export function useAccountSecurity() {
  const client = useQueryClient();
  const eligibility = useQuery({ queryKey: eligibilityKey, queryFn: getPublisherEligibility });
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
  return { eligibility, sessions, events, revoke };
}
