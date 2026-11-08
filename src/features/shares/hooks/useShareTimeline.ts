import { useEffect, useLayoutEffect, useRef } from 'react';
import type { ShareRecord } from '../shareModels';
import type { useShares } from './useShares';

/** 游标翻页时保持可见记录位置；筛选/编辑状态由页面持有。 */
export function useShareTimeline(
  records: ShareRecord[],
  query: ReturnType<typeof useShares>['records'],
  setBrowseDate: (date: string) => void,
  reportError: (error: unknown) => void,
) {
  const scrollAnchor = useRef<{ id: string; top: number } | null>(null);
  const paging = useRef(false);
  const lastScroll = useRef(0);
  const restoringScroll = useRef(false);
  const loadDirection = async (direction: 'older' | 'newer') => {
    if (paging.current || query.isFetching) return;
    paging.current = true;
    const visible = [...document.querySelectorAll<HTMLElement>('[data-share-record]')].find(
      (node) => node.getBoundingClientRect().bottom > 100,
    );
    scrollAnchor.current = visible
      ? { id: visible.dataset.shareRecord!, top: visible.getBoundingClientRect().top }
      : null;
    try {
      if (direction === 'older') await query.fetchNextPage();
      else await query.fetchPreviousPage();
    } catch (error) {
      reportError(error);
    } finally {
      paging.current = false;
    }
  };
  const recordIds = records.map((record) => record.id).join('|');
  useLayoutEffect(() => {
    const saved = scrollAnchor.current;
    if (!saved) return;
    const node = document.querySelector<HTMLElement>(`[data-share-record="${saved.id}"]`);
    if (node) {
      restoringScroll.current = true;
      window.scrollBy(0, node.getBoundingClientRect().top - saved.top);
      lastScroll.current = window.scrollY;
      requestAnimationFrame(() => {
        restoringScroll.current = false;
      });
    }
    scrollAnchor.current = null;
  }, [recordIds]);
  useEffect(() => {
    const scroll = () => {
      if (restoringScroll.current) return;
      const y = window.scrollY;
      const direction = y < lastScroll.current ? 'newer' : 'older';
      lastScroll.current = y;
      const nodes = [...document.querySelectorAll<HTMLElement>('[data-share-record]')];
      const visible = nodes.find((node) => node.getBoundingClientRect().bottom > 120);
      if (visible) setBrowseDate(visible.dataset.shareDate ?? '');
      if (!nodes.length || query.isError) return;
      if (
        direction === 'newer' &&
        query.hasPreviousPage &&
        nodes[0].getBoundingClientRect().top > -200
      )
        void loadDirection('newer');
      if (
        direction === 'older' &&
        query.hasNextPage &&
        nodes[nodes.length - 1].getBoundingClientRect().bottom < window.innerHeight + 350
      )
        void loadDirection('older');
    };
    window.addEventListener('scroll', scroll, { passive: true });
    return () => window.removeEventListener('scroll', scroll);
  });
  return {
    loadDirection,
    resetScrollAnchor: () => {
      scrollAnchor.current = null;
    },
  };
}
