import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/react';
import { requirementEditorExtensions } from './requirementEditorConfig';

function create(content: string) {
  return new Editor({ extensions: requirementEditorExtensions, content, contentType: 'markdown' });
}

describe('需求富文本保存与回显', () => {
  it('旧纯文本中的换行仍保留，复制时不包含格式标记', () => {
    const editor = create('书店摄影\n下周交付');
    expect(editor.getText()).toContain('书店摄影\n下周交付');
    editor.destroy();
  });
  it('格式化内容经过文本字段存储后可恢复加粗、斜体、列表和链接', () => {
    const editor = create(
      '**目标**与*说明*和++重点++\n\n- 拍摄\n- 修图\n\n1. 确认\n2. 交付\n\n[参考](https://example.com)',
    );
    const stored = editor.getMarkdown();
    const reopened = create(stored);
    expect(reopened.getHTML()).toContain('<strong>目标</strong>');
    expect(reopened.getHTML()).toContain('<em>说明</em>');
    expect(reopened.getHTML()).toContain('<u>重点</u>');
    expect(reopened.getHTML()).toContain('<ul>');
    expect(reopened.getHTML()).toContain('<ol>');
    expect(reopened.getHTML()).toContain('href="https://example.com"');
    expect(reopened.getText()).not.toContain('**');
    editor.destroy();
    reopened.destroy();
  });
  it('不恢复脚本、事件属性和危险链接', () => {
    const editor = create(
      '<script>alert(1)</script><p onclick="alert(1)">内容</p><a href="javascript:alert(1)">链接</a>',
    );
    expect(editor.getHTML()).not.toMatch(/<script|onclick=|href="javascript:/);
    editor.destroy();
  });
});
