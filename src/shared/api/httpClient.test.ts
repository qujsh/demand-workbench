import { expect, it } from 'vitest';
import { resolveApiBaseUrl } from './httpClient';

it('开发API保持与页面相同的回环主机名，让浏览器共享现有会话Cookie', () => {
  expect(resolveApiBaseUrl('http://localhost:8070', 'http://127.0.0.1:4173/notes', true)).toBe(
    'http://127.0.0.1:8070',
  );
  expect(resolveApiBaseUrl('http://127.0.0.1:8070', 'http://localhost:4173/notes', true)).toBe(
    'http://localhost:8070',
  );
});
it('不修改线上API、远程API或同源代理地址', () => {
  expect(resolveApiBaseUrl('https://api.example.com', 'http://localhost:4173/', true)).toBe(
    'https://api.example.com',
  );
  expect(resolveApiBaseUrl('http://localhost:8070', 'https://work.example.com/', false)).toBe(
    'http://localhost:8070',
  );
  expect(resolveApiBaseUrl('/backend', 'http://127.0.0.1:4173/', true)).toBe('/backend');
});
