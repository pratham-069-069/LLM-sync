// extension/src/popup/main.tsx
import { createRoot } from 'react-dom/client'
import { useState, useEffect } from 'react'

interface Platform {
  platform: string
  url: string
  title: string
  tabId: number
}

function PopupApp() {
  const [availablePlatforms, setAvailablePlatforms] = useState<Platform[]>([])
  const [selectedPlatform, setSelectedPlatform] = useState<string>('any')
  const [prompt, setPrompt] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Load available platforms on component mount
  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_AVAILABLE_PLATFORMS' }, (response) => {
      if (response && response.platforms) {
        setAvailablePlatforms(response.platforms)
      }
    })
  }, [])

  // Handler for sending prompt to selected platform
  const handleSendPrompt = async () => {
    if (!prompt.trim()) {
      alert('Please enter a prompt')
      return
    }

    setIsLoading(true)
    
    try {
      if (selectedPlatform === 'any') {
        // Send to any available platform
        chrome.runtime.sendMessage({ 
          type: 'SEND_TO_ANY_AI', 
          prompt: prompt 
        })
      } else if (selectedPlatform === 'chatgpt') {
        // Legacy ChatGPT support
        chrome.runtime.sendMessage({ 
          type: 'SEND_TO_CHATGPT', 
          prompt: prompt 
        })
      } else {
        // Send to specific platform
        chrome.runtime.sendMessage({ 
          type: 'SEND_TO_PLATFORM', 
          platform: selectedPlatform.toUpperCase(),
          prompt: prompt 
        })
      }
      
      console.log(`🔹 Popup: sent prompt to ${selectedPlatform}`)
      
      // Clear the prompt after sending
      setPrompt('')
      
      // Close popup after a short delay
      setTimeout(() => window.close(), 500)
      
    } catch (error) {
      console.error('Error sending prompt:', error)
      alert('Failed to send prompt. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // Quick send buttons for common platforms
  const quickSendButtons = [
    { key: 'chatgpt', label: 'ChatGPT', color: 'bg-green-600 hover:bg-green-700' },
    { key: 'claude', label: 'Claude', color: 'bg-orange-600 hover:bg-orange-700' },
    { key: 'gemini', label: 'Gemini', color: 'bg-blue-600 hover:bg-blue-700' },
    { key: 'grok', label: 'Grok', color: 'bg-purple-600 hover:bg-purple-700' },
  ]

  const handleQuickSend = (platform: string) => {
    const userPrompt = window.prompt('Enter a prompt for ' + platform.toUpperCase())
    if (!userPrompt) return

    setIsLoading(true)
    
    if (platform === 'chatgpt') {
      chrome.runtime.sendMessage({ type: 'SEND_TO_CHATGPT', prompt: userPrompt })
    } else {
      chrome.runtime.sendMessage({ 
        type: 'SEND_TO_PLATFORM', 
        platform: platform.toUpperCase(),
        prompt: userPrompt 
      })
    }
    
    console.log(`🔹 Popup: quick sent to ${platform}`)
    setTimeout(() => window.close(), 500)
  }

  return (
    <div className="w-80 p-4 font-sans bg-white">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-gray-900 mb-2">LLM Sync</h2>
        <p className="text-sm text-gray-600">
          Send prompts to AI platforms
        </p>
      </div>

      {/* Available Platforms Display */}
      {availablePlatforms.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Available Platforms:</h3>
          <div className="flex flex-wrap gap-1">
            {availablePlatforms.map((platform, index) => (
              <span 
                key={index}
                className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
              >
                {platform.platform}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Advanced Mode */}
      <div className="mb-4">
        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Target Platform:
          </label>
          <select 
            value={selectedPlatform}
            onChange={(e) => setSelectedPlatform(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded text-sm"
          >
            <option value="any">Any Available Platform</option>
            <option value="chatgpt">ChatGPT</option>
            <option value="claude">Claude</option>
            <option value="gemini">Gemini</option>
            <option value="grok">Grok</option>
            <option value="deepseek">DeepSeek</option>
          </select>
        </div>

        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Prompt:
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter your prompt here..."
            className="w-full p-2 border border-gray-300 rounded text-sm resize-none"
            rows={3}
          />
        </div>

        <button
          onClick={handleSendPrompt}
          disabled={isLoading || !prompt.trim()}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium"
        >
          {isLoading ? 'Sending...' : `Send to ${selectedPlatform === 'any' ? 'Available Platform' : selectedPlatform.toUpperCase()}`}
        </button>
      </div>

      {/* Quick Send Buttons */}
      <div className="border-t pt-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Quick Send:</h3>
        <div className="grid grid-cols-2 gap-2">
          {quickSendButtons.map(({ key, label, color }) => (
            <button
              key={key}
              onClick={() => handleQuickSend(key)}
              disabled={isLoading}
              className={`px-3 py-2 text-white rounded text-sm font-medium ${color} disabled:bg-gray-400 disabled:cursor-not-allowed`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Status */}
      {availablePlatforms.length === 0 && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-sm text-yellow-800">
            No AI platform tabs detected. Please open ChatGPT, Claude, Gemini, Grok, or DeepSeek in a tab first.
          </p>
        </div>
      )}
    </div>
  )
}

const container = document.getElementById('root')
if (container) createRoot(container).render(<PopupApp />)