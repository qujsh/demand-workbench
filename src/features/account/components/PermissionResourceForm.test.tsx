import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { PermissionResourceForm } from './PermissionResourceForm';
import type { PermissionNode } from '../api/permissionApi';
beforeAll(() =>
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  }),
);
afterEach(cleanup);
const page: PermissionNode = {
  code: 'example.view',
  parentCode: null,
  nodeType: 'page',
  name: '示例页面',
  nameEn: 'Example',
  description: '',
  descriptionEn: '',
  sortOrder: 0,
  enabled: true,
  publicAllowed: false,
  builtIn: false,
  version: 0,
  visible: true,
};
it('keeps navigation visibility separate from permission activation and removes technical fields', async () => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  render(
    <PermissionResourceForm
      node={page}
      creating={false}
      catalog={[]}
      pending={false}
      onSave={onSave}
      onCancel={vi.fn()}
    />,
  );
  expect(screen.queryByText('页面路由')).toBeNull();
  expect(screen.queryByText('菜单图标')).toBeNull();
  expect(screen.queryByText('引用通用能力')).toBeNull();
  fireEvent.click(screen.getByLabelText('在左侧菜单显示'));
  fireEvent.click(screen.getByRole('button', { name: '保存配置' }));
  await waitFor(() =>
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ visible: false, enabled: true })),
  );
});
it('supports independent common permissions without a menu parent', async () => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  render(
    <PermissionResourceForm
      node={{ ...page, nodeType: 'common' }}
      creating={true}
      catalog={[page]}
      pending={false}
      onSave={onSave}
      onCancel={vi.fn()}
    />,
  );
  expect(screen.queryByLabelText('所属分组')).toBeNull();
  expect(screen.queryByLabelText('在左侧菜单显示')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '保存配置' }));
  await waitFor(() =>
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ nodeType: 'common', parentCode: null }),
    ),
  );
});
