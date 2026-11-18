import type { JSONContent } from '@tiptap/react';

export function recordDocument(body: string, document?: JSONContent): JSONContent {
  const stripImages = (node: JSONContent): JSONContent => ({
    ...node,
    ...(node.content
      ? { content: node.content.filter((child) => child.type !== 'image').map(stripImages) }
      : {}),
  });
  return document
    ? stripImages(document)
    : {
        type: 'doc',
        content: body
          .split('\n')
          .map((text) => ({ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] })),
      };
}
export function documentImages(document?: JSONContent): string[] {
  if (!document) return [];
  return document.type === 'image'
    ? [safeImage(document.attrs?.src)].filter((src): src is string => Boolean(src))
    : (document.content ?? []).flatMap(documentImages);
}
export function safeImage(src: unknown): string | undefined {
  return typeof src === 'string' && /^(https?:\/\/|data:image\/(png|jpeg|webp);base64,)/i.test(src)
    ? src
    : undefined;
}
