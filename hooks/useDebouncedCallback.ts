import { useCallback, useRef, useEffect } from 'react';

export function useDebouncedCallback<T extends (...args: any[]) => any>(
    callback: T,
    delay: number
) {
    const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
    const callbackRef = useRef(callback);

    // Update the callback ref when it changes, so we don't need to reset the timer
    // if only the callback function identity changes but not the timing.
    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    return useCallback(
        (...args: Parameters<T>) => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }

            timeoutRef.current = setTimeout(() => {
                callbackRef.current(...args);
            }, delay);
        },
        [delay]
    );
}
