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

function PopupApp() {
  const [availablePlatforms, setAvailablePlatforms] = useState<Platform[]>([])
  const [prompt, setPrompt] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  
  // ✨ NEW: State for the chaining feature
  const [chain, setChain] = useState<string[]>([])
  const [finalResponse, setFinalResponse] = useState<string>('')
  const [isChaining, setIsChaining] = useState<boolean>(false)


  // Load available platforms and listen for chain completion
  useEffect(() => {
    // Get currently open platforms
    chrome.runtime.sendMessage({ type: 'GET_AVAILABLE_PLATFORMS' }, (response) => {
      if (response && response.platforms) {
        setAvailablePlatforms(response.platforms)
      }
    })

    // ✨ NEW: Listen for the final response from the background script
    const messageListener = (msg: any) => {
      if (msg.type === 'CHAIN_COMPLETE') {
        setFinalResponse(msg.finalResponse)
        setIsChaining(false)
        setIsLoading(false)
      }
    };
    chrome.runtime.onMessage.addListener(messageListener);

    // Cleanup listener on component unmount
    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, [])
  
  // ✨ NEW: Handler for updating the chain selection
  const handleChainToggle = (platformName: string) => {
    setChain(prevChain => {
      if (prevChain.includes(platformName)) {
        // Remove from chain
        return prevChain.filter(p => p !== platformName)
      } else {
        // Add to chain
        return [...prevChain, platformName]
      }
    })
  }
  
  // ✨ NEW: Handler for starting the chain prompt
  const handleChainSend = () => {
    if (!prompt.trim()) {
      alert('Please enter a prompt.')
      return
    }
    if (chain.length < 2) {
      alert('Please select at least two platforms for the chain.')
      return
    }

    setIsLoading(true)
    setIsChaining(true)
    setFinalResponse('') // Clear previous response

    chrome.runtime.sendMessage({
      type: 'CHAIN_PROMPT',
      prompt: prompt,
      chain: chain
    })
  }

  return (
    <div className="w-96 p-4 font-sans bg-white text-gray-900">
      <div className="mb-4">
        <h2 className="text-lg font-bold">LLM Sync</h2>
        <p className="text-sm text-gray-600">
          Orchestrate prompts across multiple AI platforms.
        </p>
      </div>

      {/* Chain Prompting UI */}
      <div className="border rounded-lg p-3 mb-4">
        <h3 className="text-md font-bold mb-2">🤖 Chain Prompting</h3>
        <p className="text-xs text-gray-500 mb-3">
          Send a prompt through a sequence of AIs. The output of one becomes the input for the next.
        </p>

        <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
                Prompt:
            </label>
            <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., Explain quantum computing like I'm five."
                className="w-full p-2 border border-gray-300 rounded text-sm resize-none"
                rows={3}
            />
        </div>

        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-700 mb-2">Execution Order (Select at least 2):</label>
          <div className="flex flex-wrap gap-2">
            {ALL_PLATFORMS.map(platformName => {
              const isAvailable = availablePlatforms.some(p => p.platform === platformName);
              const isSelected = chain.includes(platformName);
              return (
                <button
                  key={platformName}
                  onClick={() => handleChainToggle(platformName)}
                  disabled={!isAvailable}
                  className={`px-3 py-1 text-sm rounded-full border ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300'
                  } ${
                    !isAvailable
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:bg-gray-100'
                  }`}
                >
                  {isSelected ? `${chain.indexOf(platformName) + 1}. ` : ''}{platformName} {!isAvailable && '(Off)'}
                </button>
              )
            })}
          </div>
        </div>
        
        <button
          onClick={handleChainSend}
          disabled={isLoading || chain.length < 2 || !prompt.trim()}
          className="w-full px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium"
        >
          {isChaining ? `Working... (${chain.join(' → ')})` : 'Start Chain'}
        </button>

        {/* ✨ NEW: Display area for the final response */}
        {finalResponse && (
          <div className="mt-4 p-3 bg-gray-50 border rounded-lg">
            <h4 className="text-sm font-bold mb-2">Final Output from {chain[chain.length - 1]}:</h4>
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{finalResponse}</p>
          </div>
        )}
      </div>
    </div>
  )
}

const container = document.getElementById('root')
if (container) createRoot(container).render(<PopupApp />)