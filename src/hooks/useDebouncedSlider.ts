import { useState, useEffect, useCallback, useRef } from 'react';

export function useDebouncedSlider(storeValue: number, setter: (v: number) => void, delay = 60) {
  const [local, setLocal] = useState(storeValue);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => { setLocal(storeValue); }, [storeValue]);

  const onChange = useCallback((v: number) => {
    setLocal(v);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setter(v), delay);
  }, [setter, delay]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return [local, onChange] as const;
}
