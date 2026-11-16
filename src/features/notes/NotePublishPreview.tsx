import type { NoteLocation } from './api/amapSdk';
import { useRef, type ReactNode } from 'react';
import { NotePreview } from './NotePreview';
import { NoteMobilePreview } from './NoteMobilePreview';
import { Modal } from 'antd';
import { documentImages } from './noteRichTextModel';
import type { NoteRecord } from './noteModels';

interface Props {
  record: NoteRecord;
  location?: NoteLocation;
  onClose: () => void;
  detail?: boolean;
  actions?: ReactNode;
  status?: ReactNode;
  onOpenReference?: (id: string) => void;
}

/** 与 C 端 NoteReader 一致：图片完整展示，正文按公开详情的纯文本呈现。 */
export function NotePublishPreview({
  record,
  location,
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
      className="note-publish-preview note-publish-preview-comparison"
      style={{ top: 24, outline: 'none' }}
    >
      <header className="note-preview-original-heading note-publish-detail-heading">
        <span>{detail ? '记录详情' : 'C 端展示预览'}</span>
        {detail && actions}
      </header>
      <div className="note-preview-workspace">
        <div className="note-preview-desktop">
          <NotePreview
            location={location}
            record={record}
            images={images}
            detail={detail}
            status={status}
            onOpenReference={onOpenReference}
          />
        </div>
        <NoteMobilePreview record={record} images={images} location={location} />
      </div>
    </Modal>
  );
}
