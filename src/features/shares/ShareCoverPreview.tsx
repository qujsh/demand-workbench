import { useState } from 'react';
import { Heart } from 'lucide-react';
import { avatarUrl } from '../auth';
import type { ShareRecord } from './shareModels';
import './shareCoverPreview.css';

interface Props {
  record: ShareRecord;
  images: string[];
  author: string;
  avatarMediaNo?: string | null;
}

/** 对齐 C 端 NoteCard 与公开列表摘要规则；不发起互动或生成虚假统计。 */
export function ShareCoverPreview({ record, images, author, avatarMediaNo }: Props) {
  const [ratio, setRatio] = useState(1);
  const [failed, setFailed] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const hasImage = Boolean(images[0]) && !failed;
  const summary = record.body.slice(0, 160);
  const titleIsExcerpt = !record.title.trim();
  const title = record.title.trim() || summary.slice(0, 40) || '图片分享';
  const palette = [...record.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 3;
  const shortText = titleIsExcerpt && summary.length < 45;
  const avatar = avatarUrl(avatarMediaNo);
  return (
    <section className="share-cover-stage" aria-label="封面预览">
      <p className="share-cover-hint">C 端列表卡片效果 · 按实际卡片宽度展示</p>
      <article className="share-cover-card" aria-label="C 端笔记卡片">
        {hasImage ? (
          <>
            <div className="share-cover-visual" style={{ aspectRatio: ratio }}>
              <img
                src={images[0]}
                alt="笔记封面"
                onError={() => setFailed(true)}
                onLoad={(event) => {
                  const image = event.currentTarget;
                  setRatio(Math.min(1.5, Math.max(0.75, image.naturalWidth / image.naturalHeight)));
                }}
              />
            </div>
            <strong className="share-cover-title">{title}</strong>
          </>
        ) : (
          <div
            className={`share-cover-text share-cover-palette-${palette}${shortText ? ' share-cover-short' : ''}`}
          >
            {!titleIsExcerpt && <strong className="share-cover-text-title">{title}</strong>}
            <span className="share-cover-excerpt">{summary || title}</span>
          </div>
        )}
        <footer className="share-cover-footer">
          <span className="share-cover-author">
            {avatar && !avatarFailed ? (
              <img src={avatar} alt="" onError={() => setAvatarFailed(true)} />
            ) : (
              <span className="share-cover-initial">{author.slice(0, 1)}</span>
            )}
            <span className="share-cover-author-name">{author}</span>
          </span>
          <span className="share-cover-like">
            <Heart size={17} />赞
          </span>
        </footer>
      </article>
      <p className="share-cover-caption">
        {hasImage
          ? '第一张图片作为封面，标题最多显示两行。'
          : '无配图时展示文字卡片，摘要最多取正文前 160 字。'}
      </p>
    </section>
  );
}
