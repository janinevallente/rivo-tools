import { useState, useRef, useEffect } from 'react'
import { Search } from 'lucide-react'
import { tools } from '../../data/toolsData'

export default function PageHeader({ icon: Icon, title, description, badge = null }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  const filteredTools = tools.filter(tool =>
    tool.label.toLowerCase().includes(searchQuery.toLowerCase())
  )

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className={`mb-6 sm:mb-8 flex flex-col-reverse lg:flex-row lg:items-start lg:justify-between gap-4 relative ${isOpen ? 'z-[1050]' : 'z-10'}`}>
      
      {/* Title & Description */}
      <div className="flex-1">
        <div className="flex items-center gap-2.5 sm:gap-3 mb-1.5 sm:mb-2">
          <h1 className="text-xl sm:text-2xl font-semibold text-textHeader m-0 flex items-center gap-2">
            {title}
            {badge && (
              <span className="text-[10px] md:text-xs font-medium bg-accentBg text-accent border border-accentBorder px-1 md:px-2 md:py-0.5 rounded-md uppercase tracking-wide">
                {badge}
              </span>
            )}
          </h1>
        </div>
        <p className="text-text text-xs sm:text-sm m-0">
          {description}
        </p>
      </div>

      {/* Search Container */}
      <div ref={dropdownRef} className="w-full mb-3 lg:mb-0 lg:w-72 relative z-[1050]">
        <div className="relative hidden lg:flex items-center">
          <Search 
            size={18} 
            className="absolute left-3.5 text-accent pointer-events-none" 
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setIsOpen(true)
            }}
            onFocus={() => setIsOpen(true)}
            placeholder="Search tools..."
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-backgroundCard border border-borderColor text-sm text-textHeader placeholder-text focus:outline-none focus:border-accent transition-all"
          />
        </div>

        {/* Search Results Dropdown */}
        {isOpen && searchQuery.trim() !== '' && (
          <div className="absolute right-0 top-full mt-2 w-full bg-backgroundCard border border-borderColor rounded-2xl shadow-xl overflow-hidden py-2">
            <div className="px-4 py-1.5 text-[11px] font-bold text-text uppercase tracking-wider border-b border-borderColor mb-1">
              Search Results
            </div>
            
            {/* Search Results Scroll Container */}
            {filteredTools.length > 0 ? (
              <div className="max-h-60 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {filteredTools.map((tool) => {
                  const ToolIcon = tool.icon
                  return (
                    <a
                      key={tool.id}
                      href={`/#${tool.id}`}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-backgroundColor transition-colors text-textHeader group"
                      onClick={() => setIsOpen(false)}
                    >
                      <span className="text-text group-hover:text-accent transition-colors shrink-0">
                        <ToolIcon size={16} />
                      </span>
                      <span className="text-sm font-medium">{tool.label}</span>
                    </a>
                  )
                })}
              </div>
            ) : (
              <div className="px-4 py-4 text-xs text-center text-text">
                No tools found
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}