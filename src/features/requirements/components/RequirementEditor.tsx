import { useEffect, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { Input, Modal } from 'antd';
import { requirementEditorExtensions } from './requirementEditorConfig';
import { Bold, Italic, Underline, Link, List, ListOrdered, Undo2, Redo2, Copy } from 'lucide-react';

export function RequirementEditor({
  value,
  onChange,
  onCopy,
}: {
  value: string;
  onChange: (value: string) => void;
  onCopy: (text: string) => void;
}) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [linkError, setLinkError] = useState('');
  const editor = useEditor({
    extensions: requirementEditorExtensions,
    content: value,
    contentType: 'markdown',
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: {
        class: 'requirement-rich-content',
        role: 'textbox',
        'aria-label': '需求描述',
        'aria-multiline': 'true',
      },
    },
    onUpdate: ({ editor: current }) => onChange(current.isEmpty ? '' : current.getMarkdown()),
  });

  useEffect(() => {
    if (editor && value !== editor.getMarkdown() && !(editor.isEmpty && !value)) {
      editor.commands.setContent(value, { contentType: 'markdown', emitUpdate: false });
    }
  }, [editor, value]);

  if (!editor) return null;
  const saveLink = () => {
    const href = url.trim();
    if (!href) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      try {
        const parsed = new URL(href);
        if (!['https:', 'http:', 'mailto:'].includes(parsed.protocol)) throw new Error();
      } catch {
        setLinkError('请输入有效的 http、https 或 mailto 链接');
        return;
      }
      if (editor.state.selection.empty && !editor.isActive('link')) {
        editor
          .chain()
          .focus()
          .insertContent({ type: 'text', text: href, marks: [{ type: 'link', attrs: { href } }] })
          .run();
      } else editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    }
    setLinkOpen(false);
  };
  const actions = [
    {
      label: '加粗',
      icon: Bold,
      active: editor.isActive('bold'),
      run: () => editor.chain().focus().toggleBold().run(),
    },
    {
      label: '斜体',
      icon: Italic,
      active: editor.isActive('italic'),
      run: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      label: '下划线',
      icon: Underline,
      active: editor.isActive('underline'),
      run: () => editor.chain().focus().toggleUnderline().run(),
    },
    {
      label: '链接',
      icon: Link,
      active: editor.isActive('link'),
      run: () => {
        setUrl(String(editor.getAttributes('link').href ?? ''));
        setLinkError('');
        setLinkOpen(true);
      },
    },
    {
      label: '无序列表',
      icon: List,
      active: editor.isActive('bulletList'),
      run: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      label: '有序列表',
      icon: ListOrdered,
      active: editor.isActive('orderedList'),
      run: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      label: '撤销',
      icon: Undo2,
      disabled: !editor.can().undo(),
      run: () => editor.chain().focus().undo().run(),
    },
    {
      label: '重做',
      icon: Redo2,
      disabled: !editor.can().redo(),
      run: () => editor.chain().focus().redo().run(),
    },
  ];
  return (
    <div className="rich-editor-shell">
      <div className="rich-toolbar" role="toolbar" aria-label="需求描述格式">
        {actions.map(({ label, icon: ToolIcon, active, disabled, run }) => (
          <button
            key={label}
            type="button"
            aria-label={label}
            title={label}
            aria-pressed={active}
            className={active ? 'active' : ''}
            disabled={disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={run}
          >
            <ToolIcon size={15} />
          </button>
        ))}
        <i />
        <button type="button" onClick={() => onCopy(editor.getText())}>
          <Copy size={15} />
          复制描述
        </button>
      </div>
      <EditorContent editor={editor} className="requirement-rich-editor" />
      <Modal
        title="设置链接"
        open={linkOpen}
        onOk={saveLink}
        onCancel={() => setLinkOpen(false)}
        okText="确定"
        cancelText="取消"
      >
        <Input
          aria-label="链接地址"
          value={url}
          onChange={(event) => {
            setUrl(event.target.value);
            setLinkError('');
          }}
          placeholder="https://example.com（留空可移除链接）"
          status={linkError ? 'error' : undefined}
          onPressEnter={saveLink}
        />
        {linkError && <p role="alert">{linkError}</p>}
      </Modal>
    </div>
  );
}
