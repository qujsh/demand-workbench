import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { Button, Checkbox } from 'antd';
import { GripVertical, X } from 'lucide-react';

const ROW_HEIGHT = 52;
interface Props {
  tags: string[];
  count: (name: string) => number;
  onOrder: (tags: string[]) => void;
  onDelete: (name: string) => void;
  selection?: string[];
  onSelect: (name: string, checked: boolean) => void;
  addedTag: string;
  locateTag: { name: string } | null;
}
interface Drag {
  name: string;
  order: string[];
  y: number;
  offset: number;
  left: number;
  width: number;
}

export function ShareTagSorter({
  tags,
  count,
  onOrder,
  onDelete,
  selection,
  onSelect,
  addedTag,
  locateTag,
}: Props) {
  const list = useRef<HTMLDivElement>(null);
  const active = useRef<Drag | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [landed, setLanded] = useState<string | null>(null);
  const order = drag?.order ?? tags;

  useEffect(() => {
    if (!locateTag || !list.current) return;
    const row = [...list.current.children].find(
      (element) => element.getAttribute('data-tag-name') === locateTag.name,
    );
    row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    row?.animate([{ backgroundColor: '#e8efff' }, { backgroundColor: 'transparent' }], {
      duration: 1400,
    });
  }, [locateTag]);

  const move = useCallback((y: number) => {
    const current = active.current;
    if (!current || !list.current) return;
    const index = Math.max(
      0,
      Math.min(
        current.order.length - 1,
        Math.floor((y - list.current.getBoundingClientRect().top) / ROW_HEIGHT),
      ),
    );
    const next = current.order.filter((name) => name !== current.name);
    next.splice(index, 0, current.name);
    active.current = { ...current, y, order: next };
    setDrag(active.current);
  }, []);

  const isDragging = Boolean(drag);
  useEffect(() => {
    if (!isDragging) return;
    const scroller = list.current?.closest('.ant-drawer-body');
    let frame = 0;
    const scroll = () => {
      const current = active.current;
      if (current && scroller) {
        const rect = scroller.getBoundingClientRect();
        const delta =
          current.y < rect.top + 64
            ? -Math.min(12, (rect.top + 64 - current.y) / 4)
            : current.y > rect.bottom - 64
              ? Math.min(12, (current.y - rect.bottom + 64) / 4)
              : 0;
        if (delta) {
          scroller.scrollTop += delta;
          move(current.y);
        }
      }
      frame = requestAnimationFrame(scroll);
    };
    const pointerMove = (event: globalThis.PointerEvent) => move(event.clientY);
    const stop = (event: globalThis.PointerEvent) => {
      const current = active.current;
      if (!current) return;
      active.current = null;
      setDrag(null);
      if (event.type === 'pointerup') {
        onOrder(current.order);
        setLanded(current.name);
      }
    };
    window.addEventListener('pointermove', pointerMove);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    frame = requestAnimationFrame(scroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', pointerMove);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
    };
  }, [isDragging, move, onOrder]); // The scroll loop reads live pointer/order values from the ref.

  const start = (event: PointerEvent<HTMLDivElement>, name: string) => {
    if (
      selection !== undefined ||
      event.button !== 0 ||
      !list.current ||
      (event.target instanceof Element && event.target.closest('.ant-btn'))
    )
      return;
    event.preventDefault();
    const rect = list.current.getBoundingClientRect();
    const top = rect.top + tags.indexOf(name) * ROW_HEIGHT;
    active.current = {
      name,
      order: [...tags],
      y: event.clientY,
      offset: event.clientY - top,
      left: rect.left,
      width: rect.width,
    };
    setLanded(null);
    setDrag(active.current);
  };
  const finish = (cancelled = false) => {
    const current = active.current;
    if (!current) return;
    active.current = null;
    setDrag(null);
    if (!cancelled) {
      onOrder(current.order);
      setLanded(current.name);
    }
  };
  return (
    <>
      <div
        className={`share-tag-sorter${drag ? ' is-sorting' : ''}`}
        ref={list}
        style={{ height: order.length * ROW_HEIGHT }}
      >
        {order.map((name, index) => (
          <div
            key={name}
            data-tag-name={name}
            className={`share-sort-row${drag?.name === name ? ' is-placeholder' : ''}${landed === name || addedTag === name ? ' just-landed' : ''}`}
            style={{ transform: `translateY(${index * ROW_HEIGHT}px)` }}
            onAnimationEnd={() => setLanded(null)}
            onPointerDown={(event) => start(event, name)}
          >
            {selection ? (
              <Checkbox
                aria-label={`选择合并标签 ${name}`}
                checked={selection.includes(name)}
                disabled={selection.length >= 2 && !selection.includes(name)}
                onChange={(event) => onSelect(name, event.target.checked)}
              />
            ) : (
              <button
                className="share-sort-handle"
                aria-label={`拖动排序 ${name}`}
                title="拖动排序；方向键也可调整"
                onKeyDown={(event) => {
                  if (event.key === 'Escape') finish(true);
                  if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return;
                  event.preventDefault();
                  const target = index + (event.key === 'ArrowUp' ? -1 : 1);
                  if (target < 0 || target >= tags.length) return;
                  const next = [...tags];
                  [next[index], next[target]] = [next[target], next[index]];
                  onOrder(next);
                  setLanded(name);
                }}
              >
                <GripVertical size={16} />
              </button>
            )}
            <span className="share-sort-name"># {name}</span>
            <span className="share-sort-count">{count(name)} 条记录</span>
            {selection?.includes(name) && (
              <span className="share-sort-merge-role">
                {selection.indexOf(name) === 0 ? '来源' : '保留'}
              </span>
            )}
            <Button
              type="text"
              className="share-sort-delete"
              disabled={selection !== undefined}
              aria-label={`删除标签 ${name}`}
              icon={<X size={15} />}
              onClick={() => onDelete(name)}
            />
          </div>
        ))}
      </div>
      <span className="share-sort-status" role="status">
        {drag
          ? `正在拖动 ${drag.name}，第 ${drag.order.indexOf(drag.name) + 1} 位`
          : landed
            ? '顺序已更新'
            : ''}
      </span>
      {drag &&
        createPortal(
          <div
            className="share-sort-floating"
            style={{ left: drag.left, top: drag.y - drag.offset, width: drag.width }}
          >
            <GripVertical size={16} />
            <span># {drag.name}</span>
            <small>{count(drag.name)} 条记录</small>
          </div>,
          document.body,
        )}
    </>
  );
}
