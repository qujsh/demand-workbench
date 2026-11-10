import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  login,
  loginWithPassword,
  savePassword,
  sendLoginCode,
  type SmsPurpose,
} from '../api/authApi';

export type AuthMode = 'password' | 'sms' | 'set' | 'forgot';
export interface AuthValues {
  phone: string;
  password: string;
  code: string;
  confirmPassword?: string;
}

export function useAuthActions(
  mode: AuthMode,
  onAuthenticated: () => Promise<void>,
  onPasswordSaved: () => Promise<void>,
) {
  const [deadline, setDeadline] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const remaining = Math.max(0, Math.ceil((deadline - now) / 1000));
  useEffect(() => {
    if (!deadline || remaining === 0) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [deadline, remaining]);
  const purpose: SmsPurpose =
    mode === 'set' ? 'set_password' : mode === 'forgot' ? 'reset_password' : 'login';
  const send = useMutation({
    mutationFn: (phone: string) => sendLoginCode(phone, purpose),
    onSuccess: () => {
      const current = Date.now();
      setNow(current);
      setDeadline(current + 60_000);
    },
  });
  const submit = useMutation({
    mutationFn: async (values: AuthValues) => {
      if (mode === 'password') await loginWithPassword(values.phone, values.password);
      else if (mode === 'sms') await login(values.phone, values.code);
      else {
        await savePassword(values, mode === 'forgot');
        await onPasswordSaved();
        return;
      }
      await onAuthenticated();
    },
  });
  return { send, submit, remaining };
}
