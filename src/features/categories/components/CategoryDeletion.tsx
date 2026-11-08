import { useState } from 'react';
import { Alert, Button, Modal, Select, message } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteCategory, getCategoryUsage } from '../api/categoryMigrationApi';
import { getManagedTaskCategories, type ManagedCategory } from '../api/taskContentApi';
export function CategoryDeletion({ category }: { category: ManagedCategory }) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<string>();
  const client = useQueryClient();
  const [toast, holder] = message.useMessage();
  const usage = useQuery({
    queryKey: ['category-usage', category.code],
    queryFn: ({ signal }) => getCategoryUsage(category.code, signal),
    enabled: open,
  });
  const choices = useQuery({
    queryKey: ['managed-task-categories', ''],
    queryFn: ({ signal }) => getManagedTaskCategories('', signal),
    enabled: open,
  });
  const remove = useMutation({
    mutationFn: () => deleteCategory(category.code, target ?? null),
    onSuccess: async () => {
      window.dispatchEvent(
        new CustomEvent('category-migrated', {
          detail: { sourceCode: category.code, targetCode: target ?? '' },
        }),
      );
      setOpen(false);
      setTarget(undefined);
      await Promise.all(
        ['managed-task-categories', 'task-categories', 'category-migrations', 'category-usage'].map(
          (key) => client.invalidateQueries({ queryKey: [key] }),
        ),
      );
      void toast.success('分类已删除，关联任务迁移记录已保留');
    },
    onError: (error: Error) => {
      void toast.error(error.message);
      void usage.refetch();
    },
  });
  return (
    <>
      {holder}
      <Button
        type="link"
        danger
        onClick={() => {
          setTarget(undefined);
          setOpen(true);
        }}
      >
        删除
      </Button>
      <Modal
        title={`删除分类「${category.name}」`}
        open={open}
        okText="确认删除"
        cancelText="取消"
        confirmLoading={remove.isPending}
        okButtonProps={{
          danger: true,
          disabled:
            usage.isPending ||
            usage.isError ||
            choices.isError ||
            ((usage.data ?? 0) > 0 && !target),
        }}
        onCancel={() => {
          if (!remove.isPending) setOpen(false);
        }}
        onOk={() => remove.mutate()}
      >
        <p>
          {usage.isPending
            ? '正在检查关联任务…'
            : `当前关联 ${usage.data ?? 0} 个任务（含已保存草稿，任务去重）。`}
        </p>
        {(usage.isError || choices.isError) && (
          <Alert
            type="error"
            title="无法加载分类关联，请重试"
            action={
              <Button
                onClick={() => {
                  void usage.refetch();
                  void choices.refetch();
                }}
              >
                重试
              </Button>
            }
          />
        )}
        <p>有任务时必须选择其他已启用分类；没有关联任务可直接删除。</p>
        <Select
          aria-label="迁入分类"
          style={{ width: '100%' }}
          placeholder="选择迁入分类"
          allowClear
          value={target}
          onChange={setTarget}
          loading={choices.isPending}
          options={(choices.data ?? [])
            .filter((item) => item.enabled && item.code !== category.code)
            .map((item) => ({ label: item.name, value: item.code }))}
        />
        <Alert
          style={{ marginTop: 16 }}
          type="info"
          showIcon
          title="仅迁移当前任务分类和已保存草稿。历史发布版本保持不变，原分类和迁移清单会保留在迁移记录中。"
        />
      </Modal>
    </>
  );
}
