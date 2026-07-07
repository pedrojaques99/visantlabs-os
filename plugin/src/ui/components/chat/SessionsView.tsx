import React from 'react';
import { usePluginStore } from '../../store';
import { Plus, MessageSquare, Trash2, Pencil, Check, X } from 'lucide-react';

/** Compact relative-time label (pt-BR), e.g. "agora", "5 min", "3 h", "2 d". */
function timeAgo(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return 'agora';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  return `${d} d`;
}

export function SessionsView() {
  const sessions = usePluginStore((s) => s.sessions);
  const activeId = usePluginStore((s) => s.sessionId);
  const { newSession, switchSession, deleteSession, renameSession } = usePluginStore();

  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editValue, setEditValue] = React.useState('');
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);

  const startRename = (id: string, title: string) => {
    setEditingId(id);
    setEditValue(title);
  };
  const commitRename = () => {
    if (editingId) renameSession(editingId, editValue);
    setEditingId(null);
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Sessões
        </span>
        <button
          onClick={newSession}
          className="flex items-center gap-1 h-7 px-2.5 rounded-[6px] text-[10px] font-mono text-brand-cyan bg-neutral-900/50 border border-brand-cyan/20 hover:bg-neutral-800 hover:border-brand-cyan/40 transition-all"
        >
          <Plus size={12} />
          Nova conversa
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {sessions.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-[11px] text-muted-foreground text-center max-w-[200px]">
              Nenhuma sessão salva ainda. Inicie uma conversa e ela aparecerá aqui.
            </p>
          </div>
        ) : (
          sessions.map((s) => {
            const isActive = s.id === activeId;
            const isEditing = editingId === s.id;
            const isConfirming = confirmDeleteId === s.id;
            return (
              <div
                key={s.id}
                className={`group flex items-center gap-2 px-2.5 py-2 rounded-md border transition-colors ${
                  isActive
                    ? 'border-brand-cyan/40 bg-brand-cyan/[0.06]'
                    : 'border-transparent hover:border-border hover:bg-muted/40'
                }`}
              >
                <MessageSquare
                  size={13}
                  className={isActive ? 'text-brand-cyan shrink-0' : 'text-muted-foreground shrink-0'}
                />

                {isEditing ? (
                  <input
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename();
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    onBlur={commitRename}
                    className="flex-1 min-w-0 bg-background border border-border rounded px-1.5 py-0.5 text-[11px] text-foreground focus:outline-none focus:border-brand-cyan/50"
                  />
                ) : (
                  <button
                    onClick={() => switchSession(s.id)}
                    className="flex-1 min-w-0 text-left"
                    title={s.title}
                  >
                    <div className="text-[11px] text-foreground/90 truncate">{s.title}</div>
                    <div className="text-[9px] font-mono text-muted-foreground">
                      {s.messageCount} msg{s.messageCount !== 1 ? 's' : ''} · {timeAgo(s.updatedAt)}
                      {isActive ? ' · ativa' : ''}
                    </div>
                  </button>
                )}

                {/* Actions */}
                {isEditing ? (
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={commitRename}
                    className="text-muted-foreground hover:text-brand-cyan transition-colors shrink-0"
                    title="Salvar"
                  >
                    <Check size={13} />
                  </button>
                ) : isConfirming ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => {
                        deleteSession(s.id);
                        setConfirmDeleteId(null);
                      }}
                      className="text-destructive hover:opacity-80 transition-opacity"
                      title="Confirmar exclusão"
                    >
                      <Check size={13} />
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      title="Cancelar"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => startRename(s.id, s.title)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      title="Renomear"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(s.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                      title="Excluir"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
