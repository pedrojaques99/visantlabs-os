import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API_BASE } from '@/config/api';
import { authService } from '@/services/authService';

export interface ToolPreset<T = Record<string, unknown>> {
  id: string;
  name: string;
  data: T;
}

const localKey = (tool: string) => `tool-presets:${tool}`;

function readLocal<T>(tool: string): ToolPreset<T>[] {
  try {
    return JSON.parse(localStorage.getItem(localKey(tool)) || '[]');
  } catch {
    return [];
  }
}

function writeLocal<T>(tool: string, presets: ToolPreset<T>[]) {
  localStorage.setItem(localKey(tool), JSON.stringify(presets));
}

async function request<R>(path: string, init?: RequestInit): Promise<R> {
  const res = await fetch(`${API_BASE}/tool-presets${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authService.getToken()}`,
    },
  });
  if (!res.ok) throw new Error(`Tool presets: ${res.status}`);
  return res.json();
}

/**
 * The one store for "save these settings", for every tool. Private to the person: in their account
 * when logged in, in this browser when not. A preset holds settings only, never a file.
 */
export function useToolPresets<T extends Record<string, unknown>>(tool: string) {
  const client = useQueryClient();
  const loggedIn = Boolean(authService.getToken());
  const queryKey = ['tool-presets', tool, loggedIn];
  const refresh = () => client.invalidateQueries({ queryKey });

  const { data: presets = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () =>
      loggedIn
        ? (await request<{ presets: ToolPreset<T>[] }>(`?tool=${encodeURIComponent(tool)}`)).presets
        : readLocal<T>(tool),
  });

  const save = useMutation({
    mutationFn: async ({ name, data }: { name: string; data: T }) => {
      if (loggedIn) {
        await request('', { method: 'POST', body: JSON.stringify({ tool, name, data }) });
        return;
      }
      writeLocal(tool, [{ id: crypto.randomUUID(), name, data }, ...readLocal<T>(tool)]);
    },
    onSuccess: refresh,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      if (loggedIn) {
        await request(`/${id}`, { method: 'DELETE' });
        return;
      }
      writeLocal(
        tool,
        readLocal<T>(tool).filter((preset) => preset.id !== id)
      );
    },
    onSuccess: refresh,
  });

  return { presets, isLoading, save, remove };
}
