import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import type { PermissionNode } from '../api/permissionApi';
import { PermissionNodeEditor } from './PermissionNodeEditor';
beforeAll(() => {
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
  });
});
afterEach(cleanup);
const module: PermissionNode = {
  code: 'assignments',
  parentCode: null,
  nodeType: 'module',
  name: '承接管理',
  nameEn: 'Assignment Management',
  description: '',
  descriptionEn: '',
  sortOrder: 0,
  enabled: true,
  publicAllowed: false,
  builtIn: false,
  version: 2,
};
it('requires bilingual names and sends both descriptions when creating a module', async () => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  render(
    <PermissionNodeEditor
      node={null}
      nodeType="module"
      parentCode={null}
      catalog={[]}
      pending={false}
      onSave={onSave}
      onCancel={vi.fn()}
    />,
  );
  fireEvent.change(screen.getByLabelText('英文编码'), { target: { value: 'assignments' } });
  fireEvent.change(screen.getByLabelText('中文名称'), { target: { value: '承接管理' } });
  fireEvent.click(screen.getByRole('button', { name: '保存定义' }));
  expect(await screen.findByText('请输入英文名称')).toBeTruthy();
  expect(onSave).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('英文名称'), {
    target: { value: 'Assignment Management' },
  });
  fireEvent.change(screen.getByLabelText('中文说明'), { target: { value: '管理承接' } });
  fireEvent.change(screen.getByLabelText('英文说明'), { target: { value: 'Manage assignments' } });
  fireEvent.click(screen.getByRole('button', { name: '保存定义' }));
  await waitFor(() =>
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'assignments',
        nameEn: 'Assignment Management',
        description: '管理承接',
        descriptionEn: 'Manage assignments',
        nodeType: 'module',
        parentCode: null,
        publicAllowed: false,
      }),
    ),
  );
}, 15000);
it('locks stable codes and protected attributes while permitting bilingual metadata editing', async () => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  render(
    <PermissionNodeEditor
      node={{ ...module, builtIn: true }}
      nodeType="module"
      parentCode={null}
      catalog={[module]}
      pending={false}
      onSave={onSave}
      onCancel={vi.fn()}
    />,
  );
  expect((screen.getByLabelText('英文编码') as HTMLInputElement).disabled).toBe(true);
  expect(
    screen.getByRole('switch', { name: '启用权限节点' }).getAttribute('disabled'),
  ).not.toBeNull();
  fireEvent.change(screen.getByLabelText('英文名称'), { target: { value: 'Assignment Center' } });
  fireEvent.click(screen.getByRole('button', { name: '保存定义' }));
  await waitFor(() =>
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'assignments', nameEn: 'Assignment Center', version: 2 }),
    ),
  );
});
