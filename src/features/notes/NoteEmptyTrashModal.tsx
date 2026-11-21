import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Modal, Spin } from 'antd';
import { getTrashPreview } from './api/noteApi';

interface Props {
  pending: boolean;
  onCancel: () => void;
  onConfirm: (fingerprint: string) => Promise<void>;
}
export function NoteEmptyTrashModal({ pending, onCancel, onConfirm }: Props) {
  const preview = useQuery({
    queryKey: ['notes', 'trash-preview'],
    queryFn: ({ signal }) => getTrashPreview(signal),
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
  const ready = !!preview.data?.recordCount && !preview.isFetching && !preview.isError;
  return (
    <Modal
      open
      width={420}
      title="清空回收站？"
      okText="清空回收站"
      cancelText="取消"
      okButtonProps={{ danger: true, disabled: !ready }}
      confirmLoading={pending}
      cancelButtonProps={{ disabled: pending }}
      closable={false}
      maskClosable={!pending}
      keyboard={!pending}
      classNames={{ body: 'note-purge-body' }}
      styles={{
        container: { padding: 24 },
        header: { marginBottom: 12 },
        footer: { marginTop: 24 },
      }}
      onCancel={onCancel}
      onOk={async () => {
        if (!ready || pending || !preview.data) return;
        try {
          await onConfirm(preview.data.fingerprint);
        } catch {
          void preview.refetch();
        }
      }}
    >
      {preview.isFetching ? (
        <Spin size="small" />
      ) : preview.isError ? (
        <Alert
          type="error"
          title="无法获取回收站数量"
          action={
            <Button size="small" onClick={() => void preview.refetch()}>
              重试
            </Button>
          }
        />
      ) : preview.data?.recordCount ? (
        <p>
          将清空全部 {preview.data.recordCount}{' '}
          条回收站笔记，删除后无法恢复，文件图片也将一并删除！
        </p>
      ) : (
        <p>回收站已为空。</p>
      )}
    </Modal>
  );
}
