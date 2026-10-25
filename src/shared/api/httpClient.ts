import type { ZodType } from 'zod';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080').replace(/\/$/, '');

export function buildApiUrl(path: string): string {
  return `${apiBaseUrl}${path}`;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function requestJson<T>(
  path: string,
  schema: ZodType<T>,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(buildApiUrl(path), {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(
      payload?.errorMsg || payload?.message || `请求失败（${response.status}）`,
      response.status,
      payload?.errorCode || payload?.code,
    );
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(
      '请求已提交，但后端响应格式与当前前端版本不一致，请重启后端服务后重试',
      502,
      'INVALID_API_RESPONSE',
    );
  }
  return parsed.data;
}
