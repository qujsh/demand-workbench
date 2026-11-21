import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Modal, Radio, Spin } from 'antd';
import { getTagDeleteImpact, type TagDeleteImpact } from './api/noteApi';

interface Props {
  tag: { name: string; tagNo: string };
  canDeleteRecords: boolean;
  onCancel: () => void;
  onDelete: (impact?: TagDeleteImpact) => Promise<void>;
}

export function NoteTagDeleteModal({ tag, canDeleteRecords, onCancel, onDelete }: Props) {
  const [mode, setMode] = useState<'tag' | 'records'>('tag');
  const [pending, setPending] = useState(false);
  const impact = useQuery({
    queryKey: ['notes', 'tag-delete-impact', tag.tagNo],
    queryFn: ({ signal }) => getTagDeleteImpact(tag.tagNo, signal),
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 0,
  });
  const removeRecords = mode === 'records';
  const confirm = async () => {
    if (
      pending ||
      (removeRecords && (!canDeleteRecords || !impact.data || impact.isError || impact.isFetching))
    )
      return;
    setPending(true);
    try {
      await onDelete(removeRecords ? impact.data : undefined);
    } catch {
      if (removeRecords) void impact.refetch();
    } finally {
      setPending(false);
    }
  };
  return (
    <Modal
      open
      title="删除标签"
      onCancel={onCancel}
      onOk={() => void confirm()}
      confirmLoading={pending}
      keyboard={!pending}
      closable={!pending}
      maskClosable={!pending}
      cancelButtonProps={{ disabled: pending }}
      cancelText="取消"
      okText={removeRecords ? '删除标签并移入回收站' : '仅删除标签'}
      okButtonProps={{
        danger: removeRecords,
        disabled:
          removeRecords &&
          (!canDeleteRecords || !impact.data || impact.isFetching || impact.isError),
      }}
    >
      <p className="note-tag-delete-name">#{tag.name}</p>
      <Radio.Group
        className="note-tag-delete-options"
        value={mode}
        disabled={pending}
        onChange={(event) => setMode(event.target.value)}
      >
        <Radio value="tag">
          <strong>仅删除标签</strong>
          <p>移除当前标签及其关联，保留所有笔记。</p>
        </Radio>
        <Radio value="records" disabled={!canDeleteRecords}>
          <strong>删除标签，并删除标签下的所有笔记</strong>
          <p>包含当前及所有子标签关联的笔记，统一移入回收站，可恢复。</p>
        </Radio>
      </Radio.Group>
      {!canDeleteRecords && (
        <p className="note-tag-delete-hint">你没有删除笔记权限，只能删除标签。</p>
      )}
      {removeRecords &&
        (impact.isPending || impact.isFetching ? (
          <Spin size="small" />
        ) : impact.isError ? (
          <Alert
            type="error"
            title="无法获取影响范围，请重试"
            action={
              <Button size="small" onClick={() => void impact.refetch()}>
                重试
              </Button>
            }
          />
        ) : null)}
      <p className="note-tag-delete-hint">
        {removeRecords
          ? '删除当前标签，并将当前及所有子标签关联的笔记移入回收站；子标签保留，笔记可恢复。'
          : '仅删除当前标签，保留所有笔记和子标签。'}
      </p>
    </Modal>
  );
}
