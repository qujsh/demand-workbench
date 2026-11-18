import { useRef, useState, type PointerEvent } from 'react';

/** 触屏保留原生惯性滑动；鼠标拖拽跟手，松开后按距离及速度吸附。 */
export function useNoteGalleryDrag(count: number) {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const drag = useRef<{ x: number; left: number; time: number; index: number } | null>(null);
  const go = (index: number) => {
    const element = track.current;
    if (!element) return;
    element.scrollTo({
      left: Math.max(0, Math.min(count - 1, index)) * element.clientWidth,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
    });
  };
  const finish = (event: PointerEvent<HTMLDivElement>, cancelled = false) => {
    const start = drag.current;
    if (!start) return;
    drag.current = null;
    const element = event.currentTarget;
    const distance = start.x - event.clientX;
    const elapsed = Math.max(1, performance.now() - start.time);
    const advance =
      !cancelled &&
      (Math.abs(distance) > element.clientWidth * 0.18 ||
        (Math.abs(distance) > 24 && Math.abs(distance) / elapsed > 0.45));
    // 先提交最终滚动位置，再恢复吸附，避免浏览器在松手时跳回原页。
    const left = element.scrollLeft;
    element.removeAttribute('data-dragging');
    element.scrollLeft = left;
    go(start.index + (advance ? Math.sign(distance) : 0));
    if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
  };
  return {
    reset: () => {
      drag.current = null;
      setActive(0);
      if (track.current) {
        track.current.removeAttribute('data-dragging');
        track.current.scrollLeft = 0;
      }
    },
    track,
    active,
    go,
    handlers: {
      onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
        if (event.pointerType !== 'mouse' || event.button !== 0 || count < 2) return;
        const element = event.currentTarget;
        drag.current = {
          x: event.clientX,
          left: element.scrollLeft,
          time: performance.now(),
          index: active,
        };
        element.setAttribute('data-dragging', 'true');
        element.setPointerCapture(event.pointerId);
        element.focus({ preventScroll: true });
        event.preventDefault();
      },
      onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
        if (drag.current)
          event.currentTarget.scrollLeft = drag.current.left + drag.current.x - event.clientX;
      },
      onPointerUp: (event: PointerEvent<HTMLDivElement>) => finish(event),
      onPointerCancel: (event: PointerEvent<HTMLDivElement>) => finish(event, true),
      onLostPointerCapture: (event: PointerEvent<HTMLDivElement>) => finish(event, true),
      onScroll: () => {
        if (track.current?.clientWidth)
          setActive(Math.round(track.current.scrollLeft / track.current.clientWidth));
      },
    },
  };
}
