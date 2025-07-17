// extension/src/popup/main.tsx
import { createRoot } from 'react-dom/client'

function PopupApp() {
  // Handler for our “Send to ChatGPT” button
  const handleSendToGPT = () => {
    console.log('🔹 Popup: button clicked')
    // Rename from `prompt` to `userPrompt` to avoid shadowing the global
    const userPrompt = window.prompt('Enter a prompt for ChatGPT')
    if (!userPrompt) return

    // Send the prompt to our background script
    + chrome.runtime.sendMessage({ type: 'SEND_TO_CHATGPT', prompt: userPrompt })
    // console.log('🔹 Popup: sent prompt to background');
  }

  return (
    <div className="p-4 font-sans">
      <h2 className="mb-2 font-bold">LLM Sync</h2>
      <button
        onClick={handleSendToGPT}
        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
      >
        Send to ChatGPT
      </button>
    </div>
  )
}

const container = document.getElementById('root')
if (container) createRoot(container).render(<PopupApp />)
