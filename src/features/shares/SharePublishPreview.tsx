import { useRef, type ReactNode } from 'react';
import { ShareNotePreview } from './ShareNotePreview';
import { ShareMobilePreview } from './ShareMobilePreview';
import { Modal } from 'antd';
import { documentImages } from './shareRichTextModel';
import type { ShareRecord } from './shareModels';

interface Props {
  record: ShareRecord;
  onClose: () => void;
  detail?: boolean;
  actions?: ReactNode;
  status?: ReactNode;
  onOpenReference?: (id: string) => void;
}

/** 与 C 端 NoteReader 一致：图片完整展示，正文按公开详情的纯文本呈现。 */
export function SharePublishPreview({
  record,
  onClose,
  detail = false,
  actions,
  status,
  onOpenReference,
}: Props) {
  const panel = useRef<HTMLDivElement>(null);
  const images = [...new Set([...record.images, ...documentImages(record.document)])];

  return (
    <Modal
      open
      closable={false}
      panelRef={panel}
      afterOpenChange={(open) => {
        if (open) {
          panel.current?.closest<HTMLElement>('[role="dialog"]')?.focus({ preventScroll: true });
        }
      }}
      title={null}
      aria-label={detail ? '记录详情' : 'C 端展示预览'}
      footer={null}
      width={1540}
      styles={{
        container: {
          padding: 0,
          overflow: 'hidden',
          borderRadius: 16,
        },
        header: { padding: '16px 24px', marginBottom: 0 },
      }}
      zIndex={1600}
      onCancel={onClose}
      className="share-publish-preview share-publish-preview-comparison"
      style={{ top: 24, outline: 'none' }}
    >
      <header className="share-preview-original-heading share-publish-detail-heading">
        <span>{detail ? '记录详情' : 'C 端展示预览'}</span>
        {detail && actions}
      </header>
      <div className="share-preview-workspace">
        <div className="share-preview-desktop">
          <ShareNotePreview
            record={record}
            images={images}
            detail={detail}
            status={status}
            onOpenReference={onOpenReference}
          />
        </div>
        <ShareMobilePreview record={record} images={images} />
      </div>
    </Modal>
  );
}
