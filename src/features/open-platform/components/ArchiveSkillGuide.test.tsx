import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ArchiveSkillGuide } from './ArchiveSkillGuide';

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

it.each(['http://localhost:8070/mcp', 'https://api.freeligo.com/mcp'])(
  '配置指令使用网页当前地址 %s，不夹带密钥',
  async (url) => {
    vi.stubEnv('PROD', url.startsWith('https:'));
    vi.stubEnv('VITE_MCP_PUBLIC_URL', url);
    const writeText = vi.fn().mockResolvedValue(undefined);
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    try {
      render(<ArchiveSkillGuide />);
      fireEvent.click(screen.getByRole('button', { name: '复制默认归档配置指令' }));
      await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
      const prompt = writeText.mock.calls[0][0] as string;
      expect(prompt).toContain(url);
      expect(prompt).not.toContain(url.startsWith('https:') ? 'localhost' : 'api.freeligo.com');
      expect(prompt).not.toContain('dw_sk_');
      expect(screen.getByRole('link', { name: '下载 Skill' }).getAttribute('href')).toBe(
        'https://github.com/qujsh/demand-workbench-skills/releases/latest/download/demand-workbench-archive.zip',
      );
    } finally {
      if (original) Object.defineProperty(navigator, 'clipboard', original);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  },
);
