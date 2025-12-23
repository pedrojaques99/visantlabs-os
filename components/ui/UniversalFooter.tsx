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
      const randomGlitch = Array.from({ length: 4 }, () =>
        glitchChars[Math.floor(Math.random() * glitchChars.length)]
      ).join('')
      setGlitchText(randomGlitch)
    }, 150)

    return () => clearInterval(glitchInterval)
  }, [])

  return (
    <div className={`text-center text-[9px] sm:text-[10px] md:text-[11px] text-zinc-500 ${className}`}>
      <span>{glitchText}  {' | '} VSNLABS® v1.0</span>
    </div>
  )
}

export const UniversalFooter = memo(UniversalFooterComponent)
