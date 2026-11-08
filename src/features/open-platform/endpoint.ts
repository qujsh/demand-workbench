/** 公网只允许HTTPS；开发环境允许本机HTTP。拒绝在URL中夹带凭据。 */
export function resolveMcpEndpoint(
  value: string,
  production: boolean,
): { url?: string; error?: string } {
  try {
    const url = new URL(value);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !['https:', 'http:'].includes(url.protocol)
    )
      throw new Error();
    if (url.protocol !== 'https:' && (production || !local)) throw new Error();
    if (production && local) throw new Error();
    return { url: url.href };
  } catch {
    return {
      error:
        '请配置有效的公网 HTTPS MCP 地址（VITE_MCP_PUBLIC_URL）。开发环境允许本机 HTTP 地址，地址不能包含凭据或查询参数。',
    };
  }
}
