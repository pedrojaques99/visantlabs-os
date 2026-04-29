/**
 * Single source of truth for keyboard shortcuts displayed in the cheatsheet.
 * Wiring lives in CreativeStudio.tsx and CreativeContextMenu.tsx — entries
 * here MUST stay in sync with the actual key handlers.
 */
export interface Shortcut {
  keys: string[];
  label: string;
  group: 'Seleção' | 'Edição' | 'Camera' | 'Camadas' | 'Outros';
}

const isMac =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform);
const Mod = isMac ? '⌘' : 'Ctrl';

export const SHORTCUTS: Shortcut[] = [
  // Seleção
  { group: 'Seleção', keys: [`${Mod}`, 'A'], label: 'Selecionar tudo' },
  { group: 'Seleção', keys: ['Esc'], label: 'Limpar seleção' },
  { group: 'Seleção', keys: ['Drag em vazio'], label: 'Marquee — selecionar várias' },
  { group: 'Seleção', keys: ['Shift', 'Click'], label: 'Adicionar/remover da seleção' },
  { group: 'Seleção', keys: ['Click direito'], label: 'Menu de contexto' },

  // Edição
  { group: 'Edição', keys: [`${Mod}`, 'Z'], label: 'Desfazer' },
  { group: 'Edição', keys: [`${Mod}`, '⇧', 'Z'], label: 'Refazer' },
  { group: 'Edição', keys: [`${Mod}`, 'C'], label: 'Copiar' },
  { group: 'Edição', keys: [`${Mod}`, 'V'], label: 'Colar' },
  { group: 'Edição', keys: [`${Mod}`, 'D'], label: 'Duplicar' },
  { group: 'Edição', keys: ['Del'], label: 'Apagar' },
  { group: 'Edição', keys: ['↑↓←→'], label: 'Mover 1px' },
  { group: 'Edição', keys: ['⇧', '↑↓←→'], label: 'Mover 10px' },
  { group: 'Edição', keys: ['Ctrl', 'arrastar handle'], label: 'Resize com distorção' },

  // Camadas
  { group: 'Camadas', keys: [`${Mod}`, 'G'], label: 'Agrupar' },
  { group: 'Camadas', keys: [`${Mod}`, '⇧', 'G'], label: 'Desagrupar' },

  // Camera
  { group: 'Camera', keys: ['Scroll'], label: 'Zoom relativo ao ponteiro' },
  { group: 'Camera', keys: ['Espaço', 'Drag'], label: 'Pan' },
  { group: 'Camera', keys: [`${Mod}`, '0'], label: 'Reset 100%' },

  // Outros
  { group: 'Outros', keys: ['?'], label: 'Atalhos (este painel)' },
];
