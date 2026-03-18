import { useRef, useEffect, useCallback } from 'react';
import { useReactFlow, type Node } from '@xyflow/react';

interface PendingResize {
  nodeId: string;
  width: number | string;
  height: number | string;
  onResize?: (nodeId: string, width: number, height: number) => void;
}

/**
 * Hook para gerenciar resize de nodes com debounce.
 * Aplica mudanças apenas quando o usuário solta o mouse após o resize,
 * evitando múltiplas atualizações durante o arraste.
 */
export function useNodeResize() {
  const { setNodes } = useReactFlow();
  const isResizingRef = useRef<boolean>(false);
  const pendingResizeRef = useRef<PendingResize | null>(null);

  // Aplica o resize pendente quando o mouse é solto
  useEffect(() => {
    const handleMouseUp = () => {
      if (isResizingRef.current && pendingResizeRef.current) {
        const { nodeId, width, height, onResize } = pendingResizeRef.current;

        // Aplica mudanças no estado
        setNodes((nds: Node[]) => {
          return nds.map((n) => {
            if (n.id === nodeId) {
              return {
                ...n,
                style: {
                  ...n.style,
                  width,
                  height,
                },
              };
            }
            return n;
          });
        });

        // Chama callback onResize se fornecido (converte para number se necessário)
        if (onResize) {
          const widthNum = typeof width === 'number' ? width : 0;
          const heightNum = typeof height === 'number' ? height : 0;
          onResize(nodeId, widthNum, heightNum);
        }

        // Limpa refs
        isResizingRef.current = false;
        pendingResizeRef.current = null;
      }
    };

    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [setNodes]);

  /**
   * Handler de resize que armazena valores temporariamente durante o drag
   * e aplica apenas quando o mouse é solto
   */
  const handleResize = useCallback(
    (
      nodeId: string,
      width: number | string,
      height: number | string,
      onResize?: (nodeId: string, width: number, height: number) => void
    ) => {
      // Marca como em resize na primeira chamada
      if (!isResizingRef.current) {
        isResizingRef.current = true;
      }

      // Armazena valores pendentes (será aplicado no mouseup)
      pendingResizeRef.current = {
        nodeId,
        width,
        height,
        onResize,
      };
    },
    []
  );

  /**
   * Ajusta o tamanho do node para "abraçar" o conteúdo.
   * Permite passar 'auto' para o estilo do CSS, enquanto ainda informa o tamanho numérico real para o callback.
   */
  const fitToContent = useCallback(
    (
      nodeId: string, 
      width: number | 'auto', 
      height: number | 'auto', 
      onResize?: (nodeId: string, width: number, height: number) => void,
      measuredWidth?: number,
      measuredHeight?: number
    ) => {
      setNodes((nds: Node[]) => {
        return nds.map((n) => {
          if (n.id === nodeId) {
            return {
              ...n,
              style: {
                ...n.style,
                width,
                height,
              },
            };
          }
          return n;
        });
      });

      // Cleanup any pending resize
      if (pendingResizeRef.current?.nodeId === nodeId) {
        pendingResizeRef.current = null;
        isResizingRef.current = false;
      }

      // If dimensions are numeric (passed as main args or as measured extras), call onResize callback
      if (onResize) {
        const finalWidth = typeof width === 'number' ? width : (measuredWidth || 0);
        const finalHeight = typeof height === 'number' ? height : (measuredHeight || 0);
        
        if (finalWidth > 0 || finalHeight > 0) {
          onResize(nodeId, finalWidth, finalHeight);
        }
      }
    },
    [setNodes]
  );

  return { handleResize, fitToContent };
}

