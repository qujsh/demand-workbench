import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { McpConnectionGuide } from './McpConnectionGuide';
afterEach(() => vi.unstubAllGlobals());
it('服务端诊断立即清除输入且不回显密钥', async () => {
  const token = 'dw_sk_transient';
  const fetch = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        success: true,
        msg: {
          keyNo: 'KEY-test',
          scopes: ['shares:create'],
          tools: ['create_share'],
          requestNo: 'CALL-test',
        },
      }),
    ),
  );
  vi.stubGlobal('fetch', fetch);
  render(<McpConnectionGuide />);
  fireEvent.click(screen.getByText('连接 MCP 与诊断'));
  const input = screen.getByLabelText('待诊断密钥') as HTMLInputElement;
  fireEvent.change(input, { target: { value: token } });
  fireEvent.click(screen.getByRole('button', { name: '验证密钥' }));
  expect(input.value).toBe('');
  await waitFor(() => expect(screen.getByText(/服务端验证通过/)).toBeTruthy());
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ secret: token });
  expect(document.body.textContent).not.toContain(token);
});
