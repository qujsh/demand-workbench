import { Image } from 'antd';
import { Globe2, LockKeyhole } from 'lucide-react';
import type { ShareRecord } from './shareModels';
import { recordDocument, documentImages } from './shareRichTextModel';
import { RichTextView } from './shareRichText';
import { ShareReviewStatus } from './ShareReviewStatus';

type Props = {
  record: ShareRecord;
  full?: boolean;
  retrying: boolean;
  canRetry: boolean;
  onOpen: (record: ShareRecord) => void;
  onTag: (name: string) => void;
  onRetry: (record: ShareRecord) => void;
};
export function ShareRecordContent({
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
      <div className={full ? 'share-record-body full' : 'share-record-body'}>
        {record.document ? (
          <RichTextView document={recordDocument(record.body, record.document)} />
        ) : (
          record.body
        )}
      </div>
      {images.length > 0 && (
        <div className="share-record-images">
          <Image.PreviewGroup items={images}>
            {(full ? images : images.slice(0, 3)).map((src, i) => (
              <div className="share-record-thumbnail" key={src}>
                <Image src={src} alt={`${record.title} 图片 ${i + 1}`} height={full ? 240 : 108} />
                {!full && i === 2 && (record.imageCount ?? images.length) > 3 && (
                  <span
                    className="share-image-more"
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
      <div className="share-record-bottom">
        <div className="share-record-tags">
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
        <div className="share-record-review">
          {!record.draft && !record.deleted && (
            <ShareReviewStatus
              record={record}
              retrying={retrying}
              canRetry={canRetry}
              onRetry={() => {
                onRetry(record);
              }}
            />
          )}
          <span className="share-visibility">
            {record.visibility === 'private' ? <LockKeyhole size={12} /> : <Globe2 size={12} />}
            {record.visibility === 'private' ? '仅自己可见' : '公开分享'}
          </span>
        </div>
      </div>
    </>
  );
}
