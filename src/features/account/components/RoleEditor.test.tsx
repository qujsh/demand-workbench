import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import type { PermissionDefinition, PlatformRole } from '../api/roleApi';
import { RoleEditor } from './RoleEditor';
import { PermissionTree } from './PermissionTree';

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  Object.defineProperty(window, 'matchMedia', { writable: true, value: vi.fn().mockImplementation(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() })) });
});
afterEach(cleanup);
const catalog: PermissionDefinition[] = [
  { code: 'requirements.use', name: '使用需求管理', group: '业务功能', description: '使用本人需求', publicAllowed: true },
  { code: 'categories.read', name: '查看分类', group: '分类管理', description: '查看列表', publicAllowed: false },
  { code: 'categories.edit', name: '编辑分类', group: '分类管理', description: '编辑分类资料', publicAllowed: false },
];
const baseRole: PlatformRole = { code: 'public', name: '公共权限', description: '', enabled: true, version: 2, permissions: [], common: true, builtIn: true };
it('uses Chinese checkboxes and automatically includes category read when edit is selected', async () => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  render(<RoleEditor role={null} catalog={catalog} common={['requirements.use']} pending={false} onSave={onSave} onCancel={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('角色名称'), { target: { value: '分类编辑员' } });
  fireEvent.click(screen.getByRole('checkbox', { name: '编辑分类' }));
  expect((screen.getByRole('checkbox', { name: '查看分类' }) as HTMLInputElement).checked).toBe(true);
  expect(screen.queryByText('categories.edit')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '保存配置' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: '分类编辑员', permissions: expect.arrayContaining(['categories.read', 'categories.edit']) })));
});
it('excludes management permissions from common configuration and requires confirmation', async () => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  render(<RoleEditor role={baseRole} catalog={catalog} common={[]} pending={false} onSave={onSave} onCancel={vi.fn()} />);
  expect(screen.queryByRole('checkbox', { name: '编辑分类' })).toBeNull();
  fireEvent.click(screen.getByRole('checkbox', { name: '使用需求管理' }));
  fireEvent.click(screen.getByRole('button', { name: '保存配置' }));
  expect(onSave).not.toHaveBeenCalled();
  fireEvent.click(await screen.findByRole('button', { name: '确认影响所有账号' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ code: 'public', version: 2, permissions: ['requirements.use'] })));
});
it('renders the protected admin role without a save action', () => {
  render(<RoleEditor role={{ ...baseRole, code: 'admin', name: '平台管理员', common: false }} catalog={catalog} common={[]} pending={false} onSave={vi.fn()} onCancel={vi.fn()} />);
  expect(screen.queryByRole('button', { name: '保存配置' })).toBeNull();
  expect(screen.queryByLabelText('角色名称')).toBeNull();
  expect(screen.getByRole('heading', { name: '查看角色权限' })).toBeTruthy();
  expect((screen.getByRole('checkbox', { name: '编辑分类' }) as HTMLInputElement).disabled).toBe(true);
});
it('supports group selection, search without losing selections, and removing category read', async () => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  render(<RoleEditor role={null} catalog={catalog} common={[]} pending={false} onSave={onSave} onCancel={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('角色名称'), { target: { value: '树形配置' } });
  fireEvent.click(screen.getByRole('checkbox', { name: '分类管理' }));
  expect((screen.getByRole('checkbox', { name: '编辑分类' }) as HTMLInputElement).checked).toBe(true);
  fireEvent.change(screen.getByLabelText('搜索权限'), { target: { value: '需求' } });
  expect(screen.queryByRole('checkbox', { name: '编辑分类' })).toBeNull();
  fireEvent.click(screen.getByRole('checkbox', { name: '使用需求管理' }));
  fireEvent.change(screen.getByLabelText('搜索权限'), { target: { value: '' } });
  expect((screen.getByRole('checkbox', { name: '编辑分类' }) as HTMLInputElement).checked).toBe(true);
  fireEvent.click(screen.getByRole('checkbox', { name: '编辑分类' }));
  expect((screen.getByRole('checkbox', { name: '分类管理' }) as HTMLInputElement).indeterminate).toBe(true);
  fireEvent.click(screen.getByRole('checkbox', { name: '查看分类' }));
  fireEvent.click(screen.getByRole('button', { name: '保存配置' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ permissions: ['requirements.use'] })));
}, 15000);
it('toggles expansion with one button and restores pre-search expansion without clearing the query', async () => {
  render(<PermissionTree catalog={catalog} selected={[]} disabled={false} onToggle={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: '收起全部' }));
  await waitFor(() => expect(screen.queryByLabelText('编辑分类')).toBeNull());
  expect(screen.queryByRole('button', { name: '收起全部' })).toBeNull();
  fireEvent.change(screen.getByLabelText('搜索权限'), { target: { value: '编辑分类' } });
  expect(screen.getByLabelText('编辑分类')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '收起全部' }));
  expect((screen.getByLabelText('搜索权限') as HTMLInputElement).value).toBe('编辑分类');
  fireEvent.click(screen.getByRole('button', { name: '展开全部' }));
  fireEvent.change(screen.getByLabelText('搜索权限'), { target: { value: '' } });
  await waitFor(() => expect(screen.queryByLabelText('编辑分类')).toBeNull());
  fireEvent.click(screen.getByRole('button', { name: '展开全部' }));
  expect(screen.getByLabelText('编辑分类')).toBeTruthy();
}, 15000);
it('filters selected permissions without changing assignments or public inheritance', async () => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  render(<RoleEditor role={{ ...baseRole, code: 'custom', name: '分类人员', common: false, permissions: ['categories.read'] }} catalog={catalog} common={['requirements.use']} pending={false} onSave={onSave} onCancel={vi.fn()} />);
  fireEvent.click(screen.getByRole('checkbox', { name: '仅看已选' }));
  expect(screen.getByRole('checkbox', { name: '查看分类' })).toBeTruthy();
  expect(screen.queryByRole('checkbox', { name: '编辑分类' })).toBeNull();
  expect(screen.queryByRole('checkbox', { name: '使用需求管理' })).toBeNull();
  expect(screen.getByText('使用需求管理')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '保存配置' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ permissions: ['categories.read'] })));
});
it('renders bilingual nested modules from the directory and submits only action codes', async () => {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const permission = { code: 'assignments.read', name: '查看承接', nameEn: 'View Assignments', description: '查看任务', descriptionEn: 'Read assigned tasks', group: '承接管理', publicAllowed: false, path: [{ code: 'assignments', name: '承接管理', nameEn: 'Assignment Management' }, { code: 'assignment.tasks', name: '承接任务', nameEn: 'Assignment Tasks' }] };
  render(<RoleEditor role={null} catalog={[permission]} common={[]} pending={false} onSave={onSave} onCancel={vi.fn()} />);
  expect(screen.getByText('Assignment Tasks')).toBeTruthy();
  expect(screen.getByText('View Assignments')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('角色名称'), { target: { value: '承接查看员' } });
  fireEvent.click(screen.getByRole('checkbox', { name: '承接管理' }));
  fireEvent.click(screen.getByRole('button', { name: '保存配置' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ permissions: ['assignments.read'] })));
});
