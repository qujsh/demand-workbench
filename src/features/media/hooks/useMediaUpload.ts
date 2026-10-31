import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { uploadMedia, type UploadInput } from '../api/mediaUploadApi';

/** 上传交互状态留在本地，服务端写入由Mutation编排。 */
export function useMediaUpload() {
  const controller = useRef<AbortController | null>(null);
  const [progress, setProgress] = useState(0);
  const mutation = useMutation({
    mutationFn: (input: Omit<UploadInput, 'signal' | 'onProgress'>) => {
      controller.current = new AbortController();
      setProgress(0);
      return uploadMedia({ ...input, signal: controller.current.signal, onProgress: setProgress });
    },
  });
  useEffect(() => () => controller.current?.abort(), []);
  return {
    upload: mutation.mutateAsync,
    uploading: mutation.isPending,
    progress,
    cancel: () => controller.current?.abort(),
  };
}
