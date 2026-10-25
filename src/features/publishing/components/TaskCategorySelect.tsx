import { useState } from 'react';
import { Alert, Button, Input, Modal, Select, message } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createTaskCategory, getTaskCategories } from '../api/taskContentApi';
export function TaskCategorySelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [toast, holder] = message.useMessage();
  const query = useQuery({
    queryKey: ['task-categories'],
    queryFn: ({ signal }) => getTaskCategories(signal),
  });
  const create = useMutation({
    mutationFn: () => createTaskCategory(name),
    onSuccess: async (category) => {
      await client.invalidateQueries({ queryKey: ['task-categories'] });
      onChange(category.code);
      setOpen(false);
      setName('');
    },
    onError: (error: Error) => {
      void toast.error(error.message);
    },
  });
  const choices = (query.data ?? []).map((item) => ({ value: item.code, label: item.name }));
  if (value && !choices.some((item) => item.value === value))
    choices.push({ value, label: `${value}（历史分类）` });
  return (
    <>
      {holder}
      <div style={{ display: 'flex', gap: 8 }}>
        <Select
          aria-label="任务分类"
          className="publish-select"
          style={{ flex: 1, minWidth: 0 }}
          value={value || undefined}
          placeholder="选择分类"
          loading={query.isPending}
          showSearch
          optionFilterProp="label"
          options={choices}
          onChange={onChange}
        />
        <Button onClick={() => setOpen(true)}>新增分类</Button>
      </div>
      {query.isError && (
        <Alert
          type="error"
          title={query.error.message}
          action={<Button onClick={() => void query.refetch()}>重试</Button>}
        />
      )}
      <Modal
        title="新增任务分类"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => create.mutate()}
        confirmLoading={create.isPending}
        okButtonProps={{ disabled: !name.trim() }}
        destroyOnHidden
      >
        <p>新增后 B/C 共用。同名分类将复用已有编号。</p>
        <Input
          aria-label="新分类名称"
          value={name}
          maxLength={64}
          onChange={(event) => setName(event.target.value)}
        />
      </Modal>
    </>
  );
}
