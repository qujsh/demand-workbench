import { useCallback, useEffect, useRef, useState } from 'react';

/** 同一需求的多个拆解入口共用一次确认后的冷却。 */
export function useDecompositionCooldown() {
  const until = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [coolingDown, setCoolingDown] = useState(false);
  useEffect(() => () => clearTimeout(timer.current), []);
  const activate = useCallback(() => {
    if (Date.now() < until.current) return false;
    until.current = Date.now() + 30_000;
    setCoolingDown(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCoolingDown(false), 30_000);
    return true;
  }, []);
  return { coolingDown, activate };
}
