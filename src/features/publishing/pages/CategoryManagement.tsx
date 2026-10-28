import { useState } from 'react';
import { Alert, Button, Input, InputNumber, Modal, Switch, Table, Tag, message } from 'antd';
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
  const [name, setName] = useState('');
  const [keyword, setKeyword] = useState('');
  const [editing, setEditing] = useState<ManagedCategory | null>(null);
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
    onSuccess: async () => {
      setEditing(null);
      await refreshCategories();
      void toast.success('分类已更新');
    },
    onError: (error: Error) => {
      void toast.error(error.message);
    },
  });
  const create = useMutation({
    mutationFn: () => createTaskCategory(name.trim()),
    onSuccess: async () => {
      setName('');
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
        <section className="category-create" aria-label="新增分类">
          <strong>新增分类</strong>
          <div className="category-create-row">
            <Input
              aria-label="分类名称"
              placeholder="输入分类名称，例如：摄影影像"
              maxLength={64}
              value={name}
              onChange={(event) => setName(event.target.value)}
              onPressEnter={() => {
                if (name.trim() && !create.isPending) create.mutate();
              }}
            />
            <Button
              type="primary"
              loading={create.isPending}
              disabled={!name.trim()}
              onClick={() => create.mutate()}
            >
              创建分类
            </Button>
          </div>
          <p>最多 64 个字符。同名分类复用已有编号，不会重复创建。</p>
        </section>
        {categories.isError && (
          <Alert
            type="error"
            title={categories.error.message}
            action={<Button onClick={() => void categories.refetch()}>重试</Button>}
          />
        )}
        <div className="category-list-toolbar">
          <strong>全部分类</strong>
          <Input.Search
            aria-label="搜索分类"
            placeholder="搜索名称或编号"
            allowClear
            maxLength={64}
            onSearch={(value) => setKeyword(value.trim())}
            style={{ width: 280 }}
          />
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
              width: 80,
              render: (_, item: ManagedCategory) => (
                <Button type="link" onClick={() => setEditing({ ...item })}>
                  编辑
                </Button>
              ),
            },
          ]}
        />
      </div>
      <Modal
        title="编辑分类"
        open={!!editing}
        onCancel={() => {
          if (!update.isPending) setEditing(null);
        }}
        okText="保存修改"
        cancelText="取消"
        confirmLoading={update.isPending}
        okButtonProps={{ disabled: !editing?.name.trim() }}
        onOk={() => {
          if (editing) update.mutate(editing);
        }}
      >
        {editing && (
          <div className="category-edit-fields">
            <p className="category-edit-note">分类编号保持不变，已有任务的关联不会丢失。</p>
            <div>
              <span>分类名称</span>
              <Input
                aria-label="编辑分类名称"
                value={editing.name}
                maxLength={64}
                onChange={(event) => setEditing({ ...editing, name: event.target.value })}
              />
            </div>
            <div>
              <span>展示排序</span>
              <InputNumber
                aria-label="分类展示排序"
                value={editing.sortOrder}
                min={0}
                max={999999}
                precision={0}
                onChange={(value) => {
                  if (value !== null) setEditing({ ...editing, sortOrder: value });
                }}
              />
              <small>数值越小越靠前，同值按分类编号排序。</small>
            </div>
            <div className="category-status-field">
              <span>启用分类</span>
              <Switch
                aria-label="启用分类"
                checked={editing.enabled}
                onChange={(enabled) => setEditing({ ...editing, enabled })}
              />
            </div>
            <Alert
              type="info"
              showIcon
              title="停用后不可用于新的正式发布，已发布任务继续保留。改名会同步更新已有任务显示的分类名称。"
            />
          </div>
        )}
      </Modal>
    </main>
  );
}
