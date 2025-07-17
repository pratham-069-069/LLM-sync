// extension/src/background.ts

// Immediately log when the service worker loads
console.log('🛠️ LLM Sync background script loaded')

// Install hook
chrome.runtime.onInstalled.addListener(() => {
  console.log('✅ LLM Sync background installed')
})

// Handle messages from the popup
chrome.runtime.onMessage.addListener((msg) => {
  console.log('🔔 BG got:', msg)

  if (msg.type === 'SEND_TO_CHATGPT') {
    // Look for any chatgpt.com tabs
    chrome.tabs.query({ url: ['*://chatgpt.com/*', '*://www.chatgpt.com/*'] }, (tabs) => {
      if (tabs.length === 0) {
        console.warn('⚠️ No ChatGPT tab found!')
        return
      }
      // Fire‐and‐forget injection; no callback
      chrome.tabs.sendMessage(tabs[0].id!, {
        type: 'INJECT_PROMPT',
        prompt: msg.prompt
      })
    })
  }

  // We don’t send any response back to the popup
  return false
})
