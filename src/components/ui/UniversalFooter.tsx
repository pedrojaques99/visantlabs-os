'use client'

import { useEffect, useState, memo } from 'react'

interface UniversalFooterProps {
  isDarkMode: boolean
  className?: string
}

function UniversalFooterComponent({ isDarkMode, className = '' }: UniversalFooterProps) {
  const [glitchText, setGlitchText] = useState('')

  useEffect(() => {
    const glitchInterval = setInterval(() => {
      const glitchChars = '*•.'
      const randomGlitch = Array.from({ length: 2 }, () =>
        glitchChars[Math.floor(Math.random() * glitchChars.length)]
      ).join('')
      setGlitchText(randomGlitch)
    }, 200)

    return () => clearInterval(glitchInterval)
  }, [])

  return (
    <div className={`text-center text-[clamp(10px,1vw,11px)] text-neutral-500/80 ${className}`}>
      <span className="font-mono tabular-nums select-none opacity-80">{glitchText}  {' | '} VSNLABS® v1.0</span>
    </div>
  )
}

export const UniversalFooter = memo(UniversalFooterComponent)
