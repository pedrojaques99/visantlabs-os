import * as React from "react"
import { cn } from "@/lib/utils"
import { LucideIcon } from "lucide-react"

export interface FormLabelProps
  extends React.LabelHTMLAttributes<HTMLLabelElement> {
  icon?: LucideIcon
}

const FormLabel = React.forwardRef<HTMLLabelElement, FormLabelProps>(
  ({ className, icon: Icon, children, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={cn(
          "flex items-center gap-2 text-xs text-neutral-400 font-mono uppercase tracking-[0.3em]",
          className
        )}
        {...props}
      >
        {Icon && <Icon size={14} />}
        {children}
      </label>
    )
  }
)
FormLabel.displayName = "FormLabel"

export { FormLabel }





