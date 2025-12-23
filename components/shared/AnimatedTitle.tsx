'use client'

import { useState } from 'react'

interface AnimatedTitleProps {
  text: string
  className?: string
}

export default function AnimatedTitle({ text, className = '' }: AnimatedTitleProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const getRandomChar = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*()[]{}?'
    return chars[Math.floor(Math.random() * chars.length)]
  }

  return (
    <h1 className={`${className} inline-flex`}>
      {text.split('').map((char, index) => (
        <span
          key={index}
          onMouseEnter={() => setHoveredIndex(index)}
          onMouseLeave={() => setHoveredIndex(null)}
          className="inline-block transition-all duration-200 hover:scale-100 cursor-default"
          style={{
            transformOrigin: 'center',
          }}
        >
          {hoveredIndex === index && char !== ' ' && char !== '[' && char !== ']' 
            ? getRandomChar() 
            : char}
        </span>
      ))}
    </h1>
  )
}

