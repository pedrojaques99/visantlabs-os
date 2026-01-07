import * as React from "react"
import { cn } from "@/lib/utils"

export interface NodeSliderProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  formatValue?: (value: number) => string
}

const NodeSlider = React.forwardRef<HTMLInputElement, NodeSliderProps>(
  ({ label, value, min, max, step = 0.01, onChange, formatValue, className, onMouseDown, ...props }, ref) => {
    const percentage = ((value - min) / (max - min)) * 100

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = parseFloat(e.target.value)
      onChange(newValue)
    }

    const handleMouseDown = (e: React.MouseEvent<HTMLInputElement>) => {
      e.stopPropagation()
      if (onMouseDown) {
        onMouseDown(e)
      }
    }

    const displayValue = formatValue ? formatValue(value) : value.toFixed(2)

    return (
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-mono text-zinc-400">{label}</label>
          <span className="text-xs font-mono text-zinc-500">{displayValue}</span>
        </div>
        <input
          ref={ref}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleChange}
          onMouseDown={handleMouseDown}
          className={cn(
            "w-full h-1.5 bg-zinc-800 rounded-md appearance-none cursor-pointer accent-[#brand-cyan]",
            "transition-all duration-150",
            className
          )}
          style={{
            background: `linear-gradient(to right, #brand-cyan 0%, #brand-cyan ${percentage}%, #3f3f46 ${percentage}%, #3f3f46 100%)`
          }}
          {...props}
        />
      </div>
    )
  }
)
NodeSlider.displayName = "NodeSlider"

export { NodeSlider }

