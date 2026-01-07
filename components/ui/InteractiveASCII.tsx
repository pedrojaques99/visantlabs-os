'use client'

import { useEffect, useState, useRef, useCallback } from 'react'

interface WavePoint {
  x: number
  y: number
  originalX: number
  originalY: number
  char: string
  opacity: number
  scale: number
  currentX?: number
  currentY?: number
  currentOpacity?: number
  currentScale?: number
}

interface InteractiveASCIIProps {
  isDarkMode: boolean
  asciiArt?: string
  avatarSrc?: string
  avatarAlt?: string
  avatarRotation?: number
  scrollProgress?: number
  characterSpacing?: number
  fullHeight?: boolean
  className?: string
  color?: string
}

export const InteractiveASCII = ({
  isDarkMode,
  asciiArt = `                                                                                                                                          *********                
                                                                                                       ****                             ****** *****               
                                                                                                 ************                           **** **** ***              
                                                                                             *******************                        ***** *** **               
                                                                                        ***************************                      *** **** **               
                                                                                   **********************************                      *******                 
                                                                              ******************************************                                           
                                                                         **************************************************                                        
                                                                    **********************************************************                                     
                                                               ******************************************************************                                  
                                                          ******************** ***** ***********************************************                               
                                                    *********************     *******     *********************************************                            
                                               *********************         *********         ******************************************                          
                                          *********************             ***********             ****************************************                       
                                     *********************                 *************                 **************************************                    
                                 ********************                     ***************                     ***********************************                  
                            *********************                       ******************                        **********************************               
                      ***********************                          *********************                          *********************************            
                 ***********************                              ***********************                              *******************************         
            ***********************                                  *************************                                  *****************************      
       ***********************                                      ***************************                                      ***************************   
 ************************                                          *****************************                                          ************************ 
***********************                                           *******************************                                           ***********************
  **************************                                       *****************************                                       ************************    
     ****************************                                   ***************************                                   ***********************          
        *****************************                                 ***********************                                 **********************               
           ******************************                              *********************                              *********************                    
             *********************************                          *******************                          *********************                         
                ***********************************                      *****************                      **********************                             
                   *************************************                  ***************                  **********************                                  
                     ****************************************              *************              **********************                                       
                        ******************************************          ***********          *********************                                             
                           ********************************************      ********       *********************                                                  
                              **********************************************   *****   *********************                                                       
                                 **********************************************************************                                                            
                                    *************************************************************                                                                  
                                      ******************************************************                                                                       
                                         **********************************************                                                                            
                                            ***************************************                                                                                
                                              ********************************                                                                                     
                                                 ************************                                                                                          
                                                    ****************                                                                                               
                                                       ********                                                                                                     `,
  avatarSrc,
  avatarAlt = "Avatar",
  avatarRotation = 0,
  scrollProgress = 0,
  characterSpacing = 0,
  fullHeight = false,
  className = "",
  color = "brand-cyan"
}: InteractiveASCIIProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | undefined>(undefined)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [wavePoints, setWavePoints] = useState<WavePoint[]>([])

  // Helper function to convert hex to rgba
  const hexToRgba = useCallback((hex: string, opacity: number) => {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r}, ${g}, ${b}, ${opacity})`
  }, [])

  // Helper function to get accent color
  const getAccentColor = useCallback(() => {
    return color
  }, [color])

  // Helper function to get accent color with opacity
  const getAccentColorWithOpacity = useCallback((opacity: number) => {
    return hexToRgba(color, opacity)
  }, [color, hexToRgba])

  // Helper function to get muted/foreground color
  const getMutedColor = useCallback(() => {
    return color
  }, [color])

  // Generate points from ASCII art
  const generatePointsFromASCII = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const points: WavePoint[] = []
    const lines = asciiArt.trim().split('\n')
    // Animate charSize and lineHeight based on scroll progress
    const baseCharSize = 16
    const baseLineHeight = 16
    const charSize = baseCharSize + (scrollProgress * 40) // Grows from 26 to 46
    const lineHeight = baseLineHeight + (scrollProgress * 40) // Grows from 26 to 46

    const totalWidth = Math.max(...lines.map(line => line.length)) * charSize * 0.6
    const totalHeight = lines.length * lineHeight

    const startX = (canvas.width - totalWidth) / 2
    const startY = (canvas.height - totalHeight) / 2

    lines.forEach((line, lineIndex) => {
      for (let charIndex = 0; charIndex < line.length; charIndex++) {
        const char = line[charIndex]
        if (char !== ' ') {
          const x = startX + charIndex * charSize * 0.6
          const y = startY + lineIndex * lineHeight

          points.push({
            x,
            y,
            originalX: x,
            originalY: y,
            char,
            opacity: 0.8,
            scale: 1,
            currentX: x,
            currentY: y,
            currentOpacity: 0.5,
            currentScale: 0.5
          })
        }
      }
    })

    setWavePoints(points)
  }, [asciiArt, scrollProgress])

  // Lerp function for smooth interpolation
  const lerp = (start: number, end: number, factor: number) => {
    return start + (end - start) * factor
  }

  // Calculate point position with vortex effect
  const calculatePointPosition = useCallback((point: WavePoint) => {
    const dx = point.originalX - mousePos.x
    const dy = point.originalY - mousePos.y
    const distance = Math.sqrt(dx * dx + dy * dy)

    let targetX = point.originalX + (characterSpacing * 5)
    let targetY = point.originalY
    let targetOpacity = 0.5
    let targetScale = 0.5
    let glow = 0

    const cursorRadius = 300
    const glowRadius = 10

    if (distance <= cursorRadius) {
      const dirX = dx / distance
      const dirY = dy / distance

      const tangX = -dirY
      const tangY = dirX

      const vortexIntensity = 0.15
      const falloff = Math.max(0, 2 - distance / cursorRadius)
      const attract = 0.1

      const tangentialForce = vortexIntensity * falloff
      const attractionForce = attract * falloff

      targetX = point.originalX + tangX * tangentialForce * 100 - dirX * attractionForce * 1
      targetY = point.originalY + tangY * tangentialForce * 100 - dirY * attractionForce * 1000

      const timeOffset = Date.now() * 1
      const subtleX = Math.sin(timeOffset + point.originalX * 1) * 0.3
      const subtleY = Math.cos(timeOffset + point.originalY * 1) * 0.3

      targetX += subtleX
      targetY += subtleY

      if (distance <= glowRadius) {
        const glowFalloff = Math.max(0, 1 - distance / glowRadius)
        glow = glowFalloff * 10
        targetOpacity = Math.min(1, 1 + glow)
        targetScale = 1 + glowFalloff * 0.15
      }
    }

    targetScale += Math.sin(Date.now() * 1 + point.originalX * 1) * 0.02

    // Slow motion return - lerp current position towards target
    const returnSpeed = 0.05 // Slow motion factor (0.05 = very slow return)
    const currentX = point.currentX ?? point.originalX
    const currentY = point.currentY ?? point.originalY
    const currentOpacity = point.currentOpacity ?? 0.5
    const currentScale = point.currentScale ?? 0.5

    const newX = lerp(currentX, targetX, returnSpeed)
    const newY = lerp(currentY, targetY, returnSpeed)
    const newOpacity = lerp(currentOpacity, targetOpacity, 0.1)
    const newScale = lerp(currentScale, targetScale, 0.1)

    // Update current position in point
    point.currentX = newX
    point.currentY = newY
    point.currentOpacity = newOpacity
    point.currentScale = newScale

    return {
      x: newX,
      y: newY,
      char: point.char,
      opacity: newOpacity,
      scale: newScale,
      glow
    }
  }, [mousePos, characterSpacing])

  // Render function
  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Animate font size based on scroll progress
    const baseFontSize = 20
    const fontSize = baseFontSize + (scrollProgress * 20) // Grows from 42 to 62
    ctx.font = `${fontSize}px "Courier New", monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    wavePoints.forEach(point => {
      const calculated = calculatePointPosition(point)

      ctx.save()
      // Increase base opacity for better visibility
      ctx.globalAlpha = Math.min(1, calculated.opacity * 0.8)

      if (calculated.glow > 0) {
        ctx.shadowColor = getAccentColor()
        ctx.shadowBlur = 10 + calculated.glow * 100
        ctx.fillStyle = getAccentColorWithOpacity(0.8 + calculated.glow * 0.2)
      } else {
        ctx.shadowBlur = 1
        ctx.fillStyle = getMutedColor()
      }

      ctx.translate(calculated.x, calculated.y)
      ctx.scale(calculated.scale, calculated.scale)

      ctx.fillText(calculated.char, 0, 0)
      ctx.restore()
    })

    animationRef.current = requestAnimationFrame(render)
  }, [wavePoints, calculatePointPosition, scrollProgress, getAccentColor, getAccentColorWithOpacity, getMutedColor])

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const updateCanvasSize = () => {
      const container = canvas.parentElement
      if (container) {
        canvas.width = container.offsetWidth
        canvas.height = container.offsetHeight
        generatePointsFromASCII()
      }
    }

    updateCanvasSize()
    window.addEventListener('resize', updateCanvasSize)

    return () => {
      window.removeEventListener('resize', updateCanvasSize)
    }
  }, [generatePointsFromASCII])

  // Mouse move handler
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      setMousePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      })
    }

    // Listen on both canvas and window for better coverage
    window.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('mousemove', handleMouseMove)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('mousemove', handleMouseMove)
    }
  }, [])

  // Start animation
  useEffect(() => {
    if (wavePoints.length > 0) {
      animationRef.current = requestAnimationFrame(render)
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [wavePoints, render])

  return (
    <div className={`relative w-full overflow-hidden ${fullHeight ? 'h-full' : 'h-90'} pointer-events-none ${className}`}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-auto"
      />
      {/* Avatar overlay */}
      {avatarSrc && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className="relative"
            style={{
              transform: `rotate(${avatarRotation + (scrollProgress * 180)}deg) scale(${1 - (scrollProgress * 1)}) translateY(${-scrollProgress * 100}px)`,
              transition: 'transform 200ms ease-out'
            }}
          >
            <img
              src={avatarSrc}
              alt={avatarAlt}
              className={`w-16 h-16 rounded-md border opacity-90 hover:opacity-100 transition-opacity duration-300 ${isDarkMode ? '' : 'invert'
                }`}
              style={{
                borderColor: isDarkMode ? hexToRgba(color, 0.2) : hexToRgba(color, 0.3)
              }}
            />
            {/* Glow effect */}
            <div
              className="absolute inset-0 w-20 h-20 rounded-md animate-pulse blur-sm"
              style={{
                backgroundColor: isDarkMode ? hexToRgba(color, 0.02) : hexToRgba(color, 0.06)
              }}
            ></div>
          </div>
        </div>
      )}
    </div>
  )
}
