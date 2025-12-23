import { useState, useEffect, useMemo } from 'react';

export function useMediaQuery(query: string): boolean {
    const [matches, setMatches] = useState(false);

    const media = useMemo(() => window.matchMedia(query), [query]);

    useEffect(() => {
        const updateMatch = () => setMatches(media.matches);

        // Set initial value
        updateMatch();

        media.addEventListener('change', updateMatch);
        return () => media.removeEventListener('change', updateMatch);
    }, [query]);

    return matches;
}
