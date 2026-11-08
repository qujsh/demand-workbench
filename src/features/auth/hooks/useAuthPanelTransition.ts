import { useLayoutEffect, useRef } from 'react';

/** 在路由切换时平滑调整卡片高度，保持内容自然撑开及小屏滚动。 */
export function useAuthPanelTransition(mode: string) {
  const panelRef = useRef<HTMLElement>(null);
  const previousHeight = useRef<number | null>(null);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const height = panel.getBoundingClientRect().height;
    const from = previousHeight.current;
    previousHeight.current = height;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const animation =
      from !== null && Math.abs(from - height) > 1 && !reducedMotion
        ? panel.animate([{ height: `${from}px` }, { height: `${height}px` }], {
            duration: 260,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          })
        : null;
    const observer = new ResizeObserver(() => {
      if (animation?.playState !== 'running')
        previousHeight.current = panel.getBoundingClientRect().height;
    });
    observer.observe(panel);
    return () => {
      if (animation?.playState === 'running')
        previousHeight.current = panel.getBoundingClientRect().height;
      observer.disconnect();
      animation?.cancel();
    };
  }, [mode]);

  return panelRef;
}
