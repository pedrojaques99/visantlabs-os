'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Mail, Instagram, Globe, Code, Palette, Coffee, Sparkles, X } from 'lucide-react'
import PixelModeToggle from '@/components/PixelModeToggle'
import { UniversalFooter } from '@/components/UniversalFooter'
import { ToolIcon, MinimalParticleBackground } from '@/components/shared'
import { HeroSection, Sidebar, RepellantText } from './homepage'
import { AboutCard } from './AboutCard'
import { useTheme } from '@/contexts/ThemeContext'

export function VisantHomepage() {
  const [currentTime, setCurrentTime] = useState('')
  const [showLoadingText, setShowLoadingText] = useState(true)
  const { isLightMode, toggleLightMode } = useTheme()
  const isDarkMode = !isLightMode
  
  // Windows Explorer style navigation - expanded/collapsed state
  const [navStates, setNavStates] = useState({
    tools: false,
    team: false,
    contact: false,
    works: false,
    about: false,
    allTools: false // Subfolder state for "All Tools"
  })
  
  // Currently selected section (like selected folder in Explorer)
  const [selectedSection, setSelectedSection] = useState<string | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)
  const [displayedSection, setDisplayedSection] = useState<string | null>(null)

  // Sync displayedSection with selectedSection on mount
  useEffect(() => {
    setDisplayedSection(selectedSection)
  }, [])
  
  // Cursor state
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [isOverLink, setIsOverLink] = useState(false)

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setCurrentTime(now.toLocaleTimeString('en-US', { 
        hour12: false,
        timeZone: 'America/Sao_Paulo'
      }))
    }
    
    updateTime()
    const interval = setInterval(updateTime, 1000)
    
    const loadingTimer = setTimeout(() => {
      setShowLoadingText(false)
    }, 1000)
    
    return () => {
      clearInterval(interval)
      clearTimeout(loadingTimer)
    }
  }, [])

  // Optimized mouse movement with throttling
  useEffect(() => {
    let ticking = false
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!ticking) {
        requestAnimationFrame(() => {
          setMousePos({
            x: e.clientX,
            y: e.clientY
          })
          
          // Check if hovering over a link - only when necessary
          const target = e.target as HTMLElement
          const isLink = target.tagName === 'A' || target.closest('a')
          setIsOverLink(!!isLink)
          
          ticking = false
        })
        ticking = true
      }
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])


  // Toggle navigation folder (expand/collapse in tree view)
  const toggleNavFolder = useCallback((folderType: 'tools' | 'team' | 'about' | 'contact' | 'works' | 'allTools') => {
    setNavStates(prev => ({
      ...prev,
      [folderType]: !prev[folderType]
    }))
  }, [])

  // Select section (like clicking a folder in Explorer)
  const selectSection = useCallback((section: 'tools' | 'team' | 'about' | 'contact' | 'works') => {
    if (selectedSection !== section && displayedSection !== null) {
      // Animate out old section first
      setIsAnimating(true)
      setTimeout(() => {
        setDisplayedSection(section)
        setSelectedSection(section)
        setTimeout(() => {
          setIsAnimating(false)
        }, 50)
      }, 150)
    } else {
      // No previous section, animate in directly
      setIsAnimating(true)
      setDisplayedSection(section)
      setSelectedSection(section)
      setTimeout(() => {
        setIsAnimating(false)
      }, 50)
    }
    // Don't auto-expand folders - user must click on items inside to open content panel
  }, [selectedSection, displayedSection])

  // Handle deselection with animation
  const handleDeselectSection = useCallback(() => {
    if (displayedSection !== null) {
      setIsAnimating(true)
      setTimeout(() => {
        setSelectedSection(null)
        setDisplayedSection(null)
        setIsAnimating(false)
      }, 150)
    }
  }, [displayedSection])


  // Memoized data to prevent unnecessary re-renders
  const visantWorks = useMemo(() => [
    { 
      title: 'TRINITY PROJECT', 
      year: '2025', 
      medium: 'BRAND IDENTITY',
      image: '/visant-works/Trinity 02.png',
      description: 'BRAND IDENTITY'
    },
    { 
      title: 'CALHA NORTE', 
      year: '2025', 
      medium: 'DIGITAL DESIGN',
      image: '/visant-works/Calha Norte - 04.png',
      description: 'BRAND IDENTITY'
    },
    { 
      title: 'CARDS TYPPER', 
      year: '2025', 
      medium: 'UI/UX DESIGN',
      image: '/visant-works/cards - typper.webp',
      description: 'BRAND DESIGN'
    },
    { 
      title: 'PORTFOLIO TRINITY', 
      year: '2025', 
      medium: 'VISUAL DESIGN',
      image: '/visant-works/Portf - Trinity - 11.png',
      description: 'BRAND DESIGN'
    },
    { 
      title: 'EXPERIMENTAL 35', 
      year: '2025', 
      medium: 'DIGITAL ART',
      image: '/visant-works/35.png',
      description: 'BRAND DESIGN'
    },
    { 
      title: 'MINIMAL 53', 
      year: '2025', 
      medium: 'GRAPHIC DESIGN',
      image: '/visant-works/53-min.png',
      description: 'BRAND DESIGN'
    },
    { 
      title: 'ABSTRACT 56', 
      year: '2025', 
      medium: 'EXPERIMENTAL',
      image: '/visant-works/56.png',
      description: 'BRAND DESIGN'
    }
  ], [])

  const tools = useMemo(() => [
    { 
      name: 'YOUTUBE MIXER', 
      desc: 'Connect multiple YouTube videos simultaneously, control audio levels and create live mixes',
      link: '/youtube-mixer', 
      icon: 'youtube',
      thumbnail: '/tools/youtube-mixer.png',
      badge: 'feature',
      showExternalLink: true
    },
    { 
      name: 'IMAGE ASCII VORTEX', 
      desc: 'Transform images into interactive ASCII art with mouse-responsive vortex effects',
      link: '/ascii-vortex', 
      icon: 'vortex',
      thumbnail: '/tools/ascii-vortex.png',
      showExternalLink: true
    },
    { 
      name: 'GRID PAINT', 
      desc: 'Minimalist vector drawing tool with grid-based precision and export capabilities',
      link: '/grid-paint', 
      icon: 'grid-paint',
      thumbnail: '/tools/gridpaint.png',
      showExternalLink: true
    },
    { 
      name: 'ELLIPSE AUDIO FREQ', 
      desc: 'Circular audio spectrum analyzer with elliptical frequency visualization patterns',
      link: '/elipse-audio-freq', 
      icon: 'ellipse-audio',
      thumbnail: '/tools/elipse-audio.png',
      showExternalLink: true
    },
    { 
      name: 'COLOR EXTRACTOR', 
      desc: 'Extract beautiful color palettes from any image with AI-powered analysis',
      link: 'https://gradient-machine.vercel.app/', 
      icon: 'palette',
      thumbnail: '/tools/color-extractor.png',
      showExternalLink: true
    },
    { 
      name: 'HALFTONE MACHINE', 
      desc: 'Retro halftone pattern processor for images and videos with customizable effects',
      link: 'https://pedrojaques99.github.io/halftone-machine/', 
      icon: 'halftone',
      thumbnail: '/tools/halftone-machine.png',
      showExternalLink: true
    },
    { 
      name: 'MORE TOOLS',
      desc: 'Experimental interactive effects laboratory with particle systems and visual algorithms',
      link: '/vsn-labs', 
      icon: 'vsn-labs',
      thumbnail: '/tools/vsn-labs.png',
      showExternalLink: true
    }
  ], [])

  const teamMembers = useMemo(() => [
    {
      name: 'PEDRO JAQUES',
      role: 'CREATIVE DIRECTOR',
      profile: '/jaques-profile',
      status: 'ONLINE',
      avatar: '/avatars/jacao.webp'
    },
    {
      name: 'PEDRO XAVIER',
      role: 'CREATIVE DIRECTOR',
      profile: '/pedro-xavier',
      status: 'ONLINE',
      avatar: '/avatars/pedro.webp'
    }
  ], [])

  const [isOverASCII, setIsOverASCII] = useState(false)

  return (
    <div className={`min-h-screen font-mono overflow-hidden relative transition-colors duration-300 ease-out scroll-smooth ${
      isDarkMode 
        ? 'bg-black text-gray-400' 
        : 'bg-gray-100 text-gray-700'
    }`}>
      {/* Custom cursor only for ASCII art area */}
      {isOverASCII && (
      <style jsx global>{`
        * {
          cursor: none !important;
        }
      `}</style>
      )}
      {/* Interactive Background */}
      <MinimalParticleBackground />
      
      {/* Optimized Scanlines Effect */}
      <div className="fixed inset-0 pointer-events-none z-10">
        <div className="absolute inset-0 opacity-5" 
             style={{
               backgroundImage: `repeating-linear-gradient(
                 0deg,
                 transparent,
                 transparent 2px,
                 rgba(255, 255, 255, 0.05) 2px,
                 rgba(255, 255, 255, 0.05) 4px
               )`
             }}>
        </div>
      </div>


      {/* Terminal Header - Fixed */}
      <div className={`fixed top-0 left-0 right-0 z-50 ${
        isDarkMode ? 'bg-black backdrop-blur-md' : 'bg-gray-100 backdrop-blur-md'
      }`}>
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <img 
                src="/avatars/visant.png" 
                alt="Visant"
                className={`w-6 h-6 object-contain ${isDarkMode ? '' : 'invert'}`}
              />
              <span className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>VISANT.CO STUDIO</span>
            </div>
            <div className="flex items-center gap-4">
              <PixelModeToggle 
                isDarkMode={isDarkMode}
                onClick={toggleLightMode}
              />
              <span className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>BRASIL [{currentTime}]</span>
            </div>
          </div>
          {showLoadingText && (
            <div className="text-center text-xs text-gray-500 transition-opacity duration-500 px-4 py-4 mt-2">
              {'>'} ACCESSING STUDIO... CONNECTION ESTABLISHED
            </div>
          )}
        </div>
      </div>

      <div className="relative z-20 p-4 md:p-8 max-w-7xl mx-auto -mt-4 md:-mt-8 pt-20 md:pt-24">

        {/* Content appears only after loading */}
        {!showLoadingText && (
          <div className="animate-in fade-in duration-500">
            {/* ASCII Art - Always visible */}
            <div 
              onMouseEnter={() => setIsOverASCII(true)}
              onMouseLeave={() => setIsOverASCII(false)}
            >
            <HeroSection 
              isDarkMode={isDarkMode} 
              showLoadingText={showLoadingText}
              />
                    </div>
                    
            {/* Windows Explorer Style Layout */}
            <div className="flex flex-col md:flex-row gap-4 mt-12 transition-all duration-200 ease-out">
              {/* Sidebar Navigation - Windows Explorer Style */}
              <Sidebar
                navStates={navStates}
                selectedSection={selectedSection}
                tools={tools}
                teamMembers={teamMembers}
                onToggleFolder={toggleNavFolder}
                onSelectSection={selectSection}
                onDeselectSection={handleDeselectSection}
              />

              {/* Main Content Area - Windows Explorer Style */}
              <div className="flex-1 min-w-0 relative">
                {displayedSection === 'tools' && (
                  <div className={`border p-6 rounded-lg relative glass-theme transition-all duration-200 ease-out ${
                    isAnimating 
                      ? 'opacity-0 translate-x-4 scale-95' 
                      : 'opacity-100 translate-x-0 scale-100'
                  }`}>
                      <button
                      onClick={handleDeselectSection}
                      className={`absolute top-4 right-4 p-1 rounded transition-colors text-theme-secondary hover:text-theme hover:bg-theme-glass-hover`}
                      >
                      <X size={16} />
                      </button>
                    <div className="text-lg font-bold mb-6 text-theme">
                      🛠️ Tools ({tools.length} items)
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {tools.map((tool, index) => (
                        <a 
                          key={index}
                          href={tool.link}
                          target={tool.link.startsWith('http') ? '_blank' : '_self'}
                          rel={tool.link.startsWith('http') ? 'noopener noreferrer' : undefined}
                          onClick={(e) => e.stopPropagation()}
                        >
                  <AboutCard
                    title={tool.name}
                    subtitle={tool.desc}
                    thumbnail={tool.thumbnail || undefined}
                    icon={tool.thumbnail ? undefined : <ToolIcon type={tool.icon} size={24} />}
                    badge={'badge' in tool ? tool.badge : undefined}
                    showExternalLink={'showExternalLink' in tool ? tool.showExternalLink : undefined}
                  />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {displayedSection === 'team' && (
                  <div className={`border p-6 rounded-lg relative glass-theme transition-all duration-200 ease-out ${
                    isAnimating 
                      ? 'opacity-0 translate-x-4 scale-95' 
                      : 'opacity-100 translate-x-0 scale-100'
                  }`}>
                        <button
                      onClick={handleDeselectSection}
                      className="absolute top-4 right-4 p-1 rounded transition-colors text-theme-secondary hover:text-theme hover:bg-theme-glass-hover"
                        >
                      <X size={16} />
                        </button>
                    <div className="text-lg font-bold mb-6 text-theme">
                      👥 Team ({teamMembers.length} members)
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {teamMembers.map((member, index) => (
                        <a 
                          key={index}
                          href={member.profile}
                          className={`group flex items-center gap-6 p-6 border rounded-lg transition-all duration-500 ease-in-out hover:scale-[1.02] hover:shadow-lg ${
                            isDarkMode 
                              ? 'border-gray-600/30 bg-black/20 hover:border-gray-400/60 hover:bg-black/40 hover:shadow-gray-900/20' 
                              : 'border-gray-300/50 bg-white/40 hover:border-gray-400/80 hover:bg-white/60 hover:shadow-gray-200/20'
                          }`}
                        >
                          <div className="flex-shrink-0 w-16 h-16 flex items-center justify-center">
                            <div className="relative">
                              <img 
                                src={member.avatar} 
                                alt={member.name}
                                className={`w-16 h-16 rounded-full border-2 shadow-lg opacity-90 group-hover:opacity-100 transition-all duration-500 ease-in-out ${
                                  isDarkMode 
                                    ? 'border-cyan-400/30 shadow-cyan-400/20' 
                                    : 'border-cyan-600/40 shadow-cyan-600/30 invert'
                                }`}
                              />
                              <div className={`absolute inset-0 w-16 h-16 rounded-full animate-pulse blur-sm ${
                                isDarkMode 
                                  ? 'bg-cyan-400/10' 
                                  : 'bg-cyan-600/8'
                              }`}></div>
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2">
                              <span className={`text-sm font-mono ${isDarkMode ? 'text-gray-500' : 'text-gray-700'}`}>
                                {String(index + 1).padStart(2, '0')}
                              </span>
                              <h3 className={`text-lg font-bold transition-colors duration-500 ease-in-out ${
                                isDarkMode 
                                  ? 'text-gray-200 group-hover:text-[#52ddeb]' 
                                  : 'text-gray-900 group-hover:text-[#52ddeb]'
                              }`}>
                                {member.name}
                              </h3>
                            </div>
                            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-700'}`}>
                              {member.role}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <div className={`flex-shrink-0 text-lg transition-colors duration-500 ease-in-out ${
                              isDarkMode 
                                ? 'text-gray-600 group-hover:text-gray-400' 
                                : 'text-gray-700 group-hover:text-gray-900'
                            }`}>
                              →
                            </div>
                            <span className={`text-sm font-medium animate-pulse ${
                              member.status === 'ONLINE' ? 'text-green-400' : 'text-blue-400'
                            }`}>
                              ● {member.status}
                            </span>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {displayedSection === 'about' && (
                  <div className={`border p-6 rounded-lg relative glass-theme transition-all duration-200 ease-out ${
                    isAnimating 
                      ? 'opacity-0 translate-x-4 scale-95' 
                      : 'opacity-100 translate-x-0 scale-100'
                  }`}>
                          <button
                      onClick={handleDeselectSection}
                      className="absolute top-4 right-4 p-1 rounded transition-colors text-theme-secondary hover:text-theme hover:bg-theme-glass-hover"
                          >
                      <X size={16} />
                          </button>
                    <div className="font-mono text-sm text-theme">
                      <div className="mb-4 text-xs text-theme-secondary">
                        about.txt
                      </div>
                      <div className="space-y-1 leading-relaxed">
                        <div>VISANT STUDIO</div>
                        <div className="text-theme-secondary">─────────────</div>
                        <div></div>
                        <div>Independent creative lab based in Brazil.</div>
                        <div>We love to experiment with design and technology.</div>
                        <div></div>
                        <div className="text-theme-secondary">─</div>
                        <div></div>
                        <div>What we do:</div>
                        <div>• Brand identity & visual systems</div>
                        <div>• Interactive web experiences</div>
                        <div>• Design experiments & tools</div>
                        <div>• Creative technology</div>
                        <div></div>
                        <div className="text-theme-secondary">─</div>
                        <div></div>
                        <div>Our approach:</div>
                        <div>• Bridge art and code</div>
                        <div>• Focus on interactiveness & innovation</div>
                        <div>• Open source mindset</div>
                        <div></div>
                        <div className="text-theme-secondary">─</div>
                        <div></div>
                        <div className="text-xs text-theme-secondary">
                          Feel free to use our open assets.
                    </div>
                        </div>
                      </div>
                    </div>
                  )}
                  

                {displayedSection === 'works' && (
                  <div className={`border p-6 rounded-lg relative glass-theme transition-all duration-200 ease-out ${
                    isAnimating 
                      ? 'opacity-0 translate-x-4 scale-95' 
                      : 'opacity-100 translate-x-0 scale-100'
                  }`}>
                        <button
                      onClick={handleDeselectSection}
                      className="absolute top-4 right-4 p-1 rounded transition-colors text-theme-secondary hover:text-theme hover:bg-theme-glass-hover"
                        >
                      <X size={16} />
                        </button>
                    <div className="text-lg font-bold mb-6 text-theme">
                      🎨 Portfolio
                    </div>
                  <div className={`p-6 border rounded-lg transition-all duration-500 ease-in-out ${
                    isDarkMode 
                      ? 'border-gray-600/30 bg-gradient-to-r from-gray-800/20 to-transparent hover:from-gray-700/30 hover:to-transparent' 
                      : 'border-gray-300/40 bg-gradient-to-r from-gray-100/20 to-transparent hover:from-gray-200/30 hover:to-transparent'
                  }`}>
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                      <div className="flex items-center gap-4">
                        <div className={`transition-colors duration-500 ease-in-out ${
                          isDarkMode ? 'text-gray-400' : 'text-gray-800'
                        }`}>
                          <ToolIcon type="vsn-labs" size={32} />
                        </div>
                        <div className="text-center md:text-left">
                          <h3 className={`text-lg font-bold transition-colors duration-500 ease-in-out ${
                            isDarkMode ? 'text-gray-100' : 'text-gray-900'
                          }`}>
                              VISANT STUDIO PORTFOLIO
                          </h3>
                          <p className={`text-sm transition-colors duration-500 ease-in-out ${
                            isDarkMode ? 'text-gray-300' : 'text-gray-800'
                          }`}>
                            Explore our complete portfolio of branding, digital design, and creative projects
                          </p>
                        </div>
                      </div>
                      <a 
                        href="https://www.visant.co/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`px-6 py-3 text-sm font-medium rounded-lg transition-all duration-500 ease-in-out hover:scale-105 shadow-lg ${
                          isDarkMode 
                            ? 'bg-gray-700/20 text-gray-300 border border-gray-600/40 hover:bg-gray-600/30 hover:border-gray-500/60 hover:shadow-gray-600/20' 
                            : 'bg-gray-600/20 text-gray-700 border border-gray-400/40 hover:bg-gray-500/30 hover:border-gray-400/60 hover:shadow-gray-500/20'
                        }`}
                      >
                        VIEW PORTFOLIO →
                      </a>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* Large VISANT Outline Text - Breaking out of container */}
            <div className="relative w-screen left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] mb-16 overflow-hidden">
              <div className={`text-center select-none relative ${
                isDarkMode ? 'text-black' : 'text-white'
              }`}>
                <RepellantText
                  isDarkMode={isDarkMode}
                  className={`text-[clamp(12rem,25vw,32rem)] font-black leading-none tracking-tight font-mono ${
                    isDarkMode 
                      ? 'text-transparent' 
                      : 'text-transparent'
                  }`}
                  style={{
                    WebkitTextStroke: isDarkMode ? '1px #ffffff' : '1px #000000',
                    color: 'transparent',
                    opacity: 0.15,
                    imageRendering: 'crisp-edges',
                    WebkitFontSmoothing: 'none',
                    MozOsxFontSmoothing: 'grayscale',
                    textShadow: `
                      0 0 1px currentColor,
                      1px 1px 0 ${isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'},
                      -1px -1px 0 ${isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}
                    `,
                    filter: 'contrast(1.2) brightness(0.9)'
                  } as React.CSSProperties}
                >
                  VISANT
                </RepellantText>
                
                {/* Contact Panel - Overlapping VISANT text */}
                <div className="absolute inset-0 flex items-center justify-center z-10">
                  <div className={`text-sm space-y-2 text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-800'}`}>
                    <div className="font-medium mb-1">CONTACT</div>
                    <div className="text-xs space-y-1">
                      <div>
                        <span className={`${isDarkMode ? 'text-gray-500' : 'text-gray-700'}`}>WEBSITE:</span> 
                        <a href="https://visant.co" target="_blank" rel="noopener noreferrer" className="text-[#52ddeb] hover:text-[#52ddeb]/80 transition-colors ml-1">visant.co</a>
                      </div>
                      <div>
                        <span className={`${isDarkMode ? 'text-gray-500' : 'text-gray-700'}`}>LOCATION:</span> 
                        <span className="ml-1">Brazil</span>
                      </div>
                      <div>
                        <span className={`${isDarkMode ? 'text-gray-500' : 'text-gray-700'}`}>STATUS:</span> 
                        <span className={`${isDarkMode ? 'text-gray-300' : 'text-gray-900'} ml-1 animate-pulse font-bold`}>● ACTIVE</span>
                      </div>
                      <div className="flex items-center justify-center gap-3">
                        <a 
                          href="mailto:contato@visant.co" 
                          className="text-[#52ddeb] hover:text-[#52ddeb]/80 transition-colors"
                          title="Email: contato@visant.co"
                        >
                          <Mail size={18} />
                        </a>
                        <a 
                          href="https://instagram.com/visant.co" 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-[#52ddeb] hover:text-[#52ddeb]/80 transition-colors"
                          title="Instagram: @visant.co"
                        >
                          <Instagram size={18} />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Static scanlines effect for better performance */}
              <div className="absolute inset-0 -z-10 opacity-5">
                <div className="w-full h-full" 
                     style={{
                       backgroundImage: `repeating-linear-gradient(
                         0deg,
                         transparent,
                         transparent 2px,
                         ${isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'} 2px,
                         ${isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'} 4px
                       )`
                     }}>
                </div>
              </div>
            </div>

            {/* Universal Footer */}
            <UniversalFooter isDarkMode={isDarkMode} />
          </div>
        )}
      </div>

        {/* Custom Cursor with Effect Area - Only visible when hovering ASCII art */}
        {isOverASCII && (
        <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 60 }}>
          <div 
            className={`absolute -translate-x-1/2 -translate-y-1/2 ${
              isOverLink ? 'w-2 h-2' : 'w-3 h-3'
            }`}
            style={{ 
              left: mousePos.x, 
              top: mousePos.y 
            }}
          >
            {/* Dynamic cursor based on hover state */}
            <div className={`w-full h-full rounded-full shadow-lg ${
              isOverLink 
                ? 'bg-cyan-400 border-2 border-cyan-300 shadow-cyan-400/50' 
                : 'bg-white border border-gray-300'
            }`}></div>
          </div>
          
          {/* Effect area circle - only show when not over link */}
          {!isOverLink && (
          <div 
            className="absolute border border-white/20 rounded-full"
            style={{ 
              left: mousePos.x - 100, 
              top: mousePos.y - 100,
              width: 200,
              height: 200,
              borderStyle: 'dashed'
            }}
          ></div>
          )}
          
          {/* Link hover effect - pulsing ring */}
          {isOverLink && (
            <div 
              className="absolute border-2 border-cyan-400/60 rounded-full animate-pulse"
              style={{ 
                left: mousePos.x - 20, 
                top: mousePos.y - 20,
                width: 40,
                height: 40,
              }}
            ></div>
          )}
      </div>
        )}
    </div>
  )
}

