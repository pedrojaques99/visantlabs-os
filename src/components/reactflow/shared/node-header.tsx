import * as React from "react"
import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export interface NodeHeaderProps {
  icon: LucideIcon
  title: string
  className?: string
}

const NodeHeader = React.forwardRef<HTMLDivElement, NodeHeaderProps>(
  ({ icon: Icon, title, className }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center gap-4 node-gap node-margin-lg",
          className
        )}
      >
        <Icon size={20} className="text-brand-cyan" />
        <h3 className="text-sm font-semibold node-text-primary font-mono uppercase">{title}</h3>
      </div>
    )
  }
)
NodeHeader.displayName = "NodeHeader"

export { NodeHeader }









