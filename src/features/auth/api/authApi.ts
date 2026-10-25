import { z } from 'zod';
import { requestJson } from '../../../shared/api/httpClient';

const userSchema = z.object({
  userNo: z.string(),
  nickname: z.string(),
  status: z.string(),
  phone: z.string().nullish(),
  publisherLevel: z.string().nullish(),
  publisherLevelName: z.string().nullish(),
});

const backgroundSchema = z.object({
  url: z.url(),
  copyright: z.string(),
});

const envelope = <T extends z.ZodTypeAny>(schema: T) =>
  z.object({ success: z.literal(true), msg: schema, errorCode: z.string(), errorMsg: z.string() });

export type CurrentUser = z.infer<typeof userSchema>;
export type LoginBackground = z.infer<typeof backgroundSchema>;

export const currentUserKey = ['auth', 'current-user'] as const;

export async function saveProfile(nickname: string): Promise<CurrentUser> {
  return (await requestJson('/api/v1/users/profile/save', envelope(userSchema), {
    method: 'POST', body: JSON.stringify({ nickname }),
  })).msg;
}

export async function getLoginBackground(): Promise<LoginBackground> {
  return (await requestJson('/api/v1/public/background', envelope(backgroundSchema))).msg;
}

export async function getCurrentUser(): Promise<CurrentUser> {
  return (await requestJson('/api/v1/users/me', envelope(userSchema))).msg;
}

export async function sendLoginCode(phone: string): Promise<void> {
  await requestJson(
    '/api/v1/auth/sms/send',
    envelope(z.object({ message: z.string(), developmentCode: z.string() })),
    { method: 'POST', body: JSON.stringify({ phone }) },
  );
}

export async function login(phone: string, code: string): Promise<CurrentUser> {
  return (
    await requestJson('/api/v1/auth/sms/login', envelope(userSchema), {
      method: 'POST',
      body: JSON.stringify({ phone, code }),
    })
  ).msg;
}

export async function logout(): Promise<void> {
  await requestJson('/api/v1/auth/logout', envelope(z.string()), { method: 'POST' });
}

const sessionSchema = z.object({
  sessionNo: z.string(), device: z.string(), createdAt: z.string(), expiresAt: z.string(), current: z.boolean(),
});
const securityEventSchema = z.object({
  id: z.number(), event: z.string(), device: z.string(), createdAt: z.string(),
});
const eligibilitySchema = z.object({
  level: z.string().nullable(), levelName: z.string(), canPublish: z.boolean(), message: z.string(),
});

export const sessionsKey = ['auth', 'sessions'] as const;
export const securityEventsKey = ['auth', 'security-events'] as const;
export const eligibilityKey = ['auth', 'publisher-eligibility'] as const;

export async function getSessions() {
  return (await requestJson('/api/v1/users/sessions', envelope(z.array(sessionSchema)))).msg;
}

export async function getSecurityEvents() {
  return (await requestJson('/api/v1/users/security-events', envelope(z.array(securityEventSchema)))).msg;
}

export async function getPublisherEligibility() {
  return (await requestJson('/api/v1/users/publisher-eligibility', envelope(eligibilitySchema))).msg;
}

export async function revokeSession(sessionNo: string | null) {
  const path = sessionNo === null ? '/api/v1/users/sessions/revoke-others'
    : `/api/v1/users/sessions/revoke?sessionNo=${encodeURIComponent(sessionNo)}`;
  await requestJson(path, envelope(z.string()), { method: 'POST' });
}
