import { useLayoutEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getNote } from '../api/noteApi';
import type { NoteRecord } from '../noteModels';
import type { useNotes } from './useNotes';

/** 沿当前筛选的双向游标浏览；不额外复制列表，缓存淘汰后仍可向回加载。 */
export function useNoteDetailNavigation(
  detail: NoteRecord | null,
  records: NoteRecord[],
  query: ReturnType<typeof useNotes>['records'],
  setDetail: (record: NoteRecord) => void,
  reportError: (error: unknown) => void,
) {
  const client = useQueryClient();
  const [loading, setLoading] = useState(false);
  const busy = useRef(false);
  const current = useRef(detail);
  useLayoutEffect(() => {
    current.current = detail;
    return () => {
      current.current = null;
    };
  }, [detail]);
  const index = detail ? records.findIndex((record) => record.id === detail.id) : -1;
  const move = async (direction: 'previous' | 'next') => {
    if (!detail || index < 0 || busy.current || query.isFetching) return;
    busy.current = true;
    setLoading(true);
    const origin = detail;
    try {
      let items = records;
      let target = items[index + (direction === 'next' ? 1 : -1)];
      if (!target) {
        if (direction === 'next' ? !query.hasNextPage : !query.hasPreviousPage) return;
        const page =
          direction === 'next'
            ? await query.fetchNextPage({ throwOnError: true })
            : await query.fetchPreviousPage({ throwOnError: true });
        items = page.data?.pages.flatMap((part) => part.items) ?? [];
        const anchor = items.findIndex((record) => record.id === origin.id);
        if (anchor < 0) return;
        target = items[anchor + (direction === 'next' ? 1 : -1)];
      }
      if (!target || current.current !== origin) return;
      const full = await client.fetchQuery({
        queryKey: ['notes', 'detail', target.id],
        queryFn: () => getNote(target.id),
        staleTime: 0,
      });
      if (current.current === origin) setDetail(full);
    } catch (error) {
      if (current.current === origin) reportError(error);
    } finally {
      busy.current = false;
      setLoading(false);
    }
  };
  return {
    previous: index >= 0 && (index > 0 || query.hasPreviousPage),
    next: index >= 0 && (index < records.length - 1 || query.hasNextPage),
    loading,
    disabled: loading || query.isFetching,
    move,
  };
}
