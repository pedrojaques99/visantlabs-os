const getApiBaseUrl = () => (import.meta as any).env?.VITE_API_URL || '/api';

function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function pngToSvg(file: File): Promise<string> {
  const dataUrl = await fileToDataURL(file);

  const token = localStorage.getItem('token');
  const res = await fetch(`${getApiBaseUrl()}/images/png-to-svg`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ image: dataUrl }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Server error: ${res.status}`);
  }

  const { svg } = await res.json();
  return svg;
}
