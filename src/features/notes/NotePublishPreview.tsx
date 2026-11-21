import type { NoteLocation } from './api/amapSdk';
import { useRef, type ReactNode } from 'react';
import { NotePreview } from './NotePreview';
import { NoteMobilePreview } from './NoteMobilePreview';
import { Button, Modal } from 'antd';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { documentImages } from './noteRichTextModel';
import type { NoteRecord } from './noteModels';

interface Props {
  navigation?: {
    previous: boolean;
    next: boolean;
    loading: boolean;
    disabled: boolean;
    move: (direction: 'previous' | 'next') => Promise<void>;
  };
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
  navigation,
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
      width={navigation ? 'min(1540px, calc(100vw - 128px))' : 1540}
      styles={{
        mask: navigation ? { backgroundColor: 'rgba(0, 0, 0, 0.72)' } : undefined,
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
        {detail && navigation && (
          <nav
            aria-label="切换笔记"
            aria-busy={navigation.loading}
            className="note-detail-navigation"
          >
            {navigation.previous && (
              <Button
                type="text"
                aria-label="上一条笔记"
                title="上一条笔记"
                className="note-detail-arrow note-detail-arrow-previous"
                disabled={navigation.disabled}
                icon={<ChevronLeft size={56} strokeWidth={1.8} />}
                onClick={() => void navigation.move('previous')}
              />
            )}
            {navigation.next && (
              <Button
                type="text"
                aria-label="下一条笔记"
                title="下一条笔记"
                className="note-detail-arrow note-detail-arrow-next"
                disabled={navigation.disabled}
                icon={<ChevronRight size={56} strokeWidth={1.8} />}
                onClick={() => void navigation.move('next')}
              />
            )}
          </nav>
        )}
        <span>{detail ? '记录详情' : 'C 端展示预览'}</span>
        {detail && actions}
      </header>
      <div
        key={record.id}
        className={`note-preview-workspace${detail && navigation ? ' note-detail-content' : ''}`}
      >
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
