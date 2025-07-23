// extension/src/popup/main.tsx
import { createRoot } from 'react-dom/client'
import { useState, useEffect } from 'react'

interface Platform {
  platform: string
  url: string
  title: string
  tabId: number
}

// All possible platforms the user can chain
const ALL_PLATFORMS = ['ChatGPT', 'Claude', 'Gemini', 'Grok', 'DeepSeek']

// Platform button definitions with icons and colors
const PLATFORM_BUTTONS = [
  { key: 'chatgpt', label: 'ChatGPT', color: 'bg-green-600 hover:bg-green-700', icon: '🤖' },
  { key: 'claude', label: 'Claude', color: 'bg-orange-600 hover:bg-orange-700', icon: '🧠' },
  { key: 'gemini', label: 'Gemini', color: 'bg-blue-600 hover:bg-blue-700', icon: '💎' },
  { key: 'grok', label: 'Grok', color: 'bg-purple-600 hover:bg-purple-700', icon: '🚀' },
  { key: 'deepseek', label: 'DeepSeek', color: 'bg-teal-600 hover:bg-teal-700', icon: '🔍' },
]

function PopupApp() {
  const [availablePlatforms, setAvailablePlatforms] = useState<Platform[]>([])
  const [prompt, setPrompt] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [loadingPlatform, setLoadingPlatform] = useState<string>('')

  // Quick send selection state
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])

  // Chain-specific state
  const [chain, setChain] = useState<string[]>([])
  const [finalResponse, setFinalResponse] = useState<string>('')
  const [isChaining, setIsChaining] = useState<boolean>(false)

  // Load open tabs and listen for chain completion
  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_AVAILABLE_PLATFORMS' }, (response) => {
      if (response?.platforms) setAvailablePlatforms(response.platforms)
    })

    const onMessage = (msg: any) => {
      if (msg.type === 'CHAIN_COMPLETE') {
        setFinalResponse(msg.finalResponse)
        setIsChaining(false)
        setIsLoading(false)
        setLoadingPlatform('')
      }
    }
    chrome.runtime.onMessage.addListener(onMessage)
    return () => chrome.runtime.onMessage.removeListener(onMessage)
  }, [])

  // Check if a platform is available
  const isPlatformAvailable = (platformName: string) => {
    return availablePlatforms.some(p => 
      p.platform.toLowerCase() === platformName.toLowerCase()
    )
  }

  // Toggle platform selection for quick send
  const handlePlatformToggle = (platform: string) => {
    setSelectedPlatforms(prev => 
      prev.includes(platform) 
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    )
  }

  // Send to selected platforms
  const handleSendToSelected = () => {
    if (!prompt.trim()) {
      alert('Please enter a prompt first')
      return
    }
    
    if (selectedPlatforms.length === 0) {
      alert('Please select at least one platform')
      return
    }

    setIsLoading(true)
    setLoadingPlatform('selected')

    // Send to each selected platform
    selectedPlatforms.forEach(platform => {
      if (platform === 'chatgpt') {
        chrome.runtime.sendMessage({ type: 'SEND_TO_CHATGPT', prompt })
      } else {
        chrome.runtime.sendMessage({
          type: 'SEND_TO_PLATFORM',
          platform: platform.toUpperCase(),
          prompt,
        })
      }
    })

    setTimeout(() => {
      setIsLoading(false)
      setLoadingPlatform('')
      window.close()
    }, 500)
  }

  // Send to specific platform

  // Send to all available platforms
  const handleSendToAll = () => {
    if (!prompt.trim()) {
      alert('Please enter a prompt first')
      return
    }
    
    if (availablePlatforms.length === 0) {
      alert('No AI platforms are currently open')
      return
    }

    setIsLoading(true)
    setLoadingPlatform('all')

    // Send to each available platform individually
    availablePlatforms.forEach(platform => {
      const platformKey = platform.platform.toLowerCase()
      
      if (platformKey === 'chatgpt') {
        chrome.runtime.sendMessage({ type: 'SEND_TO_CHATGPT', prompt })
      } else {
        chrome.runtime.sendMessage({
          type: 'SEND_TO_PLATFORM',
          platform: platform.platform.toUpperCase(),
          prompt,
        })
      }
    })

    setTimeout(() => {
      setIsLoading(false)
      setLoadingPlatform('')
      window.close()
    }, 500)
  }

  // Toggle a platform in the chain
  const handleChainToggle = (platformName: string) => {
    setChain((prev) =>
      prev.includes(platformName)
        ? prev.filter((p) => p !== platformName)
        : [...prev, platformName]
    )
  }

  // Send the chain sequence
  const handleChainSend = () => {
    if (!prompt.trim()) {
      alert('Please enter a prompt.')
      return
    }
    if (chain.length < 2) {
      alert('Select at least two platforms for chaining.')
      return
    }
    setIsLoading(true)
    setIsChaining(true)
    setFinalResponse('')
    chrome.runtime.sendMessage({ type: 'CHAIN_PROMPT', prompt, chain })
  }

  return (
    <div className="w-96 p-4 font-sans bg-white text-gray-900">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-lg font-bold">🔗 LLM Sync</h2>
        <div className="flex-1"></div>
        <div className="text-xs text-gray-500">
          {availablePlatforms.length} AI{availablePlatforms.length !== 1 ? 's' : ''} ready
        </div>
      </div>

      {/* Main Prompt Section */}
      <div className="border rounded-lg p-4 mb-4">
        <label className="block text-sm font-medium mb-2">💬 Your Prompt:</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          className="w-full p-3 border rounded-lg mb-4 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="What would you like to ask the AI? e.g., 'Explain quantum computing in simple terms'"
        />

        {/* Platform Selection Buttons */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-700">📤 Send to:</h3>
          
          {/* Multi-Select Platform Buttons */}
          <div>
            <div className="text-xs text-gray-500 mb-2">Select one or more platforms:</div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {PLATFORM_BUTTONS.map(({ key, label, color, icon }) => {
                const available = isPlatformAvailable(key)
                const isSelected = selectedPlatforms.includes(key)
                return (
                  <button
                    key={key}
                    onClick={() => handlePlatformToggle(key)}
                    disabled={!available || isLoading}
                    className={`py-2.5 text-sm font-medium transition-all duration-200 rounded-lg border-2 flex items-center justify-center gap-2 ${
                      isSelected
                        ? `${color} text-white border-transparent shadow-md`
                        : available
                        ? `bg-white ${color.replace('bg-', 'text-').replace('hover:bg-', 'hover:text-')} border-current hover:bg-gray-50`
                        : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                    }`}
                    title={!available ? `${label} tab not detected` : `Click to ${isSelected ? 'deselect' : 'select'} ${label}`}
                  >
                    <span>{icon}</span>
                    {label}
                    {isSelected && <span className="ml-1">✓</span>}
                    {!available && <span className="opacity-50">🚫</span>}
                  </button>
                )
              })}
            </div>

            {/* Send to Selected Button */}
            {selectedPlatforms.length > 0 && (
              <button
                onClick={handleSendToSelected}
                disabled={isLoading || !prompt.trim()}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 disabled:bg-gray-300 font-medium transition-all duration-200 flex items-center justify-center gap-2"
              >
                <span>🎯</span>
                {isLoading && loadingPlatform === 'selected' 
                  ? 'Sending...' 
                  : `Send to Selected (${selectedPlatforms.length})`}
              </button>
            )}
          </div>



          {/* Send to All Button */}
          <button
            onClick={handleSendToAll}
            disabled={availablePlatforms.length === 0 || isLoading || !prompt.trim()}
            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium transition-all duration-200 flex items-center justify-center gap-2"
          >
            <span>🌟</span>
            {isLoading && loadingPlatform === 'all' ? 'Sending to All...' : `Send to All Available (${availablePlatforms.length})`}
          </button>
        </div>

        {availablePlatforms.length === 0 && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm flex items-start gap-2">
            <span>⚠️</span>
            <div>
              <strong>No AI platforms detected.</strong><br />
              Please open tabs for ChatGPT, Claude, Gemini, Grok, or DeepSeek first.
            </div>
          </div>
        )}
      </div>

      {/* Chain Prompting Section */}
      <div className="border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="font-semibold">⛓️ Chain Prompting</h3>
          <div className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">Advanced</div>
        </div>
        <p className="text-xs text-gray-600 mb-4">
          Run your prompt through multiple AIs in sequence. Each AI builds upon the previous response.
        </p>

        <label className="block text-sm font-medium mb-2">Execution Order (select 2+ platforms):</label>
        <div className="flex flex-wrap gap-2 mb-4">
          {ALL_PLATFORMS.map((name) => {
            const isAvailable = availablePlatforms.some((p) => p.platform === name)
            const isSelected = chain.includes(name)
            const orderNumber = chain.indexOf(name) + 1
            return (
              <button
                key={name}
                onClick={() => handleChainToggle(name)}
                disabled={!isAvailable}
                className={`px-3 py-2 rounded-full border text-sm font-medium transition-all duration-200 ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                } ${!isAvailable ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                title={!isAvailable ? `${name} tab not detected` : `Click to ${isSelected ? 'remove from' : 'add to'} chain`}
              >
                {isSelected && <span className="bg-white text-indigo-600 px-1.5 py-0.5 rounded-full text-xs mr-1">{orderNumber}</span>}
                {name}
                {!isAvailable && <span className="ml-1 opacity-50">🚫</span>}
              </button>
            )
          })}
        </div>

        {chain.length > 0 && (
          <div className="mb-4 p-2 bg-indigo-50 border border-indigo-200 rounded text-sm">
            <strong>Chain order:</strong> {chain.join(' → ')}
          </div>
        )}

        <button
          onClick={handleChainSend}
          disabled={isLoading || chain.length < 2 || !prompt.trim()}
          className="w-full py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 font-medium transition-all duration-200"
        >
          {isChaining ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin">⚡</span>
              Processing chain... ({chain.join(' → ')})
            </span>
          ) : (
            `🚀 Start Chain (${chain.length} platforms)`
          )}
        </button>

        {finalResponse && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg text-sm">
            <div className="flex items-center gap-2 mb-2">
              <span>✅</span>
              <strong>Final Result from {chain[chain.length - 1]}:</strong>
            </div>
            <div className="whitespace-pre-wrap text-gray-800 max-h-32 overflow-y-auto">
              {finalResponse}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const container = document.getElementById('root')
if (container) createRoot(container).render(<PopupApp />)