import { useShareEditorLayout } from './hooks/useShareEditorLayout';
import { useRef, useState, useEffect } from 'react';
import { App, Alert, Button, DatePicker, Image, Input, Modal, Select, Spin } from 'antd';
import {
  CalendarDays,
  LockKeyhole,
  Globe2,
  Plus,
  X,
  Hash,
  ExternalLink,
  Check,
  Move,
} from 'lucide-react';
import dayjs from 'dayjs';
import { ShareRichEditor, type ShareRichEditorHandle } from './ShareRichEditor';
import { recordDocument, documentImages } from './shareRichTextModel';
import { uploadShareImage } from './api/shareApi';
import type { useFloatingRecords } from './hooks/useFloatingRecords';
import { extractTags } from './shareTags';
import type { ShareRecord, ShareReference } from './shareModels';

interface Props {
  floating: ReturnType<typeof useFloatingRecords>;
  openFloatingIds: string[];
  incomingReferences?: ShareReference[];
  onOpenReference?: (id: string) => void;
  record?: ShareRecord;
  tags: string[];
  tagsLocked?: boolean;
  onClose: () => void;
  onSave: (record: ShareRecord) => Promise<void>;
}
export function ShareEditor({
  tagsLocked = false,
  floating,
  openFloatingIds,
  record,
  tags,
  onClose,
  onSave,
  incomingReferences = [],
  onOpenReference,
}: Props) {
  const { message, modal } = App.useApp();
  const [references, setReferences] = useState<ShareReference[]>(() =>
    (record?.referenceNos ?? []).map(
      (no) =>
        record?.references?.find((ref) => ref.recordNo === no) ?? {
          recordNo: no,
          title: '关联记录',
          occurredAt: null,
          unavailable: false,
        },
    ),
  );
  const consumedReferences = useRef(new Set<string>());
  useEffect(() => {
    const fresh = incomingReferences.filter(
      (ref) => ref.recordNo !== record?.id && !consumedReferences.current.has(ref.recordNo),
    );
    fresh.forEach((ref) => consumedReferences.current.add(ref.recordNo));
    if (fresh.length)
      setReferences((values) => [
        ...values,
        ...fresh.filter((ref) => !values.some((value) => value.recordNo === ref.recordNo)),
      ]);
  }, [incomingReferences, record?.id]);
  const [saving, setSaving] = useState(false);
  const creatingId = useRef(crypto.randomUUID());
  const imageNumbers = useRef(
    new Map((record?.images ?? []).map((src, index) => [src, record?.mediaNos?.[index] ?? ''])),
  );
  const {
    setDetached,
    expanded,
    setExpanded,
    detached,
    setLayoutNode,
    closeHidden,
    editorPosition,
    setEditorPosition,
    detachedWidth,
    editorDragRef,
    toggleDetached,
  } = useShareEditorLayout();
  const [floatingSearch, setFloatingSearch] = useState('');
  const floatingItems = floating.query.data ?? [];
  const filteredFloating = floatingItems.filter((item) =>
    (item.title || '一条记录')
      .toLocaleLowerCase()
      .includes(floatingSearch.trim().toLocaleLowerCase()),
  );
  const fileInput = useRef<HTMLInputElement>(null);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [readingImages, setReadingImages] = useState(false);
  const [title, setTitle] = useState(record?.title ?? '');
  const [initialDocument] = useState(() => {
    const doc = recordDocument(record?.body ?? '', record?.document);
    const existing = extractTags(record?.body ?? '').map((tag) => tag.toLocaleLowerCase());
    const missing = (record?.tags ?? []).filter(
      (tag) => !existing.includes(tag.toLocaleLowerCase()),
    );
    return missing.length
      ? {
          ...doc,
          content: [
            ...(doc.content ?? []),
            {
              type: 'paragraph',
              content: [{ type: 'text', text: missing.map((tag) => `#${tag}`).join(' ') }],
            },
          ],
        }
      : doc;
  });
  const richEditor = useRef<ShareRichEditorHandle>(null);
  const [initialDate] = useState(() => record?.date ?? dayjs().format('YYYY-MM-DDTHH:mm'));

  const [date, setDate] = useState(initialDate);
  const [visibility, setVisibility] = useState<'private' | 'public'>(
    record?.visibility ?? 'private',
  );
  const [initialImages] = useState(() => [
    ...new Set([...(record?.images ?? []), ...documentImages(record?.document)]),
  ]);
  const [images, setImages] = useState(initialImages);
  const changed =
    references.map((ref) => ref.recordNo).join() !== (record?.referenceNos ?? []).join() ||
    images.join() !== initialImages.join() ||
    title !== (record?.title ?? '') ||
    date !== initialDate ||
    visibility !== (record?.visibility ?? 'private');
  const close = () => {
    if (saving || readingImages) return;
    const snapshot = richEditor.current?.getSnapshot();
    const serialize = (value: unknown) =>
      JSON.stringify(value, (_, item: unknown) =>
        Array.isArray(item) && item.length === 0 ? undefined : item,
      );
    const contentChanged = snapshot && serialize(snapshot.document) !== serialize(initialDocument);
    if (changed || contentChanged) {
      const confirm = modal.confirm({
        title: '离开前如何处理修改？',
        content: '当前内容尚未保存。你可以保存为草稿，或放弃本次修改后离开。',
        okText: '保存草稿',
        cancelText: '放弃修改',
        cancelButtonProps: { danger: true },
        maskClosable: true,
        okButtonProps: { disabled: readingImages },
        onOk: async () => {
          const result = await save(true);
          if (!result) throw new Error('草稿未保存');
        },
        footer: (_, { OkBtn }) => (
          <>
            <Button
              danger
              onClick={() => {
                confirm.destroy();
                onClose();
              }}
            >
              放弃修改
            </Button>
            <OkBtn />
          </>
        ),
      });
    } else onClose();
  };
  const save = async (draft: boolean) => {
    if (saving || readingImages) return false;
    const snapshot = richEditor.current?.getSnapshot();
    if (!snapshot) return false;
    const { document, text: body } = snapshot;
    if (extractTags(body).length > 10) {
      void message.warning('每条记录最多添加 10 个标签');
      return false;
    }
    if (body.length > 20000) {
      void message.warning('正文不能超过 20,000 个字符');
      return false;
    }
    if (!draft && !body.trim() && !images.length && !references.length) {
      void message.warning('写下一点内容、添加图片，或引用已有记录');
      return false;
    }
    const commit = async () => {
      setSaving(true);
      try {
        await onSave({
          ...record,
          id: record?.id ?? creatingId.current,
          title: title.trim(),
          body,
          document,
          tags: extractTags(body),
          date,
          visibility,
          images,
          referenceNos: references.map((ref) => ref.recordNo),
          references,
          mediaNos: images.map((src) => imageNumbers.current.get(src) ?? ''),
          draft,
        });
        return true;
      } catch {
        return false;
      } finally {
        setSaving(false);
      }
    };
    if (!draft && visibility === 'public' && record?.visibility !== 'public') {
      modal.confirm({
        title: '提交公开审核？',
        content: '将审核本次记录的文字和图片，通过后自动公开。审核期间及未通过时，仅自己可见。',
        okText: '提交审核',
        cancelText: '取消',
        onOk: async () => {
          if (!(await commit())) throw new Error('保存失败');
        },
      });
      return false;
    }
    return commit();
  };
  const addImages = async (files: File[]) => {
    const remaining = 9 - images.length;
    const valid = files.filter(
      (file) =>
        ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) &&
        file.size > 0 &&
        file.size <= 10 * 1024 * 1024,
    );
    if (valid.length !== files.length) void message.warning('已跳过不支持或超过 10MB 的图片');
    if (valid.length > remaining)
      void message.warning(`最多添加 9 张图片，本次仅添加前 ${remaining} 张`);
    setReadingImages(true);
    try {
      const results = await Promise.allSettled(
        valid.slice(0, remaining).map((file) => uploadShareImage(file)),
      );
      const added = results.flatMap((result) => {
        if (result.status !== 'fulfilled') return [];
        imageNumbers.current.set(result.value.src, result.value.mediaNo);
        return [result.value.src];
      });
      const failed = results.find((result) => result.status === 'rejected');
      if (failed?.status === 'rejected')
        void message.error(
          failed.reason instanceof Error ? failed.reason.message : '部分图片上传失败，请重试',
        );
      setImages((current) => [...current, ...added].slice(0, 9));
    } finally {
      setReadingImages(false);
    }
  };
  const footer = (
    <footer className="share-editor-footer">
      <div className="share-editor-footer-settings" role="group" aria-label="可见范围设置">
        <Select
          className="share-editor-visibility"
          aria-label="谁可以看"
          size="small"
          prefix={visibility === 'private' ? <LockKeyhole size={14} /> : <Globe2 size={14} />}
          value={visibility}
          disabled={saving}
          options={[
            { value: 'private', label: '仅自己可见' },
            { value: 'public', label: '公开分享' },
          ]}
          onChange={setVisibility}
        />
      </div>
      <div className="share-editor-save-actions">
        {
          <Button disabled={readingImages || saving} onClick={() => save(true)}>
            保存草稿
          </Button>
        }
        <Button
          loading={saving}
          type="primary"
          disabled={readingImages || saving}
          onClick={() => save(false)}
        >
          {visibility === 'public' ? '提交公开审核' : '保存记录'}
        </Button>
      </div>
    </footer>
  );
  return (
    <Modal
      open
      width={detached ? detachedWidth : expanded ? 'calc(100vw - 24px)' : 760}
      zIndex={detached ? 1400 : undefined}
      style={
        detached
          ? {
              position: 'fixed',
              left: editorPosition.x,
              top: editorPosition.y,
              margin: 0,
              paddingBottom: 0,
            }
          : { top: expanded ? 12 : 24 }
      }
      scrollLock={!detached}
      focusable={{ trap: !detached }}
      styles={
        detached
          ? { container: { maxHeight: `calc(100dvh - ${editorPosition.y + 12}px)` } }
          : undefined
      }
      mask={!detached}
      maskClosable={!detached}
      keyboard={!detached}
      wrapClassName={detached ? 'share-editor-detached-wrap' : undefined}
      title={
        detached ? (
          <div
            className="share-editor-drag-bar"
            role="button"
            tabIndex={0}
            aria-label="移动悬浮编辑器"
            onKeyDown={(event) => {
              const offsets: Record<string, [number, number]> = {
                ArrowLeft: [-20, 0],
                ArrowRight: [20, 0],
                ArrowUp: [0, -20],
                ArrowDown: [0, 20],
              };
              const offset = offsets[event.key];
              if (!offset) return;
              event.preventDefault();
              setEditorPosition((point) => ({
                x: Math.max(
                  0,
                  Math.min(
                    window.innerWidth - Math.min(detachedWidth, window.innerWidth - 24),
                    point.x + offset[0],
                  ),
                ),
                y: Math.max(0, Math.min(window.innerHeight - 64, point.y + offset[1])),
              }));
            }}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              editorDragRef.current = {
                x: event.clientX,
                y: event.clientY,
                left: editorPosition.x,
                top: editorPosition.y,
              };
            }}
            onPointerMove={(event) => {
              const drag = editorDragRef.current;
              if (!drag) return;
              setEditorPosition({
                x: Math.max(
                  0,
                  Math.min(
                    window.innerWidth - Math.min(detachedWidth, window.innerWidth - 24),
                    drag.left + event.clientX - drag.x,
                  ),
                ),
                y: Math.max(
                  0,
                  Math.min(window.innerHeight - 64, drag.top + event.clientY - drag.y),
                ),
              });
            }}
            onPointerUp={() => {
              editorDragRef.current = null;
            }}
            onPointerCancel={() => {
              editorDragRef.current = null;
            }}
          >
            <Move size={15} />
            <span>悬浮编辑</span>
            <small>拖动标题栏移动</small>
          </div>
        ) : undefined
      }
      footer={footer}
      onCancel={close}
      aria-label="编辑记录"
      className={`share-editor-modal${closeHidden ? ' share-editor-close-hidden' : ''}${expanded ? ' share-editor-modal-expanded' : ''}${detached ? ' share-editor-modal-detached' : ''}`}
      classNames={{
        container: 'share-modal-container',
        body: 'share-modal-body',
        footer: 'share-modal-footer',
      }}
      destroyOnHidden
    >
      <div
        ref={setLayoutNode}
        inert={saving}
        className={`share-editor-layout share-editor-floating-layout${tags.length > 16 ? ' share-editor-two-column-tags' : ''}`}
      >
        <div className="share-editor-main">
          <div className="share-title-area">
            <Input.TextArea
              aria-label="记录标题"
              variant="borderless"
              className="share-title-input"
              placeholder="给这条记录起个标题（选填）"
              autoSize={{ minRows: 1, maxRows: 3 }}
              maxLength={80}
              value={title}
              onChange={(e) => setTitle(e.target.value.replace(/[\r\n]+/g, ' '))}
              onKeyDown={(event) => {
                if (
                  event.key === 'Enter' &&
                  !event.nativeEvent.isComposing &&
                  event.keyCode !== 229
                ) {
                  event.preventDefault();
                  richEditor.current?.focus();
                }
              }}
            />
            {title.length >= 60 && <span className="share-title-count">{title.length} / 80</span>}
          </div>
          {tagsLocked && (
            <Alert
              type="info"
              title="标签正在合并，暂不可新增或修改标签；正文仍可编辑"
              style={{ marginBottom: 8 }}
            />
          )}
          <ShareRichEditor
            ref={richEditor}
            initial={initialDocument}
            tags={tags}
            expanded={expanded}
            tagsLocked={tagsLocked}
            detached={detached}
            onToggleDetached={toggleDetached}
            onToggleExpanded={() => {
              setDetached(false);
              setExpanded((current) => !current);
            }}
          />
          <Image.PreviewGroup
            items={images}
            preview={{
              open: previewOpen,
              current: previewIndex,
              onOpenChange: setPreviewOpen,
              onChange: setPreviewIndex,
            }}
          />
          <section className="share-picture-area" aria-label="记录图片">
            <header className="share-picture-heading">
              <span>图片</span>
              <span>{images.length} / 9</span>
              <small>支持批量添加</small>
            </header>
            <div className="share-picture-grid">
              {images.length < 9 && (
                <Button
                  className="share-picture-add"
                  type="text"
                  aria-label="批量添加图片"
                  disabled={readingImages || saving}
                  onClick={() => fileInput.current?.click()}
                >
                  <Plus size={24} />
                  <span>{readingImages ? '上传中…' : '添加图片'}</span>
                </Button>
              )}
              {images.map((src, i) => (
                <div className="share-picture-tile" key={`${src}-${i}`}>
                  <button
                    type="button"
                    className="share-picture-preview"
                    aria-label={`放大图片 ${i + 1}`}
                    onClick={() => {
                      setPreviewIndex(i);
                      setPreviewOpen(true);
                    }}
                  >
                    <img src={src} alt={`记录图片 ${i + 1}`} />
                  </button>
                  <span className="share-picture-number">{i + 1}</span>
                  <Button
                    className="share-picture-remove"
                    type="text"
                    size="small"
                    aria-label={`移除图片 ${i + 1}`}
                    icon={<X size={16} />}
                    disabled={readingImages || saving}
                    onClick={() =>
                      setImages((current) => current.filter((_, index) => index !== i))
                    }
                  />
                </div>
              ))}
            </div>
            <input
              ref={fileInput}
              type="file"
              aria-label="选择记录图片"
              multiple
              accept="image/jpeg,image/png,image/webp"
              hidden
              disabled={readingImages || saving}
              onChange={(event) => {
                void addImages(Array.from(event.target.files ?? []));
                event.target.value = '';
              }}
            />
          </section>
          {references.length > 0 && (
            <section className="share-reference-list" aria-label="编辑器关联记录">
              <strong>关联记录 · {references.length}</strong>
              {references.map((ref) => (
                <div className="share-editor-reference-row" key={ref.recordNo}>
                  <Button
                    type="text"
                    className="share-editor-reference-link"
                    disabled={ref.unavailable}
                    onClick={() => onOpenReference?.(ref.recordNo)}
                  >
                    <span className="share-editor-reference-title" title={ref.title || '一条记录'}>
                      {ref.title || '一条记录'}
                    </span>
                    {ref.occurredAt && (
                      <time className="share-editor-reference-date">
                        {dayjs(ref.occurredAt).format('YYYY-MM-DD')}
                      </time>
                    )}
                    <ExternalLink size={14} aria-hidden="true" />
                  </Button>
                  <Button
                    type="text"
                    size="small"
                    aria-label={`移除引用 ${ref.title || '记录'}`}
                    onClick={() =>
                      setReferences((values) =>
                        values.filter((value) => value.recordNo !== ref.recordNo),
                      )
                    }
                  >
                    移除
                  </Button>
                </div>
              ))}
            </section>
          )}
          <div className="share-editor-settings" hidden={expanded}>
            <div>
              <CalendarDays size={16} />
              <span>记录时间</span>
              <DatePicker
                aria-label="记录时间"
                showTime
                format="YYYY-MM-DD HH:mm"
                value={dayjs(date)}
                allowClear={false}
                disabledDate={(value) => value.isAfter(dayjs(), 'day')}
                onChange={(value) => {
                  if (value) setDate(value.format('YYYY-MM-DDTHH:mm'));
                }}
              />
            </div>
          </div>
        </div>
        {expanded && (
          <aside className="share-editor-tag-panel" aria-label="编辑辅助面板">
            <section className="share-editor-tags-section" aria-label="我的标签">
              <header>
                <strong>我的标签</strong>
                <span>{tags.length}</span>
              </header>
              <p>点击标签，插入正文光标处</p>
              <div
                className="share-editor-tag-list"
                style={
                  tags.length > 16
                    ? { gridTemplateRows: `repeat(${Math.ceil(tags.length / 2)}, auto)` }
                    : undefined
                }
              >
                {tags.length ? (
                  tags.map((tag) => (
                    <button
                      type="button"
                      key={tag}
                      disabled={tagsLocked}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => richEditor.current?.insertTag(tag)}
                    >
                      <Hash size={15} />
                      <span>{tag}</span>
                    </button>
                  ))
                ) : (
                  <p>暂无标签，可在正文输入 # 创建</p>
                )}
              </div>
            </section>
            <section className="share-editor-floating-panel" aria-label="浮窗记录">
              <header>
                <strong>浮窗记录</strong>
                <span>{floatingItems.length}</span>
              </header>
              <p>打开记录对照阅读，或引用到当前内容</p>
              <Input.Search
                aria-label="搜索浮窗记录"
                placeholder="搜索浮窗记录"
                allowClear
                value={floatingSearch}
                onChange={(event) => setFloatingSearch(event.target.value)}
              />
              <div className="share-editor-floating-list" aria-label="编辑器浮窗记录列表">
                {floating.query.isPending ? (
                  <Spin size="small" />
                ) : floating.query.isError ? (
                  <Alert
                    type="error"
                    title="列表加载失败"
                    action={
                      <Button
                        size="small"
                        onClick={() => {
                          void floating.query.refetch();
                        }}
                      >
                        重试
                      </Button>
                    }
                  />
                ) : filteredFloating.length ? (
                  filteredFloating.map((item) => {
                    const current = item.recordNo === record?.id;
                    const linked = references.some((ref) => ref.recordNo === item.recordNo);
                    const opened = openFloatingIds.includes(item.recordNo);
                    return (
                      <div className="share-editor-floating-item" key={item.recordNo}>
                        <button
                          type="button"
                          className="share-editor-floating-open"
                          disabled={item.unavailable || current}
                          onClick={() => onOpenReference?.(item.recordNo)}
                        >
                          <strong>{item.title || '一条记录'}</strong>
                          <span>
                            {item.occurredAt
                              ? dayjs(item.occurredAt).format('YYYY-MM-DD')
                              : '日期未知'}
                            {current
                              ? ' · 当前记录'
                              : item.unavailable
                                ? ' · 不可用'
                                : opened
                                  ? ' · 已打开'
                                  : ''}
                          </span>
                        </button>
                        <Button
                          size="small"
                          type="text"
                          icon={linked ? <Check size={13} /> : <Plus size={13} />}
                          disabled={current || item.unavailable || linked}
                          aria-label={`${linked ? '已引用' : '引用'} ${item.title || '一条记录'}`}
                          onClick={() =>
                            setReferences((values) =>
                              values.some((ref) => ref.recordNo === item.recordNo)
                                ? values
                                : [...values, item],
                            )
                          }
                        >
                          {linked ? '已引用' : '引用'}
                        </Button>
                      </div>
                    );
                  })
                ) : (
                  <p className="share-editor-floating-empty">
                    {floatingSearch
                      ? '没有匹配的浮窗记录'
                      : '暂无浮窗记录，可在时间线上选择“加入浮窗”'}
                  </p>
                )}
              </div>
            </section>
          </aside>
        )}
      </div>
    </Modal>
  );
}
