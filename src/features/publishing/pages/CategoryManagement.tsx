import { CategoryDeletion } from '../components/CategoryDeletion';
import { CategoryMigrationHistory } from '../components/CategoryMigrationHistory';
import { useState } from 'react';
import {
  Alert,
  Button,
  Input,
  InputNumber,
  Modal,
  Space,
  Switch,
  Table,
  Tag,
  Tabs,
  message,
} from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  createTaskCategory,
  getManagedTaskCategories,
  updateTaskCategory,
  type ManagedCategory,
} from '../api/taskContentApi';

export default function CategoryManagement({ returnPath }: { returnPath?: string }) {
  const navigate = useNavigate();
  const client = useQueryClient();
  const [tab, setTab] = useState('categories');
  const [keyword, setKeyword] = useState('');
  const [editing, setEditing] = useState<ManagedCategory | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [fields, setFields] = useState({ name: '', code: '', sortOrder: 1000, enabled: true });
  const validCode = fields.code.length <= 64 && /^[a-z]+(?:_[a-z]+)*$/.test(fields.code);
  const valid = !!fields.name.trim() && validCode;
  const openEditor = (item: ManagedCategory | null) => {
    setEditing(item);
    setFields(item ? { ...item } : { name: '', code: '', sortOrder: 1000, enabled: true });
    setEditorOpen(true);
  };
  const [toast, holder] = message.useMessage();
  const categories = useQuery({
    queryKey: ['managed-task-categories', keyword],
    queryFn: ({ signal }) => getManagedTaskCategories(keyword, signal),
  });
  const refreshCategories = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['task-categories'] }),
      client.invalidateQueries({ queryKey: ['managed-task-categories'] }),
    ]);
  };
  const update = useMutation({
    mutationFn: updateTaskCategory,
    onSuccess: async (result, input) => {
      if (input.originalCode !== result.code)
        window.dispatchEvent(
          new CustomEvent('category-migrated', {
            detail: { sourceCode: input.originalCode, targetCode: result.code },
          }),
        );
      setEditorOpen(false);
      await refreshCategories();
      void toast.success('分类已更新');
    },
    onError: (error: Error) => {
      void toast.error(error.message);
    },
  });
  const create = useMutation({
    mutationFn: () =>
      createTaskCategory(fields.code, fields.name.trim(), fields.sortOrder, fields.enabled),
    onSuccess: async () => {
      setEditorOpen(false);
      await refreshCategories();
      void toast.success(returnPath ? '分类已保存，返回发布页后即可选择' : '分类已保存');
    },
    onError: (error: Error) => {
      void toast.error(error.message);
    },
  });
  return (
    <main className="category-page">
      {holder}
      <header className="topbar">
        <span>配置中心</span>
        <span>/</span>
        <strong>分类管理</strong>
      </header>
      <div className="category-content">
        <div className="category-heading">
          <div>
            <h1>分类管理</h1>
            <p>统一管理任务分类，B 端发布与 C 端浏览共用。</p>
          </div>
          {returnPath && <Button onClick={() => navigate(returnPath)}>返回发布任务</Button>}
        </div>
        {returnPath && (
          <Alert
            type="info"
            showIcon
            title="发布内容已保留，创建分类后可返回继续填写。"
            style={{ marginBottom: 20 }}
          />
        )}
        <Tabs
          activeKey={tab}
          onChange={setTab}
          items={[
            { key: 'categories', label: '分类列表' },
            { key: 'history', label: '迁移记录' },
          ]}
        />
        {tab === 'history' ? (
          <CategoryMigrationHistory />
        ) : (
          <>
            {categories.isError && (
              <Alert
                type="error"
                title={categories.error.message}
                action={<Button onClick={() => void categories.refetch()}>重试</Button>}
              />
            )}
            <div className="category-list-toolbar">
              <strong>全部分类</strong>
              <Space size={12}>
                <Input.Search
                  aria-label="搜索分类"
                  placeholder="搜索名称或编号"
                  allowClear
                  maxLength={64}
                  onSearch={(value) => setKeyword(value.trim())}
                  style={{ width: 280 }}
                />
                <Button type="primary" onClick={() => openEditor(null)}>
                  新增分类
                </Button>
              </Space>
            </div>
            <Table
              rowKey="code"
              loading={categories.isPending}
              dataSource={categories.data ?? []}
              pagination={{ pageSize: 10, hideOnSinglePage: true }}
              locale={{ emptyText: keyword ? '未找到匹配的分类' : '暂无分类，请先创建一个分类' }}
              columns={[
                { title: '分类名称', dataIndex: 'name' },
                { title: '分类编号', dataIndex: 'code', ellipsis: true },
                { title: '排序', dataIndex: 'sortOrder', width: 80 },
                {
                  title: '来源',
                  dataIndex: 'source',
                  width: 100,
                  render: (source: string) =>
                    source === 'system' ? '系统预设' : source === 'user' ? '用户创建' : '未知来源',
                },
                {
                  title: '创建人',
                  render: (_, item: ManagedCategory) =>
                    item.source === 'system' ? '系统' : item.creatorName || '账号不可用',
                },
                {
                  width: 90,
                  title: '状态',
                  dataIndex: 'enabled',
                  render: (enabled: boolean) => (
                    <Tag color={enabled ? 'green' : undefined}>{enabled ? '已启用' : '已停用'}</Tag>
                  ),
                },
                {
                  title: '操作',
                  width: 160,
                  render: (_, item: ManagedCategory) => (
                    <Space size={0} className="category-row-actions">
                      <Button type="link" onClick={() => openEditor(item)}>
                        编辑
                      </Button>
                      <CategoryDeletion category={item} />
                    </Space>
                  ),
                },
              ]}
            />
          </>
        )}
      </div>
      <Modal
        title={editing ? '编辑分类' : '新增分类'}
        open={editorOpen}
        onCancel={() => {
          if (!update.isPending && !create.isPending) setEditorOpen(false);
        }}
        okText={editing ? '保存修改' : '创建分类'}
        cancelText="取消"
        confirmLoading={update.isPending || create.isPending}
        okButtonProps={{ disabled: !valid }}
        onOk={() => {
          if (!valid) return;
          if (editing)
            update.mutate({ ...fields, name: fields.name.trim(), originalCode: editing.code });
          else create.mutate();
        }}
      >
        <div className="category-edit-fields">
          <div>
            <span>分类名称</span>
            <Input
              aria-label={editing ? '编辑分类名称' : '分类名称'}
              value={fields.name}
              maxLength={64}
              placeholder="例如：摄影影像"
              onChange={(event) => setFields({ ...fields, name: event.target.value })}
            />
          </div>
          <div>
            <span>英文编号</span>
            <Input
              aria-label="英文编号"
              value={fields.code}
              maxLength={64}
              placeholder="例如：pet_care"
              status={fields.code && !validCode ? 'error' : undefined}
              onChange={(event) => setFields({ ...fields, code: event.target.value })}
            />
            <small>仅用小写英文字母，多个单词用下划线连接，最长64字符且不可重复。</small>
          </div>
          <div>
            <span>展示排序</span>
            <InputNumber
              aria-label="分类展示排序"
              value={fields.sortOrder}
              min={0}
              max={999999}
              precision={0}
              style={{ width: '100%' }}
              onChange={(value) => setFields({ ...fields, sortOrder: value ?? 1000 })}
            />
            <small>数值越小越靠前，同值按分类编号排序。</small>
          </div>
          <div className="category-status-field">
            <span>启用分类</span>
            <Switch
              aria-label="启用分类"
              checked={fields.enabled}
              onChange={(enabled) => setFields({ ...fields, enabled })}
            />
          </div>
          {editing && (
            <Alert
              type="info"
              showIcon
              title="修改编号会同步更新当前任务和草稿关联，历史发布版本保留原编号。停用后不可用于新的正式发布，已发布任务继续保留。"
            />
          )}
        </div>
      </Modal>
    </main>
  );
}
