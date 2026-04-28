import { useState, useEffect } from 'react';

export function useResolvedTokens(variables: string[], theme?: string): Record<string, string> {
  const [resolved, setResolved] = useState<Record<string, string>>({});

  useEffect(() => {
    const style = getComputedStyle(document.documentElement);
    const result: Record<string, string> = {};
    variables.forEach(v => {
      result[v] = style.getPropertyValue(v).trim();
    });
    setResolved(result);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variables.join(','), theme]);

  return resolved;
}
