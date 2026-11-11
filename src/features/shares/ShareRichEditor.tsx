import { useImperativeHandle, useState, useRef, useEffect, type Ref } from 'react';
import { EditorContent, useEditor, Extension, type JSONContent } from '@tiptap/react';
import { Plugin } from '@tiptap/pm/state';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Button, Input, Modal, Popover, Tooltip } from 'antd';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Link,
  Highlighter,
  Hash,
  Undo2,
  Redo2,
  Maximize2,
  Minimize2,
  Move,
} from 'lucide-react';
import { highlightColors, ShareHighlight } from './shareHighlight';
import { activeTag, matchingTags, ShareTags, extractTags } from './shareTags';
export interface ShareRichEditorHandle {
  focus: () => void;
  insertTag: (name: string) => void;
  getSnapshot: () => { document: JSONContent; text: string };
}
interface Props {
  initial: JSONContent;
  tags: string[];
  tagsLocked?: boolean;
  expanded: boolean;
  detached?: boolean;
  onToggleDetached?: () => void;
  onToggleExpanded: () => void;
  onPasteImages?: (files: File[]) => void;
  ref: Ref<ShareRichEditorHandle>;
}
export function ShareRichEditor({
  initial,
  tags,
  tagsLocked = false,
  expanded,
  detached,
  onToggleDetached,
  onToggleExpanded,
  onPasteImages,
  ref,
}: Props) {
  const pasteImages = useRef(onPasteImages);
  useEffect(() => {
    pasteImages.current = onPasteImages;
  }, [onPasteImages]);
  const locked = useRef(tagsLocked);
  useEffect(() => {
    locked.current = tagsLocked;
  }, [tagsLocked]);
  // The plugin reads the ref only inside ProseMirror transactions, never during render.
  // eslint-disable-next-line react-hooks/refs
  const [tagGuard] = useState(() =>
    Extension.create({
      name: 'shareTagLock',
      addProseMirrorPlugins() {
        return [
          new Plugin({
            filterTransaction(transaction, state) {
              if (!locked.current || !transaction.docChanged) return true;
              const names = (doc: typeof state.doc) =>
                extractTags(doc.textBetween(0, doc.content.size, '\n'))
                  .map((name) => name.toLocaleLowerCase())
                  .sort();
              return JSON.stringify(names(transaction.doc)) === JSON.stringify(names(state.doc));
            },
          }),
        ];
      },
    }),
  );
  const [tagIndex, setTagIndex] = useState(0);
  const [dismissedTag, setDismissedTag] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [highlightOpen, setHighlightOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [linkError, setLinkError] = useState('');
  const editor = useEditor({
    extensions: [
      ShareTags,
      tagGuard,
      ShareHighlight,
      StarterKit.configure({
        heading: false,
        code: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        strike: false,
        underline: false,
        link: { openOnClick: false, autolink: false, protocols: ['https', 'http', 'mailto'] },
      }),
      Placeholder.configure({ placeholder: '此刻有什么想写的？' }),
    ],
    content: initial,
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: {
        class: 'share-rich-content',
        role: 'textbox',
        'aria-label': '记录正文',
        'aria-multiline': 'true',
      },
      handleDOMEvents: {
        compositionstart: () => {
          setComposing(true);
          return false;
        },
        compositionend: () => {
          setComposing(false);
          return false;
        },
      },
      handleKeyDown: (view, event) => {
        if (locked.current) return false;
        if (event.isComposing || view.composing || event.keyCode === 229) return false;
        if (!['Escape', 'ArrowDown', 'ArrowUp', 'Tab', 'Enter'].includes(event.key)) return false;
        const { $from, empty } = view.state.selection;
        const trigger = empty ? activeTag($from.parent.textContent, $from.parentOffset) : null;
        if (!trigger) return false;
        const key = `${$from.start() + trigger.from}:${trigger.query}`;
        if (event.key === 'Escape') {
          setDismissedTag(key);
          event.preventDefault();
          event.stopPropagation();
          return true;
        }
        if (dismissedTag === key) return false;
        const candidates = matchingTags(tags, trigger.query);
        const create =
          trigger.query &&
          !tags.some((tag) => tag.toLocaleLowerCase() === trigger.query.toLocaleLowerCase())
            ? trigger.query
            : null;
        const options = [
          ...candidates,
          ...(create && !candidates.includes(create) ? [create] : []),
        ];
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          if (!options.length) return false;
          event.preventDefault();
          setTagIndex(
            (current) =>
              (current + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length,
          );
          return true;
        }
        if ((event.key === 'Tab' || event.key === 'Enter') && options.length) {
          event.preventDefault();
          view.dispatch(
            view.state.tr.insertText(
              `#${options[tagIndex % options.length]} `,
              $from.start() + trigger.from,
              $from.start() + trigger.to,
            ),
          );
          setTagIndex(0);
          return true;
        }
        return false;
      },
      handlePaste: (_, event) => {
        const files = Array.from(event.clipboardData?.files ?? []);
        if (!files.length) return false;
        event.preventDefault();
        const images = files.filter((file) => file.type.startsWith('image/'));
        if (images.length) pasteImages.current?.(images);
        return true;
      },
      handleDrop: (_, event) => {
        if (!event.dataTransfer?.files.length) return false;
        event.preventDefault();
        return true;
      },
    },
  });
  useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        editor?.commands.focus();
      },
      insertTag: (name: string) => {
        if (!editor || tagsLocked) return;
        const { $from, from, to, empty } = editor.state.selection;
        const trigger = empty ? activeTag($from.parent.textContent, $from.parentOffset) : null;
        const before = $from.parent.textContent.slice(0, $from.parentOffset);
        const start = trigger ? $from.start() + trigger.from : from;
        const prefix = !trigger && before && !/\s$/.test(before) ? ' ' : '';
        editor.chain().focus().insertContentAt({ from: start, to }, `${prefix}#${name} `).run();
        setTagIndex(0);
        setDismissedTag(null);
      },
      getSnapshot: () => ({
        document: editor?.getJSON() ?? initial,
        text: editor?.getText() ?? '',
      }),
    }),
    [editor, initial, tagsLocked],
  );
  if (!editor) return null;
  const textLength = editor.getText().length;
  const { $from, empty } = editor.state.selection;
  const trigger = empty ? activeTag($from.parent.textContent, $from.parentOffset) : null;
  const triggerKey = trigger ? `${$from.start() + trigger.from}:${trigger.query}` : '';
  const tagOptions = trigger ? matchingTags(tags, trigger.query) : [];
  const createTag =
    trigger?.query &&
    !tags.some((tag) => tag.toLocaleLowerCase() === trigger.query.toLocaleLowerCase())
      ? trigger.query
      : null;
  const options = [
    ...tagOptions,
    ...(createTag && !tagOptions.includes(createTag) ? [createTag] : []),
  ];
  const showTags =
    !tagsLocked && trigger && dismissedTag !== triggerKey && !composing && editor.isFocused;
  const coords = showTags ? editor.view.coordsAtPos(editor.state.selection.from) : null;
  const selectTag = (name: string) => {
    if (!trigger) return;
    editor
      .chain()
      .focus()
      .insertContentAt({ from: $from.start() + trigger.from, to: $from.start() + trigger.to }, [
        { type: 'text', text: `#${name}` },
        { type: 'text', text: ' ' },
      ])
      .run();
    setTagIndex(0);
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
      label: '插入链接',
      icon: Link,
      active: editor.isActive('link'),
      run: () => {
        setUrl(String(editor.getAttributes('link').href ?? ''));
        setLinkError('');
        setLinkOpen(true);
      },
    },
  ];
  const saveLink = () => {
    const href = url.trim();
    if (href && !/^(https?:\/\/|mailto:)/i.test(href)) {
      setLinkError('请输入以 https://、http:// 或 mailto: 开头的链接');
      return;
    }
    try {
      if (href) new URL(href);
    } catch {
      setLinkError('请输入有效的链接');
      return;
    }
    if (!href) editor.chain().focus().extendMarkRange('link').unsetLink().run();
    else if (editor.state.selection.empty && !editor.isActive('link'))
      editor
        .chain()
        .focus()
        .insertContent({ type: 'text', text: href, marks: [{ type: 'link', attrs: { href } }] })
        .run();
    else editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    setLinkOpen(false);
  };
  return (
    <div className="share-rich-editor">
      <div className="share-rich-toolbar" role="toolbar" aria-label="正文格式">
        <Tooltip title="添加标签">
          <Button
            type="text"
            aria-label="添加正文标签"
            icon={<Hash size={16} />}
            disabled={tagsLocked}
            title={tagsLocked ? '标签合并中' : '插入标签'}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setDismissedTag(null);
              setTagIndex(0);
              const before = editor.state.selection.$from.parent.textContent.slice(
                0,
                editor.state.selection.$from.parentOffset,
              );
              editor
                .chain()
                .focus()
                .insertContent(before && !/\s$/.test(before) ? ' #' : '#')
                .run();
            }}
          />
        </Tooltip>
        {actions.map(({ label, icon: Icon, active, run }) => (
          <Tooltip title={label} key={label}>
            <Button
              type="text"
              aria-label={label}
              aria-pressed={active}
              className={active ? 'is-active' : ''}
              icon={<Icon size={16} />}
              onMouseDown={(event) => event.preventDefault()}
              onClick={run}
            />
          </Tooltip>
        ))}
        <Popover
          trigger="click"
          open={highlightOpen}
          onOpenChange={setHighlightOpen}
          placement="bottomLeft"
          content={
            <div className="share-highlight-picker">
              <span>文本背景色</span>
              <div>
                {highlightColors.map((color) => (
                  <Tooltip title={color.label} key={color.value}>
                    <Button
                      type="text"
                      aria-label={`${color.label}背景色`}
                      aria-pressed={editor.isActive('highlight', { color: color.value })}
                      className="share-highlight-color"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        editor.chain().focus().setMark('highlight', { color: color.value }).run();
                        setHighlightOpen(false);
                      }}
                    >
                      <i data-highlight={color.value} />
                    </Button>
                  </Tooltip>
                ))}
              </div>
              <Button
                type="text"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  editor.chain().focus().unsetMark('highlight').run();
                  setHighlightOpen(false);
                }}
              >
                清除背景色
              </Button>
            </div>
          }
        >
          <Button
            type="text"
            aria-label="文本背景色"
            aria-pressed={editor.isActive('highlight')}
            className={editor.isActive('highlight') ? 'is-active' : ''}
            icon={<Highlighter size={16} />}
            onMouseDown={(event) => event.preventDefault()}
          />
        </Popover>
        <span className="share-rich-divider" />
        <Button
          type="text"
          aria-label="撤销"
          disabled={!editor.can().undo()}
          icon={<Undo2 size={16} />}
          onClick={() => editor.chain().focus().undo().run()}
        />
        <Button
          type="text"
          aria-label="重做"
          disabled={!editor.can().redo()}
          icon={<Redo2 size={16} />}
          onClick={() => editor.chain().focus().redo().run()}
        />
        {onToggleDetached && (
          <Button
            type="text"
            className="share-editor-detach"
            aria-label={detached ? '恢复居中编辑' : '悬浮编辑'}
            title={detached ? '恢复居中编辑' : '悬浮编辑'}
            aria-pressed={Boolean(detached)}
            icon={<Move size={15} />}
            onMouseDown={(event) => event.preventDefault()}
            onClick={onToggleDetached}
          >
            {!detached && '悬浮'}
          </Button>
        )}
        <Button
          type="text"
          className="share-editor-expand"
          aria-label={expanded ? '缩小编辑器' : '放大编辑器'}
          title={expanded ? '缩小编辑器' : '放大编辑器'}
          aria-pressed={expanded}
          icon={expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          onMouseDown={(event) => event.preventDefault()}
          onClick={onToggleExpanded}
        >
          {!detached && (expanded ? '缩小' : '放大')}
        </Button>
      </div>
      <EditorContent editor={editor} />
      {showTags && coords && (
        <div
          className="share-tag-suggestions"
          role="listbox"
          aria-label="我的标签候选"
          style={{
            left: Math.max(12, Math.min(coords.left, window.innerWidth - 272)),
            top: Math.max(12, Math.min(coords.bottom + 6, window.innerHeight - 300)),
          }}
        >
          <header>我的标签</header>
          {options.length ? (
            options.map((name, index) => (
              <button
                type="button"
                role="option"
                aria-selected={index === tagIndex % options.length}
                key={name}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectTag(name)}
              >
                <Hash size={14} />
                <span>{name}</span>
                {name === createTag && <small>新建</small>}
              </button>
            ))
          ) : (
            <p>继续输入以创建新标签</p>
          )}
          <footer>↑↓ 选择 · 回车确认 · 空格保留输入</footer>
        </div>
      )}
      <div className="share-rich-caption">
        <span>输入 # 添加标签</span>
        <span className={textLength > 20000 ? 'over-limit' : ''}>
          {textLength.toLocaleString()} / 20,000
        </span>
      </div>
      <Modal
        title="插入链接"
        open={linkOpen}
        onCancel={() => setLinkOpen(false)}
        onOk={saveLink}
        okText="确定"
        cancelText="取消"
      >
        <Input
          aria-label="链接地址"
          placeholder="https://"
          value={url}
          onChange={(event) => {
            setUrl(event.target.value);
            setLinkError('');
          }}
          onPressEnter={saveLink}
          status={linkError ? 'error' : undefined}
        />
        {linkError && <p role="alert">{linkError}</p>}
        <p className="share-link-help">清空地址可移除已有链接。</p>
      </Modal>
    </div>
  );
}
