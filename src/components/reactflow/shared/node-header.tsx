import * as React from "react"
import { LucideIcon, ShieldCheck, LayoutGrid, Brain } from "lucide-react"
import { cn } from "@/lib/utils"
import { NodeButton } from "./node-button"
import { Tooltip } from "@/components/ui/Tooltip"

export interface NodeHeaderProps {
  icon: LucideIcon
  title: string
  className?: string
  isBrandActive?: boolean
  onToggleBrand?: (active: boolean) => void;
  onOpenMediaLibrary?: () => void;
}

const NodeHeader = React.forwardRef<HTMLDivElement, NodeHeaderProps>(
  ({ icon: Icon, title, className, isBrandActive, onToggleBrand, onOpenMediaLibrary }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center justify-between node-margin-lg",
          className
        )}
      >
        <div className="flex items-center gap-4">
          <Icon size={20} className="text-brand-cyan" style={{ color: 'var(--brand-cyan)' }} />
          <h3 className="text-sm font-semibold node-text-primary font-mono uppercase">{title}</h3>
        </div>

        <div className="flex items-center gap-1.5 no-drag nopan">
          {onOpenMediaLibrary && (
            <Tooltip content="Brand Media Library" position="top">
              <NodeButton
                variant="ghost"
                size="xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenMediaLibrary();
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className="h-7 w-7 p-0 flex items-center justify-center hover:bg-neutral-800/80"
              >
                <LayoutGrid size={14} className="text-neutral-500 hover:text-brand-cyan transition-colors" />
              </NodeButton>
            </Tooltip>
          )}

          {onToggleBrand !== undefined && (
            <Tooltip
              content={isBrandActive ? "Brand Core Active" : "Brand Core Inactive"}
              position="top"
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleBrand(!isBrandActive);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-md border transition-all duration-300",
                  isBrandActive
                    ? "bg-brand-cyan/20 border-brand-cyan/50 text-brand-cyan"
                    : "bg-neutral-900/50 border-neutral-800 text-neutral-600 grayscale opacity-60 hover:opacity-100"
                )}
              >
                <Brain size={14} className={cn(isBrandActive)} />
              </button>
            </Tooltip>
          )}
        </div>
      </div>
    )
  }
)
NodeHeader.displayName = "NodeHeader"

export { NodeHeader }









