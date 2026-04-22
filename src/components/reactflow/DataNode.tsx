import React, { memo, useCallback, useRef } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Upload, ChevronLeft, ChevronRight, Table2, AlertCircle } from 'lucide-react';
import type { DataNodeData } from '@/types/reactFlow';
import { NodeContainer } from './shared/NodeContainer';
import { cn } from '@/lib/utils';
import { parseDataFile } from '@/utils/canvas/parseDataFile';
import { toast } from 'sonner';

const MAX_PREVIEW_COLS = 4;

export const DataNode = memo(({ data, selected, id, dragging }: NodeProps<any>) => {
  const nodeData = data as DataNodeData;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { rows = [], columns = [], selectedRowIndex = 0, fileName } = nodeData;
  const totalRows = rows.length;
  const currentRow = rows[selectedRowIndex] ?? {};
  const previewCols = columns.slice(0, MAX_PREVIEW_COLS);
  const hiddenCols = columns.length - MAX_PREVIEW_COLS;

  const update = useCallback(
    (patch: Partial<DataNodeData>) => nodeData.onUpdateData?.(id, patch),
    [id, nodeData]
  );

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const result = await parseDataFile(file);
      if (result.error) {
        toast.error(`Parse error: ${result.error}`);
        return;
      }
      if (!result.rows.length) {
        toast.error('File has no data rows');
        return;
      }
      update({ fileName: file.name, rows: result.rows, columns: result.columns, selectedRowIndex: 0 });
      toast.success(`Loaded ${result.rows.length} rows · ${result.columns.length} columns`);
      e.target.value = '';
    },
    [update]
  );

  const handlePrev = useCallback(() => {
    if (selectedRowIndex > 0) update({ selectedRowIndex: selectedRowIndex - 1 });
  }, [selectedRowIndex, update]);

  const handleNext = useCallback(() => {
    if (selectedRowIndex < totalRows - 1) update({ selectedRowIndex: selectedRowIndex + 1 });
  }, [selectedRowIndex, totalRows, update]);

  return (
    <NodeContainer selected={selected} dragging={dragging} className="min-w-[280px] max-w-[340px]">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
        <Table2 size={13} className="text-brand-cyan shrink-0" />
        <span className="text-[11px] font-semibold uppercase tracking-widest text-white/70">
          Data
        </span>
        {fileName && (
          <span className="ml-auto text-[9px] text-white/35 truncate max-w-[120px]">{fileName}</span>
        )}
      </div>

      {/* Upload zone */}
      {!totalRows ? (
        <button
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'mx-3 my-3 flex flex-col items-center gap-2 rounded border border-dashed border-white/15',
            'p-4 text-white/30 hover:border-brand-cyan/40 hover:text-white/50 transition-colors w-[calc(100%-24px)]'
          )}
        >
          <Upload size={18} />
          <span className="text-[10px]">Upload CSV or JSON</span>
        </button>
      ) : (
        <>
          {/* Row preview table */}
          <div className="px-3 pt-2 pb-1 overflow-x-auto">
            <table className="w-full text-[9px]">
              <thead>
                <tr>
                  {previewCols.map((col) => (
                    <th key={col} className="text-left text-white/30 font-medium pb-1 pr-2 truncate max-w-[60px]">
                      {col}
                    </th>
                  ))}
                  {hiddenCols > 0 && (
                    <th className="text-left text-white/20 pb-1">+{hiddenCols}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {previewCols.map((col) => (
                    <td key={col} className="text-white/70 pr-2 truncate max-w-[60px] pb-0.5">
                      {currentRow[col] ?? '—'}
                    </td>
                  ))}
                  {hiddenCols > 0 && <td className="text-white/20">…</td>}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Row navigator */}
          <div className="flex items-center gap-2 px-3 pb-2">
            <button
              onClick={handlePrev}
              disabled={selectedRowIndex === 0}
              className="text-white/30 hover:text-white/70 disabled:opacity-20 transition-colors"
            >
              <ChevronLeft size={13} />
            </button>
            <span className="text-[10px] text-white/40 flex-1 text-center">
              Row {selectedRowIndex + 1} / {totalRows}
            </span>
            <button
              onClick={handleNext}
              disabled={selectedRowIndex >= totalRows - 1}
              className="text-white/30 hover:text-white/70 disabled:opacity-20 transition-colors"
            >
              <ChevronRight size={13} />
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-[9px] text-white/25 hover:text-white/50 transition-colors ml-1"
            >
              Replace
            </button>
          </div>

          {/* Hint */}
          <div className="px-3 pb-2 flex items-start gap-1">
            <AlertCircle size={9} className="text-white/20 mt-0.5 shrink-0" />
            <p className="text-[9px] text-white/20 leading-tight">
              Connect to a Prompt or Edit node — column names become <span className="font-mono text-brand-cyan/40">{`{{variables}}`}</span>
            </p>
          </div>
        </>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.json"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="data-out"
        style={{ top: '50%', right: -6, width: 10, height: 10, background: '#00f5c4', border: '2px solid #0C0C0C' }}
      />
    </NodeContainer>
  );
});

DataNode.displayName = 'DataNode';
