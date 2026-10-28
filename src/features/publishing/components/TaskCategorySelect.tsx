import { Alert, Button, Select } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { getManagedTaskCategories } from '../api/taskContentApi';
export function TaskCategorySelect({
  value,
  onChange,
  onCreate,
}: {
  value: string;
  onChange: (value: string) => void;
  onCreate: () => void;
}) {
  const query = useQuery({
    queryKey: ['managed-task-categories', ''],
    queryFn: ({ signal }) => getManagedTaskCategories('', signal),
  });
  const choices = (query.data ?? []).map((item) => ({
    value: item.code,
    label: item.enabled ? item.name : `${item.name}（已停用）`,
    disabled: !item.enabled,
  }));
  if (value && !choices.some((item) => item.value === value))
    choices.push({ value, label: `${value}（历史分类）`, disabled: true });
  return (
    <>
      <div className="task-category-control">
        <Select
          aria-label="任务分类"
          className="publish-select"
          value={value || undefined}
          placeholder="选择分类"
          loading={query.isPending}
          showSearch
          optionFilterProp="label"
          options={choices}
          onChange={onChange}
        />
        <Button onClick={onCreate}>新增分类</Button>
      </div>
      {query.isError && (
        <Alert
          type="error"
          title={query.error.message}
          action={<Button onClick={() => void query.refetch()}>重试</Button>}
        />
      )}
    </>
  );
}
