import type { ZodType } from 'zod';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8070').replace(/\/$/, '');

/** 仅本机开发对齐回环主机名；Cookie按主机而非端口共享，不复制或透传会话凭证。 */
export function resolveApiBaseUrl(base: string, pageUrl: string, development: boolean): string {
  if (!development || !/^https?:\/\//i.test(base)) return base;
  const target = new URL(base);
  const page = new URL(pageUrl);
  const loopback = (hostname: string) => hostname === 'localhost' || hostname === '127.0.0.1';
  if (loopback(target.hostname) && loopback(page.hostname)) target.hostname = page.hostname;
  return target.href.replace(/\/$/, '');
}

export function buildApiUrl(path: string): string {
  return `${resolveApiBaseUrl(apiBaseUrl, window.location.href, import.meta.env.DEV)}${path}`;
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
