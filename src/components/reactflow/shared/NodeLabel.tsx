import React from 'react';

interface NodeLabelProps {
  label?: string;
}

export const NodeLabel: React.FC<NodeLabelProps> = ({ label }) => {
  if (!label) return null;

  return (
    <div className="px-4 py-2.5 text-xs text-zinc-400 font-mono truncate border-t border-zinc-700/30 flex-shrink-0" style={{ paddingLeft: 'var(--node-padding)', paddingRight: 'var(--node-padding)' }}>
      {label}
    </div>
  );
};
