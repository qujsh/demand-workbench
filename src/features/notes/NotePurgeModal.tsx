import { Modal } from 'antd';
import type { NoteRecord } from './noteModels';

interface Props {
  record: NoteRecord;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

export function NotePurgeModal({ pending, onCancel, onConfirm }: Props) {
  return (
    <Modal
      open
      width={420}
      classNames={{ body: 'note-purge-body' }}
      styles={{
        container: { padding: 24 },
        header: { marginBottom: 12 },
        title: { fontSize: 16, lineHeight: '24px', fontWeight: 600 },
        footer: { marginTop: 24 },
      }}
      title="彻底删除这条笔记？"
      okText="彻底删除"
      cancelText="取消"
      okButtonProps={{ danger: true }}
      confirmLoading={pending}
      cancelButtonProps={{ disabled: pending }}
      closable={false}
      maskClosable={!pending}
      keyboard={!pending}
      onCancel={onCancel}
      onOk={onConfirm}
    >
      <p>删除后无法恢复，文件图片也将一并删除！</p>
    </Modal>
  );
}
