import { Fragment, type ReactNode } from 'react';
import type { JSONContent } from '@tiptap/react';

import { tagReadingDocument } from './shareTags';
import { isHighlightColor } from './shareHighlight';
import { safeImage } from './shareRichTextModel';

export function RichTextView({ document }: { document: JSONContent }) {
  const render = (node: JSONContent, key: number): ReactNode => {
    const children = node.content?.map(render);
    if (node.type === 'text') {
      let value: ReactNode = node.text;
      for (const mark of node.marks ?? []) {
        if (mark.type === 'shareTag') value = <span className="share-inline-tag">{value}</span>;
        if (mark.type === 'bold') value = <strong>{value}</strong>;
        if (mark.type === 'highlight' && isHighlightColor(mark.attrs?.color))
          value = <mark data-highlight={mark.attrs.color}>{value}</mark>;
        if (mark.type === 'italic') value = <em>{value}</em>;
        if (mark.type === 'link' && /^(https?:\/\/|mailto:)/i.test(String(mark.attrs?.href)))
          value = (
            <a href={String(mark.attrs?.href)} target="_blank" rel="noopener noreferrer">
              {value}
            </a>
          );
      }
      return <Fragment key={key}>{value}</Fragment>;
    }
    switch (node.type) {
      case 'paragraph':
        return <p key={key}>{children || <br />}</p>;
      case 'bulletList':
        return <ul key={key}>{children}</ul>;
      case 'orderedList':
        return (
          <ol key={key} start={Number(node.attrs?.start) || 1}>
            {children}
          </ol>
        );
      case 'listItem':
        return <li key={key}>{children}</li>;
      case 'hardBreak':
        return <br key={key} />;
      case 'image': {
        const src = safeImage(node.attrs?.src);
        return src ? <img key={key} src={src} alt={String(node.attrs?.alt || '记录图片')} /> : null;
      }
      default:
        return <Fragment key={key}>{children}</Fragment>;
    }
  };
  return <>{tagReadingDocument(document).content?.map(render)}</>;
}
