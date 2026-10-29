import { useState } from 'react';
import { Alert, Button, Input, Modal, Table } from 'antd';
import { useQuery } from '@tanstack/react-query';
import {
  getCategoryMigrations,
  getCategoryMigrationTasks,
  type CategoryMigration,
} from '../api/categoryMigrationApi';
export function CategoryMigrationHistory() {
  const [keyword, setKeyword] = useState('');
  const [selected, setSelected] = useState<CategoryMigration>();
  const query = useQuery({
    queryKey: ['category-migrations', keyword],
    queryFn: ({ signal }) => getCategoryMigrations(keyword, signal),
  });
  const tasks = useQuery({
    queryKey: ['category-migration-tasks', selected?.migrationNo],
    queryFn: ({ signal }) => getCategoryMigrationTasks(selected!.migrationNo, signal),
    enabled: !!selected,
  });
  return (
    <>
      <div className="category-list-toolbar">
        <strong>删除与迁移记录</strong>
        <Input.Search
          aria-label="搜索分类迁移记录"
          placeholder="旧分类名称、编号或任务编号"
          allowClear
          maxLength={64}
          style={{ width: 300 }}
          onSearch={(value) => setKeyword(value.trim())}
        />
      </div>
      <p className="category-edit-note">
        这里保留删除时的分类名称和任务清单；任务后来再次迁移，也不会覆盖本次记录。
      </p>
      {query.isError && (
        <Alert
          type="error"
          title={query.error.message}
          action={<Button onClick={() => void query.refetch()}>重试</Button>}
        />
      )}
      <Table
        rowKey="migrationNo"
        loading={query.isPending}
        dataSource={query.data ?? []}
        pagination={{ pageSize: 10 }}
        locale={{ emptyText: '暂无迁移记录' }}
        columns={[
          {
            title: '原分类',
            render: (_, row: CategoryMigration) => (
              <>
                {row.sourceName}
                <small style={{ display: 'block' }}>{row.sourceCode}</small>
              </>
            ),
          },
          {
            title: '迁入分类',
            dataIndex: 'targetName',
            render: (value) => value || '无关联任务，直接删除',
          },
          { title: '任务数', dataIndex: 'taskCount' },
          { title: '操作人', dataIndex: 'actorName', render: (value) => value || '账号不可用' },
          {
            title: '操作时间',
            dataIndex: 'createdAt',
            render: (value: string) => value.replace('T', ' '),
          },
          {
            title: '操作',
            render: (_, row: CategoryMigration) => (
              <Button type="link" onClick={() => setSelected(row)}>
                查看任务
              </Button>
            ),
          },
        ]}
      />
      <Modal
        title={selected ? `「${selected.sourceName}」迁移的任务` : ''}
        open={!!selected}
        onCancel={() => setSelected(undefined)}
        footer={<Button onClick={() => setSelected(undefined)}>关闭</Button>}
        width={800}
      >
        {selected && (
          <p>
            {selected.sourceName} → {selected.targetName || '无迁入分类'} · {selected.taskCount}{' '}
            个任务
          </p>
        )}
        {tasks.isError && (
          <Alert
            type="error"
            title={tasks.error.message}
            action={<Button onClick={() => void tasks.refetch()}>重试</Button>}
          />
        )}
        <Table
          rowKey="taskNo"
          dataSource={tasks.data ?? []}
          loading={tasks.isPending}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: '删除时没有关联任务' }}
          columns={[
            { title: '任务编号', dataIndex: 'taskNo' },
            { title: '当时任务名称', dataIndex: 'taskTitle' },
            {
              title: '迁移内容',
              render: (_, row) =>
                [row.formalChanged ? '任务分类' : '', row.draftChanged ? '已保存草稿' : '']
                  .filter(Boolean)
                  .join('、'),
            },
          ]}
        />
      </Modal>
    </>
  );
}
