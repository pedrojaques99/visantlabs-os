/**
 * Shared chat types — superset used by every webapp chat surface.
 * Per-route interfaces should extend/reuse these instead of redeclaring fields.
 */

export type ChatMessageRole = 'user' | 'assistant';

export interface CreativeProjectRef {
  creativeProjectId: string;
  imageUrl: string;
  editUrl: string;
  prompt: string;
  creditsDeducted?: number;
  creditsRemaining?: number;
}

export interface ToolCallRecord {
  id: string;
  name: string;
  status: 'running' | 'done' | 'error';
  args?: any;
  startedAt: string;
  endedAt?: string;
  errorMessage?: string;
  summary?: string;
}

/** Base chat message — every surface has role/content/timestamp. */
export interface ChatBaseMessage {
  role: ChatMessageRole;
  content: string;
  timestamp: string;
}

/** Admin/agency chat extras. User-facing chat.ts ignores these. */
export interface ChatMessageExtras {
  action?: string;
  actionResult?: any;
  creativeProjects?: CreativeProjectRef[];
  toolCalls?: ToolCallRecord[];
  generationId?: string;
}

export type ChatMessage = ChatBaseMessage & ChatMessageExtras;
