import { useCallback, useEffect, useRef } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/shareApi';
import type { ShareRecord } from '../shareModels';

/** 服务端数据只保留在Query缓存；编辑器维护独立本地草稿。 */
export function useShares(filters: api.ShareFilters) {
  const client = useQueryClient();
  const invalidate = useCallback(
    () => client.invalidateQueries({ queryKey: ['shares'] }),
    [client],
  );
  const mergeTask = useQuery({
    queryKey: ['shares', 'tag-merge-task'],
    queryFn: ({ signal }) => api.getTagMergeTask(signal),
    refetchInterval: (query) => {
      const status = query.state.data?.task?.status;
      return status && !['COMPLETED', 'FAILED'].includes(status) ? 1000 : false;
    },
    refetchIntervalInBackground: false,
  });
  const previousMerge = useRef<string | undefined>(undefined);
  useEffect(() => {
    const task = mergeTask.data?.task;
    if (previousMerge.current && task?.status === 'COMPLETED') void invalidate();
    previousMerge.current =
      task && !['COMPLETED', 'FAILED'].includes(task.status) ? task.taskNo : undefined;
  }, [mergeTask.data?.task, invalidate]);
  const retryMerge = useMutation({
    mutationFn: api.retryTagMergeTask,
    onSuccess: (task) => client.setQueryData(['shares', 'tag-merge-task'], { task }),
    onSettled: invalidate,
  });
  const reviews = useQuery({
    queryKey: ['shares', 'reviews'],
    refetchOnWindowFocus: true,
    queryFn: ({ signal }) => api.getShareReviews(signal),
    refetchInterval: (query) =>
      query.state.data?.some((item) => ['queued', 'running'].includes(item.status)) ? 1500 : false,
    refetchIntervalInBackground: false,
  });
  const reviewFingerprint = reviews.data
    ?.map((item) => `${item.taskNo}:${item.status}:${item.completedCount}`)
    .join('|');
  const previousReview = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (previousReview.current !== undefined && previousReview.current !== reviewFingerprint) {
      void client.invalidateQueries({ queryKey: ['shares', 'records'] });
    }
    previousReview.current = reviewFingerprint;
  }, [client, reviewFingerprint]);
  const retryReview = useMutation({
    mutationFn: api.retryShareReview,
    onSuccess: invalidate,
  });
  const tags = useQuery({
    queryKey: ['shares', 'tags'],
    queryFn: ({ signal }) => api.getTags(signal),
  });
  const resolvedFilters = {
    ...filters,
    tagNo: tags.data?.tags.find((tag) => tag.name === filters.tagNo)?.tagNo ?? filters.tagNo,
  };
  const records = useInfiniteQuery({
    queryKey: ['shares', 'records', resolvedFilters],
    enabled: !filters.tagNo || tags.isSuccess,
    maxPages: 5,
    initialPageParam: { cursor: '', direction: 'older' },
    queryFn: ({ pageParam, signal }) =>
      api.listShares(resolvedFilters, pageParam.cursor, signal, pageParam.direction),
    getNextPageParam: (last) =>
      last.nextCursor ? { cursor: last.nextCursor, direction: 'older' } : undefined,
    getPreviousPageParam: (first) =>
      first.previousCursor ? { cursor: first.previousCursor, direction: 'newer' } : undefined,
  });
  const periods = useQuery({
    queryKey: ['shares', 'periods', filters.status],
    queryFn: ({ signal }) => api.getPeriods(filters.status, signal),
  });
  const save = useMutation({
    mutationFn: api.saveShare,
    onSuccess: invalidate,
    onError: invalidate,
  });
  const change = useMutation({
    mutationFn: ({ record, restore }: { record: ShareRecord; restore: boolean }) =>
      api.changeRecord(record, restore),
    onSettled: invalidate,
  });
  const tagWrite = useMutation({
    mutationFn: async (
      action:
        | { kind: 'add'; name: string }
        | { kind: 'delete'; name: string }
        | { kind: 'merge'; source: string; target: string }
        | { kind: 'order'; names: string[] },
    ) => {
      const current = client.getQueryData<api.ShareTagsResult>(['shares', 'tags']);
      if (!current) throw new Error('标签尚未加载，请稍后重试');
      const no = (name: string) => {
        const tag = current.tags.find((item) => item.name === name);
        if (!tag) throw new Error('标签已变化，请刷新后再试');
        return tag.tagNo;
      };
      if (action.kind === 'merge') {
        const task = await api.mergeTags(
          no(action.source),
          no(action.target),
          current.orderVersion,
        );
        client.setQueryData(['shares', 'tag-merge-task'], { task });
        return task;
      }
      if (action.kind === 'add') return api.addTag(action.name, current.orderVersion);
      if (action.kind === 'delete') return api.deleteTag(no(action.name), current.orderVersion);
      return api.reorderTags(action.names.map(no), current.orderVersion);
    },
    onMutate: async (action) => {
      await client.cancelQueries({ queryKey: ['shares', 'tags'] });
      const previous = client.getQueryData<api.ShareTagsResult>(['shares', 'tags']);
      if (action.kind === 'order' && previous)
        client.setQueryData(['shares', 'tags'], {
          ...previous,
          tags: action.names.flatMap((name) => previous.tags.filter((tag) => tag.name === name)),
        });
      return { previous };
    },
    onError: (_error, _action, context) => {
      if (context?.previous) client.setQueryData(['shares', 'tags'], context.previous);
    },
    onSettled: invalidate,
  });
  return {
    records,
    tags,
    periods,
    save,
    change,
    tagWrite,
    mergeTask,
    retryMerge,
    reviews,
    retryReview,
  };
}
