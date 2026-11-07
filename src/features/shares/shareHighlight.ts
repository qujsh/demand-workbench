import { Mark } from '@tiptap/react';

export const highlightColors = [
  { value: 'red', label: '浅红' },
  { value: 'orange', label: '浅橙' },
  { value: 'yellow', label: '浅黄' },
  { value: 'green', label: '浅绿' },
  { value: 'blue', label: '浅蓝' },
  { value: 'purple', label: '浅紫' },
  { value: 'gray', label: '浅灰' },
] as const;
export function isHighlightColor(
  value: unknown,
): value is (typeof highlightColors)[number]['value'] {
  return highlightColors.some((color) => color.value === value);
}
export const ShareHighlight = Mark.create({
  name: 'highlight',
  addAttributes: () => ({
    color: {
      default: 'yellow',
      parseHTML: (element) =>
        isHighlightColor(element.dataset.highlight) ? element.dataset.highlight : 'yellow',
      renderHTML: (attributes) => ({
        'data-highlight': isHighlightColor(attributes.color) ? attributes.color : 'yellow',
      }),
    },
  }),
  parseHTML: () => [{ tag: 'mark' }],
  renderHTML: ({ HTMLAttributes }) => ['mark', HTMLAttributes, 0],
});
