import type { NoteLocation } from './api/amapSdk';
import { Avatar, Button } from 'antd';
import { ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import dayjs from 'dayjs';
import { useAuth } from '../auth/authContext';
import { avatarUrl } from '../auth';
import { useNoteGalleryDrag } from './hooks/useNoteGalleryDrag';
import type { NoteRecord } from './noteModels';
import type { ReactNode } from 'react';

interface Props {
  record: NoteRecord;
  location?: NoteLocation;
  images: string[];
  detail?: boolean;
  status?: ReactNode;
  onOpenReference?: (id: string) => void;
}
export function NotePreview({
  record,
  location = record.location ?? undefined,
  images,
  detail = false,
  status,
  onOpenReference,
}: Props) {
  const { user } = useAuth();
  const { track, active, go, handlers } = useNoteGalleryDrag(images.length);
  return (
    <article className={`note-publish-note${images.length ? ' note-publish-note-media' : ''}`}>
      {!!images.length && (
        <section className="note-publish-gallery" aria-label="预览图片">
          <div
            className="note-publish-track"
            ref={track}
            {...handlers}
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                event.preventDefault();
                go(
                  Math.max(
                    0,
                    Math.min(images.length - 1, active + (event.key === 'ArrowLeft' ? -1 : 1)),
                  ),
                );
              }
            }}
          >
            {images.map((src, index) => (
              <img
                key={`${src}-${index}`}
                src={src}
                alt={`笔记配图 ${index + 1}`}
                draggable={false}
              />
            ))}
          </div>
          {images.length > 1 && (
            <>
              <Button
                className="note-publish-previous"
                aria-label="上一张图片"
                disabled={active === 0}
                type="text"
                styles={{
                  root: {
                    color: 'white',
                    background: 'transparent',
                    width: 52,
                    minWidth: 52,
                    height: 52,
                    borderRadius: 0,
                    padding: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  },
                  icon: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
                }}
                icon={
                  <span className="note-publish-arrow-disc">
                    <ChevronLeft size={18} strokeWidth={2} />
                  </span>
                }
                onClick={() => go(active - 1)}
              />
              <Button
                className="note-publish-next"
                aria-label="下一张图片"
                disabled={active === images.length - 1}
                type="text"
                styles={{
                  root: {
                    color: 'white',
                    background: 'transparent',
                    width: 52,
                    minWidth: 52,
                    height: 52,
                    borderRadius: 0,
                    padding: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  },
                  icon: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
                }}
                icon={
                  <span className="note-publish-arrow-disc">
                    <ChevronRight size={18} strokeWidth={2} />
                  </span>
                }
                onClick={() => go(active + 1)}
              />
              <span className="note-publish-counter" aria-live="polite">
                {active + 1} / {images.length}
              </span>
              <div className="note-publish-dots" role="group" aria-label="选择图片">
                {images.map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    aria-label={`查看第 ${index + 1} 张图片`}
                    aria-current={active === index ? 'true' : undefined}
                    onClick={() => go(index)}
                  >
                    <span />
                  </button>
                ))}
              </div>
            </>
          )}
        </section>
      )}
      <div className="note-publish-reading">
        <header className="note-publish-author">
          <Avatar
            size={38}
            src={avatarUrl(user.avatarMediaNo)}
            style={{ background: '#f7e8dc', color: '#8a4b2d' }}
          >
            {user.nickname.slice(0, 1)}
          </Avatar>
          <div>
            <strong>{user.nickname}</strong>
            <span>
              {dayjs(record.date).format('YYYY年M月D日 HH:mm')} ·{' '}
              {detail ? (record.visibility === 'public' ? '公开笔记' : '仅自己可见') : '公开笔记'}
            </span>
          </div>
        </header>
        {record.title.trim() && <h1>{record.title}</h1>}
        <div className="note-publish-body">{record.body || '暂无正文'}</div>
        {!!record.references?.length && (
          <section className="note-publish-references">
            <h3>关联笔记</h3>
            {record.references.map((reference) => (
              <p key={reference.recordNo}>
                {onOpenReference ? (
                  <Button
                    type="link"
                    disabled={reference.unavailable}
                    onClick={() => onOpenReference(reference.recordNo)}
                  >
                    {reference.unavailable ? '关联笔记暂不可用' : reference.title || '查看关联笔记'}
                  </Button>
                ) : reference.unavailable ? (
                  '关联笔记暂不可用'
                ) : (
                  reference.title || '查看关联笔记'
                )}
              </p>
            ))}
          </section>
        )}
        {location && (
          <p className="note-preview-location" title={location.address || undefined}>
            <MapPin size={15} aria-hidden="true" />
            <span>{location.name}</span>
          </p>
        )}
        {status}
      </div>
    </article>
  );
}
