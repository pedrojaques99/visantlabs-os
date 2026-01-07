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

export const InteractiveASCIICopy = ({
  isDarkMode,
  asciiArt = `                                                                                                                                     
                                                                 +~+~~~~~~~~~~~~~~~~~~~~~~~++                                                                 
                                                              ~~~~~~~~_[1(fxx~~~~~vx/1]~~~~~~~~~~                                                             
                                                           ~~~~~~+}|rxf1-+~~~~~~~~~~+_[(fr/[~~~~~~~~                                                          
                                                       ~~~~~~~+1fnt}_+~~~~~~~~~~~~~~~~~~~+_{tj(+~~~~~~~                                                       
                                                    ~~~~~~~~[trt}_+~~~~~~~+++~~~~~+++++~~~~~+_}/f)~~~~~~~+                                                    
                                                  ~~~~~~~~[rx([++++++++++++++~~~~~++++++++++++++])j|~~~~~~~+                                                  
                                               ~~~~~~~~~-tn([_+++++++++++++__~~~~~+-___++++++++++_](r|~~~~~~~~+                                               
                                             +~~~~~~~~~)vf{-+++++++++_______-~~~~~+]--______+++++++-}/r}~~~~~~~~~                                             
                                            ~~~~-~~~~+tx([_++++++___________-~~~~~+[]----________++__]1jt~~~~~~~~~                                            
                                          +~~~_+~~~~[xr1-_+++______________--~~~~~+}[]]-------________]{tn]~~~~~~~~~                                          
                                         ~~~~]~~~~~}vj1-_________________---]+~~~~+}[]]]-----------___-]}|x}~~~~+]~~~                                         
                                       +~~~-_+~~~~}vf{-________________-----]+~~~~+}}[]]]]]-------------]{/x{~~~~~}~~~~                                       
                                      ~+~~[_+~~~~]xj1-_____________--------]]+~~~~+{}[[]]]]]]]]]]]]]]]]]][{tv{~~~~+1+~~~                                      
                                     +~~~{--~~~~~1(-+~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~+_}|+~~~~[)]~~~                                     
                                    +~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~                                    
                                  <~~~~~~~~~~~~~~~~~~~~~~~~~++_-----]]]]][[[[+~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~+                                  
                                  ]}1))(/t]~~~[xnrfffffffjjjjjjjjjjjjjjjrrrxx{~~~~_cvnxxxrrrrrxxxxrrrrrjjjjjjjrx|~~~~~~~~~~+                                  
                                  +~+rrjft~~~~|Xj1]_______++++++++____--][}}{_~~~~~|()1111{{{{{111))(||//ttffjrzc+~~~+(|/_~~                                  
                                 +~~_1)(([~~~+rn(-_+++++++++++++++++___--][[}_~~~~~()11{{{}}}}}}{{{1))(((||////jX)~~~~1/(1~~~                                 
                                 ~~~{})))~~~~}vf{_++++++++++++++++++___-]][}{_~~~~~|()11{{{{{{{{{{11)))((((||||/vr~~~~_(()~~~                                 
                                ~~~~}1)){~~~~|c|]_++++++++++++++++++___-][[}{_~~~~~/()1111{{{{{{11111))))))))((|rc_~~~~}1)]~~+                                
                                ~~~]{)))-~~~+rn)-++++++++++++++++++____-][[}{_~~~~~/|))11111111111111111111111)(tc1~~~~_}1{~~~                                
                                ~~~}1)))+~~~-vr1_++++++++++++++++++___--][}}1_~~~~~/|()11111111111111111{{{{}}{)/n/~~~~+-}1~~~<                               
                               ~~~~11)))~~~~}zf}_++++++++++++++++++___--][}{1_~~~~~/|())1111111111111{{{}}}}}}})|xj~~~~~+]{-~~+                               
                               +~~+11))1~~~~{Xt}_+++++++++++++++++____-]][}{1_~~~~~/|())1111111111{{{{}}}[[[[[}1|xx~~~~~+-}]~~+                               
                               ++~+1)((1~~~~1Xt}_+++++++++++++++++____-][[}{1-~~~~~/|())111111111{{{}}}}[[[[[[[1|rx~~~~~++[[~~+                               
                               ~+~+1)((1~~~~1Xt}_+++++++++++++++++____-][[}{1-~~~~~/|())11111111{{{}}}}[[[[[[[[1|rx~~~~~++][~~+                               
                               ~~~+1)(()~~~~{Xt}_+++++++++++++++++____-][}}{1-~~~~~/|())1111111{{{}}}[[[[[[[][[1|xx~~~~~++[]~~~                               
                               ~~~~1)(((~~~~}Xf{___++++++++++++++____--][}{11-~~~~~/|())111111{{{}}[[[[[[]]]][[1|xr~~~~~~+[_~+~                               
                                +~~})(((+~~~]cr1-_________+++++______-][[}{1)-~~~~~/|())11111{{}}}[[[[[[[]]]][}1/vt~~~~~~+[~~~+                               
                                ~~~]1||(]~~~+xn(]___________________-]][}{{1)-~~~~~/|())1111{{}}}[[[[]]]]]]]][})tc)~~~~~~+[~~~                                
                                ]+~~{(||1~~~~tc/}--_____________---]][[}}{11)]~~~~~/|())111{{}}[[[]]]]]]]]]]][{(jz]~~~~~~--~~~                                
                                 ~~~{1|||~~~~1cj1[]]-----]--]]]]]][[[}}{{11))]~~~~~/|())11{{}}[[[]]]]]]]]]]]][1/nn~~~~~~+[~~~                                 
                                 1~~+1(||}~~~_nn|1}}}}}}}}}}}}[}}}}}{{{1111)(]~~~~~/|())1{{}}[[[]]]]][[[[]]][}(fX(~~~~~~_{~~<                                 
                                  +~~)|(((~~~~tzf(1111111111{{{{{{{{111111))(]~~~~~t|())1{{}}[[[[[[[[}}}}}}}})tvc-~~~~[1f]~~                                  
                                  +~~~~~+_+~~~{cnjt/||(()))))1111))))))(((||/[~~~~~rjftt//////|////tttffjjrxxncXf~~~~~_~~~~~                                  
                                  ][]_~~~~~~~~~~~~~~~~~~~~~~~~~~~+++_--][[}{{+~~~~~|()1{}[[]]--_+++~~~~~~~~~~~~~~~~~~~~~~~~~                                  
                                    )[[{{[-~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~+~                                   
                                     {~~~/tf}~~~[tt()1{{}[]]-__+~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~+~~~~~~-]~~+                                     
                                      }+~~)/t[~~~{zxttfjjjjjjjjjjjjjjjffjjjjr|+~~~~|(1{}}}[[[[[[]]]]]]]]]}(jYx~~~~~[_~+~                                      
                                       )+~~}|/[~~~)cj/tfffffffffffffffffjjjrx|_~~~~/()1{{}}}[[[]]]]]]--][)fzx~~~~~]~~+~                                       
                                         }~~+(|[~~~(zr/ttffffffffffffffffjjrx|-+~~+t|)1{}}}[[]]]]]-----[)fzr~~~~~]~~~                                         
                                          )_~~]({~~~1cx//tffffffffffffffjjjrx|[-~~+t|(1{}}[[]]]-------}(rYf~~~~~~~~~                                          
                                            )~~~}1_~~-xnt/tfffffffffffjjjjrrx|}]~~_t/(1{}[[]]---____]{/nz(~~~~~~~+                                            
                                              {~~~}]~~~tcj/tffffjjjjjjjjjjrxn/1[~~]t/(){}[]---__++-[(jzr-~~~~~~~~                                             
                                               |)-~_)~~~[xnt|tfjjjjjjjjjjrrxn/)}~~}f/|){}]-__+++_]1fcz)~~~~~~~~                                               
                                                  |[~1[~~~{vnt|/ffjjjjjjrrrxn/({~~{ft|){[]-++++])fvz|~~~~~+~                                                  
                                                    t()(]~~~}jnj/|tfjjjjrrxnnt|{~~(ft|(1}]__-{|xzv)+~_~+~~                                                    
                                                       ft|[~~~+|xvj/|/tjjrxnnt/1~~/ft/|(11)tnXct]~_]~+~                                                       
                                                           /1~~~~+1fnvxf//fjxt/1~~tjjfjnzJXx|]~-}]~~                                                          
                                                             t([~~~~~~-1/rvzv//{~~zzvnj/)}[}11}_~                                                             
                                                                 ({]_+~~~~~~~}/}~{rjjft/|(1{[+                                                                
                                                                       `,
  avatarSrc,
  avatarAlt = "Avatar",
  avatarRotation = 0,
  scrollProgress = 0,
  characterSpacing = 0,
  fullHeight = false,
  className = "",
  color = "#brand-cyan"
}: InteractiveASCIIProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | undefined>(undefined)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [wavePoints, setWavePoints] = useState<WavePoint[]>([])
  const lastMouseUpdateRef = useRef<number>(0)
  const frameSkipRef = useRef<number>(0)

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

    // Calculate dimensions to fill the entire screen
    const maxLineLength = Math.max(...lines.map(line => line.length))
    const numLines = lines.length

    // Calculate optimal character size and spacing to fill the canvas
    // Use 90% of canvas to leave some padding
    const padding = 0.05
    const availableWidth = canvas.width * (1 - padding * 2)
    const availableHeight = canvas.height * (1 - padding * 2)

    // Calculate character width and height to fill the screen
    // For monospace fonts, approximate width is about 0.6 of height
    const charWidth = availableWidth / maxLineLength
    const charHeight = availableHeight / numLines

    // Use the smaller dimension to maintain aspect ratio
    const charSize = Math.min(charWidth / 0.6, charHeight)
    const lineHeight = charSize

    // Calculate spacing between characters (horizontal)
    const charSpacing = charWidth

    // Center the content
    const totalWidth = maxLineLength * charSpacing
    const totalHeight = numLines * lineHeight

    const startX = (canvas.width - totalWidth) / 2
    const startY = (canvas.height - totalHeight) / 2

    // Optimize: reduce point density for better performance
    // Skip every other character if there are too many points
    const skipFactor = maxLineLength * numLines > 5000 ? 2 : 1

    lines.forEach((line, lineIndex) => {
      for (let charIndex = 0; charIndex < line.length; charIndex += skipFactor) {
        const char = line[charIndex]
        if (char !== ' ') {
          const x = startX + charIndex * charSpacing
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

  // Calculate point position with vortex effect (optimized)
  const calculatePointPosition = useCallback((point: WavePoint) => {
    const dx = point.originalX - mousePos.x
    const dy = point.originalY - mousePos.y
    const distanceSquared = dx * dx + dy * dy
    const cursorRadiusSquared = 150 * 150

    let targetX = point.originalX
    let targetY = point.originalY
    let targetOpacity = 0.5
    let targetScale = 0.5
    let glow = 0

    // Only calculate expensive operations if within cursor radius
    if (distanceSquared <= cursorRadiusSquared) {
      const distance = Math.sqrt(distanceSquared)
      const cursorRadius = 150
      const glowRadius = 5

      const dirX = dx / distance
      const dirY = dy / distance

      const tangX = -dirY
      const tangY = dirX

      const vortexIntensity = 0.04
      const falloff = Math.max(0, 2 - distance / cursorRadius)
      const attract = 0.02

      const tangentialForce = vortexIntensity * falloff
      const attractionForce = attract * falloff

      targetX = point.originalX + tangX * tangentialForce * 20 - dirX * attractionForce * 1
      targetY = point.originalY + tangY * tangentialForce * 20 - dirY * attractionForce * 30

      // Reduce subtle animation for performance
      if (distance <= glowRadius) {
        const glowFalloff = Math.max(0, 1 - distance / glowRadius)
        glow = glowFalloff * 2
        targetOpacity = Math.min(1, 1 + glow)
        targetScale = 1 + glowFalloff * 0.04
      }
    }

    // Remove constant subtle animation to reduce calculations
    // targetScale += Math.sin(Date.now() * 1 + point.originalX * 1) * 0.008

    // Faster return for better performance
    const returnSpeed = 0.25
    const currentX = point.currentX ?? point.originalX
    const currentY = point.currentY ?? point.originalY
    const currentOpacity = point.currentOpacity ?? 0.5
    const currentScale = point.currentScale ?? 0.5

    const newX = lerp(currentX, targetX, returnSpeed)
    const newY = lerp(currentY, targetY, returnSpeed)
    const newOpacity = lerp(currentOpacity, targetOpacity, 0.15)
    const newScale = lerp(currentScale, targetScale, 0.15)

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

  // Render function (optimized with frame skipping)
  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Frame skip for better performance with many points
    frameSkipRef.current++
    const shouldSkip = frameSkipRef.current % 2 === 0 && wavePoints.length > 3000
    if (shouldSkip) {
      animationRef.current = requestAnimationFrame(render)
      return
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Cache font size calculation
    const lines = asciiArt.trim().split('\n')
    const maxLineLength = Math.max(...lines.map(line => line.length))
    const numLines = lines.length

    const padding = 0.05
    const availableWidth = canvas.width * (1 - padding * 2)
    const availableHeight = canvas.height * (1 - padding * 2)

    const charWidth = availableWidth / maxLineLength
    const charHeight = availableHeight / numLines
    const fontSize = Math.min(charWidth / 0.6, charHeight)

    ctx.font = `${fontSize}px "Courier New", monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // Optimize rendering: batch operations
    const accentColor = getAccentColor()
    const mutedColor = getMutedColor()

    wavePoints.forEach(point => {
      const calculated = calculatePointPosition(point)

      ctx.save()
      ctx.globalAlpha = Math.min(1, calculated.opacity * 0.8)

      if (calculated.glow > 0) {
        ctx.shadowColor = accentColor
        ctx.shadowBlur = 3 + calculated.glow * 15
        ctx.fillStyle = getAccentColorWithOpacity(0.8 + calculated.glow * 0.2)
      } else {
        ctx.shadowBlur = 0 // Disable shadow for better performance
        ctx.fillStyle = mutedColor
      }

      ctx.translate(calculated.x, calculated.y)
      ctx.scale(calculated.scale, calculated.scale)

      ctx.fillText(calculated.char, 0, 0)
      ctx.restore()
    })

    animationRef.current = requestAnimationFrame(render)
  }, [wavePoints, calculatePointPosition, scrollProgress, getAccentColor, getAccentColorWithOpacity, getMutedColor, asciiArt])

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

  // Mouse move handler (throttled for performance)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleMouseMove = (e: MouseEvent) => {
      const now = Date.now()
      // Throttle mouse updates to 60fps max (16ms)
      if (now - lastMouseUpdateRef.current < 16) return
      lastMouseUpdateRef.current = now

      const rect = canvas.getBoundingClientRect()
      setMousePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      })
    }

    // Listen on both canvas and window for better coverage
    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    canvas.addEventListener('mousemove', handleMouseMove, { passive: true })

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
        style={{ willChange: 'transform' }}
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
