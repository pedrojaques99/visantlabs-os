'use client'

import { useEffect, useState } from 'react'

interface GlitchLoaderProps {
  size?: number | string
  className?: string
  color?: string
}

export function GlitchLoader({ 
  size = 10, 
  className = '', 
  color = '#7E7E7EFF' 
}: GlitchLoaderProps) {
  const [glitchText, setGlitchText] = useState('')

  useEffect(() => {
    const glitchChars = '*•□./-®'
    const glitchInterval = setInterval(() => {
      const randomGlitch = Array.from({ length: 4 }, () => 
        glitchChars[Math.floor(Math.random() * glitchChars.length)]
      ).join('')
      setGlitchText(randomGlitch)
    }, 150)

    return () => clearInterval(glitchInterval)
  }, [])

  const sizeStyle = typeof size === 'number' 
    ? { fontSize: `${size}px` } 
    : { fontSize: size }

  return (
    <span 
      className={`inline-block font-mono ${className}`}
      style={{ ...sizeStyle, color }}
    >
      {glitchText}
    </span>
  )
}

