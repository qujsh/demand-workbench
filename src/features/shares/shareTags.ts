import { Extension, type JSONContent } from '@tiptap/react';
import type { Node } from '@tiptap/pm/model';
import { Plugin } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

// Tags start at a paragraph/whitespace boundary; URLs and C# stay ordinary text.
export function tagMatches(text: string) {
  return [...text.matchAll(/(^|\s)#([^\s#]{1,30})(?=\s|$)/gu)].map((match) => ({
    name: match[2],
    from: match.index! + match[1].length,
    to: match.index! + match[0].length,
  }));
}
export function extractTags(text: string): string[] {
  const seen = new Set<string>();
  return tagMatches(text).flatMap(({ name }) => {
    const key = name.toLocaleLowerCase();
    if (seen.has(key)) return [];
    seen.add(key);
    return [name];
  });
}
export function activeTag(text: string, offset: number) {
  const before = text.slice(0, offset);
  const match = /(?:^|\s)#([^\s#]{0,30})$/u.exec(before);
  if (!match || (text[offset] && !/\s/u.test(text[offset]))) return null;
  return { query: match[1], from: offset - match[1].length - 1, to: offset };
}
export function matchingTags(tags: string[], query: string) {
  const key = query.toLocaleLowerCase();
  return [...new Set(tags)]
    .filter((tag) => tag.toLocaleLowerCase().includes(key))
    .sort((a, b) => {
      const rank = (name: string) =>
        name.toLocaleLowerCase() === key ? 0 : name.toLocaleLowerCase().startsWith(key) ? 1 : 2;
      return rank(a) - rank(b);
    })
    .slice(0, 8);
}
function tagDecorations(doc: Node) {
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return;
    for (const tag of tagMatches(node.textContent))
      decorations.push(
        Decoration.inline(pos + 1 + tag.from, pos + 1 + tag.to, { class: 'share-inline-tag' }),
      );
    return false;
  });
  return DecorationSet.create(doc, decorations);
}
export const ShareTags = Extension.create({
  name: 'shareTags',
  addProseMirrorPlugins: () => {
    const plugin: Plugin<DecorationSet> = new Plugin<DecorationSet>({
      state: {
        init: (_, state) => tagDecorations(state.doc),
        apply: (transaction, previous) =>
          transaction.docChanged ? tagDecorations(transaction.doc) : previous,
      },
      props: { decorations: (state) => plugin.getState(state) },
    });
    return [plugin];
  },
});

// Decorate a reading copy, preserving formatting and tags split across text marks.
export function tagReadingDocument(document: JSONContent): JSONContent {
  if (document.type === 'paragraph') {
    const content = document.content ?? [];
    const text = content.map((node) => (node.type === 'text' ? (node.text ?? '') : '\n')).join('');
    const ranges = tagMatches(text);
    let offset = 0;
    return {
      ...document,
      content: content.flatMap((node) => {
        if (node.type !== 'text') {
          offset++;
          return [node];
        }
        const value = node.text ?? '';
        const start = offset;
        offset += value.length;
        const cuts = [
          ...new Set([
            0,
            value.length,
            ...ranges
              .flatMap((range) => [range.from - start, range.to - start])
              .filter((pos) => pos > 0 && pos < value.length),
          ]),
        ].sort((a, b) => a - b);
        return cuts.slice(0, -1).map((from, index) => ({
          ...node,
          text: value.slice(from, cuts[index + 1]),
          marks: [
            ...(node.marks ?? []),
            ...(ranges.some((range) => start + from >= range.from && start + from < range.to)
              ? [{ type: 'shareTag' }]
              : []),
          ],
        }));
      }),
    };
  }
  return {
    ...document,
    ...(document.content ? { content: document.content.map(tagReadingDocument) } : {}),
  };
}
