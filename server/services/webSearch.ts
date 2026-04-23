export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export async function searchWeb(query: string, numResults = 5): Promise<SearchResult[]> {
  const serperKey = process.env.SERPER_API_KEY;
  if (!serperKey) {
    console.warn('[WebSearch] SERPER_API_KEY not configured');
    return [];
  }

  try {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': serperKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: query,
        num: numResults,
        hl: 'pt-br',
        gl: 'br',
      }),
    });

    if (!response.ok) {
      console.error(`[WebSearch] API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return (data.organic || []).map((item: any) => ({
      title: item.title,
      url: item.link,
      snippet: item.snippet,
    }));
  } catch (error) {
    console.error('[WebSearch] Error:', error);
    return [];
  }
}
