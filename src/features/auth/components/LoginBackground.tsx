import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { getLoginBackground, type LoginBackground as BackgroundData } from '../api/authApi';

const cacheKey = 'login-background-v1';
const cachedSchema = z.object({ url: z.url().refine((url) => url.startsWith('https://')), copyright: z.string() });

function readCachedBackground(): BackgroundData | undefined {
  try {
    const result = cachedSchema.safeParse(JSON.parse(localStorage.getItem(cacheKey) || 'null'));
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}

export function LoginBackground() {
  const query = useQuery({
    queryKey: ['auth', 'login-background'], queryFn: getLoginBackground,
    initialData: readCachedBackground, initialDataUpdatedAt: 0,
    staleTime: 60 * 60 * 1000, retry: false, refetchOnWindowFocus: false,
  });
  const [layers, setLayers] = useState<{ current?: BackgroundData; previous?: BackgroundData }>({});

  useEffect(() => {
    if (!query.data) return;
    let cancelled = false;
    const background = query.data;
    const image = new Image();
    image.src = background.url;
    image.decode().then(() => {
      if (cancelled) return;
      setLayers((old) => old.current?.url === background.url
        ? { ...old, current: background }
        : { current: background, previous: old.current });
      try { localStorage.setItem(cacheKey, JSON.stringify(background)); } catch { /* 缓存不可用时仍正常显示图片。 */ }
    }).catch(() => { /* 图片失败时保留上一张背景，登录流程不受影响。 */ });
    return () => { cancelled = true; };
  }, [query.data]);

  return <>
    {layers.previous && <img className="auth-background" src={layers.previous.url} alt="" />}
    {layers.current && <img key={layers.current.url} className="auth-background auth-background-enter" src={layers.current.url} alt=""
      onAnimationEnd={() => setLayers((old) => ({ current: old.current }))} />}
    {layers.current && <div className="auth-copyright auth-background-enter" key={`copyright-${layers.current.url}`}>{layers.current.copyright}</div>}
  </>;
}
