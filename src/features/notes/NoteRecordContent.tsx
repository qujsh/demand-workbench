import { Image } from 'antd';
import { Globe2, LockKeyhole } from 'lucide-react';
import type { NoteRecord } from './noteModels';
import { recordDocument, documentImages } from './noteRichTextModel';
import { RichTextView } from './noteRichText';
import { NoteReviewStatus } from './NoteReviewStatus';

type Props = {
  record: NoteRecord;
  full?: boolean;
  retrying: boolean;
  canRetry: boolean;
  onOpen: (record: NoteRecord) => void;
  onTag: (name: string) => void;
  onRetry: (record: NoteRecord) => void;
};
export function NoteRecordContent({
  record,
  full = false,
  retrying,
  canRetry,
  onOpen,
  onTag,
  onRetry,
}: Props) {
  const images = [...new Set([...record.images, ...documentImages(record.document)])];
  return (
    <>
      <div className={full ? 'note-record-body full' : 'note-record-body'}>
        {record.document ? (
          <RichTextView document={recordDocument(record.body, record.document)} />
        ) : (
          record.body
        )}
      </div>
      {images.length > 0 && (
        <div className="note-record-images">
          <Image.PreviewGroup items={images}>
            {(full ? images : images.slice(0, 3)).map((src, i) => (
              <div className="note-record-thumbnail" key={src}>
                <Image src={src} alt={`${record.title} 图片 ${i + 1}`} height={full ? 240 : 108} />
                {!full && i === 2 && (record.imageCount ?? images.length) > 3 && (
                  <span
                    className="note-image-more"
                    onClick={() => {
                      onOpen(record);
                    }}
                  >
                    +{(record.imageCount ?? images.length) - 3}
                  </span>
                )}
              </div>
            ))}
          </Image.PreviewGroup>
        </div>
      )}
      <div className="note-record-bottom">
        <div className="note-record-tags">
          {record.tags.map((name) => (
            <button
              key={name}
              onClick={() => {
                onTag(name);
              }}
            >
              # {name}
            </button>
          ))}
        </div>
        <div className="note-record-review">
          {!record.draft && !record.deleted && (
            <NoteReviewStatus
              record={record}
              retrying={retrying}
              canRetry={canRetry}
              onRetry={() => {
                onRetry(record);
              }}
            />
          )}
          <span className="note-visibility">
            {record.visibility === 'private' ? <LockKeyhole size={12} /> : <Globe2 size={12} />}
            {record.visibility === 'private' ? '仅自己可见' : '公开笔记'}
          </span>
        </div>
      </div>
    </>
  );
}
