import { describe, expect, it } from 'vitest';
import { resolveMcpEndpoint } from './endpoint';
describe('MCP连接地址', () => {
  it('开发环境只允许本机HTTP，上线要求公网HTTPS', () => {
    expect(resolveMcpEndpoint('http://localhost:8070/mcp', false).url).toBeTruthy();
    expect(resolveMcpEndpoint('http://localhost:8070/mcp', true).error).toBeTruthy();
    expect(resolveMcpEndpoint('http://api.example.com/mcp', false).error).toBeTruthy();
    expect(resolveMcpEndpoint('https://api.example.com/mcp', true).url).toBe(
      'https://api.example.com/mcp',
    );
  });
  it('不允许携带凭据和查询参数', () => {
    for (const url of [
      'https://user:secret@example.com/mcp',
      'https://example.com/mcp?key=secret',
      'javascript:alert(1)',
      '/mcp',
    ]) {
      expect(resolveMcpEndpoint(url, false).error).toBeTruthy();
    }
  });
});
