import { useRef, useState, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Drawer, Image, Spin } from 'antd';
import { Columns2, Layers, FileText, Minus, Move, Maximize2, X } from 'lucide-react';
import dayjs from 'dayjs';
import { getShare } from './api/shareApi';
import { useFloatingRecords } from './hooks/useFloatingRecords';
import type { ShareReference } from './shareModels';
import { RichTextView } from './shareRichText';
import { recordDocument } from './shareRichTextModel';

interface WindowProps {
  id: string;
  index: number;
  layout: number;
  front: number;
  onFocus: () => void;
  onClose: () => void;
  onReference: (refs: ShareReference[], target: string) => void;
  editing: boolean;
  onOpen: (id: string) => void;
}
function FloatingWindow({
  id,
  index,
  layout,
  front,
  onFocus,
  onClose,
  onReference,
  editing,
  onOpen,
}: WindowProps) {
  const query = useQuery({
    queryKey: ['shares', 'floating-detail', id],
    queryFn: () => getShare(id),
  });
  // A layout key rearranges windows on each toggle; normal focusing preserves size and scroll.
  const [position, setPosition] = useState(() => {
    const columns = Math.max(1, Math.floor((window.innerWidth - 32) / 436));
    return {
      x: Math.max(
        8,
        Math.min(
          layout % 2 ? 16 + (index % columns) * 436 : 24 + index * 44,
          window.innerWidth - 436,
        ),
      ),
      y: Math.min(
        window.innerHeight - 220,
        layout % 2 ? 70 + Math.floor(index / columns) * 426 : 70 + index * 28,
      ),
    };
  });
  const [collapsed, setCollapsed] = useState(false);
  const [expandedHeight, setExpandedHeight] = useState('');
  const toggleCollapsed = () => {
    if (!collapsed) setExpandedHeight(frame.current?.style.height ?? '');
    setCollapsed((value) => !value);
  };
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const dragged = useRef(false);
  const start = (event: PointerEvent<HTMLElement>) => {
    const button = event.target instanceof Element ? event.target.closest('button') : null;
    if (
      event.button !== 0 ||
      (button && !button.classList.contains('share-floating-restore-title'))
    )
      return;
    dragged.current = false;
    event.preventDefault();
    onFocus();
    (button ?? event.currentTarget).setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, left: position.x, top: position.y };
  };
  const move = (event: PointerEvent<HTMLElement>) => {
    if (!drag.current) return;
    if (
      Math.hypot(event.clientX - drag.current.x, event.clientY - drag.current.y) < 4 &&
      !dragged.current
    )
      return;
    dragged.current = true;
    const width = frame.current?.offsetWidth ?? 420;
    setPosition({
      x: Math.max(
        4,
        Math.min(
          window.innerWidth - Math.min(width, window.innerWidth) - 4,
          drag.current.left + event.clientX - drag.current.x,
        ),
      ),
      y: Math.max(
        4,
        Math.min(window.innerHeight - 220, drag.current.top + event.clientY - drag.current.y),
      ),
    });
  };
  const record = query.data;
  return createPortal(
    <section
      ref={frame}
      className={`share-floating-window${collapsed ? ' share-floating-window-collapsed' : ''}`}
      role="dialog"
      aria-label={`浮窗 ${record?.title || '记录'}`}
      data-layout={layout}
      style={{
        height: collapsed ? 44 : expandedHeight || undefined,
        left: position.x,
        top: position.y,
        maxWidth: `calc(100vw - ${position.x + 8}px)`,
        maxHeight: `calc(100dvh - ${position.y + 8}px)`,
        zIndex: 1200 + front,
      }}
      onPointerDown={onFocus}
    >
      <header
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        <Move size={14} className="share-floating-drag-icon" aria-hidden="true" />
        {collapsed ? (
          <button
            type="button"
            className="share-floating-restore-title"
            onClick={() => {
              if (!dragged.current) toggleCollapsed();
            }}
            title="拖动调整位置，点击恢复浮窗"
          >
            {record?.title || '一条记录'}
          </button>
        ) : (
          <span>{record?.title || '一条记录'}</span>
        )}
        <Button
          type="text"
          size="small"
          aria-label={collapsed ? '展开浮窗' : '收起浮窗'}
          aria-expanded={!collapsed}
          title={collapsed ? '恢复内容' : '折叠为标题栏'}
          icon={collapsed ? <Maximize2 size={14} /> : <Minus size={15} />}
          onClick={toggleCollapsed}
        />
        <Button
          type="text"
          size="small"
          aria-label="关闭浮窗"
          title="关闭，保留在浮窗列表"
          icon={<X size={15} />}
          onClick={onClose}
        />
      </header>
      <div className="share-floating-body">
        {query.isPending && <Spin />}
        {query.isError && (
          <Alert
            type="error"
            title="记录读取失败"
            action={
              <Button
                onClick={() => {
                  void query.refetch();
                }}
              >
                重试
              </Button>
            }
          />
        )}
        {record && (
          <>
            <small>
              {dayjs(record.date).format('YYYY 年 M 月 D 日 HH:mm')} ·{' '}
              {record.visibility === 'private' ? '仅自己可见' : '公开范围'}
            </small>
            {record.deleted ? (
              <Alert title="原记录已移入回收站" type="info" />
            ) : (
              <>
                <RichTextView document={recordDocument(record.body, record.document)} />
                <div className="share-floating-images">
                  <Image.PreviewGroup>
                    {record.images.map((src) => (
                      <Image key={src} src={src} width={110} />
                    ))}
                  </Image.PreviewGroup>
                </div>
              </>
            )}
            {record.references?.length ? (
              <div className="share-reference-list">
                <strong>关联记录</strong>
                {record.references.map((ref) => (
                  <Button
                    key={ref.recordNo}
                    type="link"
                    disabled={ref.unavailable}
                    onClick={() => onOpen(ref.recordNo)}
                  >
                    {ref.title || '一条记录'} ↗
                  </Button>
                ))}
              </div>
            ) : null}
          </>
        )}
      </div>
      {record && !record.deleted && (
        <footer>
          <Button
            size="small"
            onClick={() =>
              onReference(
                [
                  {
                    recordNo: record.id,
                    title: record.title,
                    occurredAt: record.date,
                    unavailable: false,
                  },
                ],
                editing ? 'current' : 'new',
              )
            }
          >
            {editing ? '引用到当前记录' : '引用到新记录'}
          </Button>
        </footer>
      )}
    </section>,
    document.body,
  );
}
interface Props {
  floating: ReturnType<typeof useFloatingRecords>;
  openIds: string[];
  onOpen: (id: string) => void;
  onClose: (id: string) => void;
  editing: boolean;
  onReference: (refs: ShareReference[], target: string) => void;
  onError: (error: unknown) => void;
}
export function ShareFloating({
  floating,
  openIds,
  onOpen,
  onClose,
  editing,
  onReference,
  onError,
}: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [focusOrder, setFocusOrder] = useState<string[]>([]);
  const [layout, setLayout] = useState(0);
  const items = floating.query.data ?? [];
  const focus = (id: string) =>
    setFocusOrder((order) => [...order.filter((value) => value !== id), id]);
  const shelf = (
    <section className="share-floating-shelf" aria-label="浮窗记录列表">
      <header>
        <h2>
          浮窗记录 <small>{items.length}</small>
        </h2>
        <Button
          type="text"
          size="small"
          disabled={!openIds.length}
          icon={layout % 2 ? <Layers size={14} /> : <Columns2 size={14} />}
          title={layout % 2 ? '将已打开的浮窗错位堆叠' : '将已打开的浮窗平铺排列'}
          onClick={() => {
            setFocusOrder([]);
            setLayout((value) => value + 1);
          }}
        >
          {layout % 2 ? '堆叠' : '平铺'}
        </Button>
      </header>
      {floating.query.isError && (
        <Alert
          type="error"
          title="浮窗列表加载失败"
          action={
            <Button
              onClick={() => {
                void floating.query.refetch();
              }}
            >
              重试
            </Button>
          }
        />
      )}
      {items.length ? (
        <div className="share-floating-items">
          {items.map((item) => (
            <div className="share-floating-item" key={item.recordNo}>
              <button
                type="button"
                className="share-floating-record-open"
                aria-label={`打开浮窗 ${item.title || '一条记录'}`}
                disabled={item.unavailable}
                onClick={() => {
                  onOpen(item.recordNo);
                  focus(item.recordNo);
                }}
              >
                <FileText size={16} className="share-floating-record-icon" aria-hidden="true" />
                <span className="share-floating-record-text">
                  <span>{item.title || '一条记录'}</span>
                  <small>
                    {item.occurredAt ? dayjs(item.occurredAt).format('YYYY-MM-DD') : ''}
                    {item.unavailable
                      ? ' · 不可用'
                      : openIds.includes(item.recordNo)
                        ? ' · 已打开'
                        : ''}
                  </small>
                </span>
              </button>
              <Button
                type="text"
                size="small"
                aria-label={`移出浮窗列表 ${item.title || '记录'}`}
                icon={<X size={13} />}
                loading={floating.write.isPending}
                onClick={() => {
                  void floating.write
                    .mutateAsync({ id: item.recordNo, remove: true })
                    .then(() => {
                      onClose(item.recordNo);
                    })
                    .catch(onError);
                }}
              />
            </div>
          ))}
        </div>
      ) : (
        <p>点击记录上的“加入浮窗”，对照阅读并整理引用。</p>
      )}
    </section>
  );
  return (
    <>
      {shelf}
      {createPortal(
        <Button className="share-floating-mobile-trigger" onClick={() => setMobileOpen(true)}>
          浮窗记录 · {items.length}
        </Button>,
        document.body,
      )}
      <Drawer title="浮窗记录" open={mobileOpen} onClose={() => setMobileOpen(false)} size={340}>
        {shelf}
      </Drawer>
      {openIds.map((id, index) => (
        <FloatingWindow
          key={`${id}-${layout}`}
          id={id}
          index={index}
          layout={layout}
          front={focusOrder.indexOf(id) < 0 ? index : openIds.length + focusOrder.indexOf(id)}
          onFocus={() => focus(id)}
          onClose={() => onClose(id)}
          editing={editing}
          onReference={onReference}
          onOpen={onOpen}
        />
      ))}
    </>
  );
}
