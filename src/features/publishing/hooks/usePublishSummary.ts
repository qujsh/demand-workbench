import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getPublishSummary,
  streamPublishSummary,
  type PublishSummary,
} from '../api/publishSummaryApi';

export function usePublishSummary(requirementNo: string) {
  const queryClient = useQueryClient();
  const [streamedContent, setStreamedContent] = useState('');
  const [streamStatus, setStreamStatus] = useState<'idle' | 'generating' | 'failed'>('idle');
  const [streamError, setStreamError] = useState<Error | null>(null);
  const startedRef = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);

  const query = useQuery({
    queryKey: ['publish-summary', requirementNo],
    queryFn: ({ signal }) => getPublishSummary(requirementNo, signal),
    enabled: Boolean(requirementNo),
    retry: 1,
  });

  const start = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setStreamedContent('');
    setStreamError(null);
    setStreamStatus('generating');
    void streamPublishSummary(requirementNo, {
      signal: controller.signal,
      onContent: text => setStreamedContent(current => current + text),
      onComplete: summary => {
        setStreamedContent(summary.content ?? '');
        setStreamStatus('idle');
        queryClient.setQueryData<PublishSummary>(['publish-summary', requirementNo], summary);
      },
    }).catch(error => {
      if (controller.signal.aborted) return;
      setStreamError(error instanceof Error ? error : new Error('任务简介生成失败'));
      setStreamStatus('failed');
    });
  }, [queryClient, requirementNo]);

  useEffect(() => {
    if (!query.data || query.data.content || startedRef.current) return;
    start();
  }, [query.data, start]);

  const retry = useCallback(() => {
    startedRef.current = false;
    start();
  }, [start]);

  return {
    content: streamedContent || query.data?.content || '',
    status: streamStatus !== 'idle' ? streamStatus : query.data?.status ?? 'pending',
    isLoading: query.isLoading,
    error: streamError ?? query.error,
    retry,
  };
}
