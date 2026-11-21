import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NoteTagTree } from './NoteTagTree';

afterEach(cleanup);
it('真实路径自动组成三级树，父级可选择且收起后隐藏后代', () => {
  const onSelect = vi.fn();
  render(
    <NoteTagTree
      paths={[
        { name: '项目/构想台/MCP', recordCount: 2 },
        { name: '项目', recordCount: 2 },
        { name: '项目/构想台', recordCount: 2 },
      ]}
      selected="项目/构想台/MCP"
      onSelect={onSelect}
    />,
  );
  expect(screen.queryByText('三级示例')).toBeNull();
  expect(screen.getByRole('button', { name: 'MCP' }).getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(screen.getByRole('button', { name: '项目' }));
  expect(onSelect).toHaveBeenCalledWith('项目');
  fireEvent.click(screen.getByRole('button', { name: '收起项目' }));
  expect(screen.queryByRole('button', { name: 'MCP' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '展开项目' }));
  expect(screen.getByRole('button', { name: 'MCP' })).toBeTruthy();
});
