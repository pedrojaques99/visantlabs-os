import * as React from "react"
import { cn } from "@/lib/utils"
import { FormLabel, FormLabelProps } from "./form-label"
import { X, Check } from "lucide-react"

export interface FormFieldProps {
  label?: string
  labelProps?: FormLabelProps
  error?: string
  success?: string
  hint?: string
  required?: boolean
  children: React.ReactNode
  className?: string
}

const FormField = React.forwardRef<HTMLDivElement, FormFieldProps>(
  ({ label, labelProps, error, success, hint, required, children, className }, ref) => {
    return (
      <div ref={ref} className={cn("space-y-2", className)}>
        {label && (
          <FormLabel {...labelProps}>
            {label}
            {required && <span className="text-red-400 ml-1">*</span>}
          </FormLabel>
        )}
        {children}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-sm text-red-400 font-mono flex items-center gap-2">
            <X size={14} />
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 text-sm text-green-400 font-mono flex items-center gap-2">
            <Check size={14} />
            {success}
          </div>
        )}
        {hint && !error && !success && (
          <p className="text-xs text-neutral-500 font-mono">{hint}</p>
        )}
      </div>
    )
  }
)
FormField.displayName = "FormField"

export { FormField }

