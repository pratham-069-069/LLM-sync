// extension/src/background.ts

// Immediately log when the service worker loads
console.log('🛠️ LLM Sync background script loaded')

// Install hook
chrome.runtime.onInstalled.addListener(() => {
  console.log('✅ LLM Sync background installed')
})

// Platform URL patterns
const PLATFORM_PATTERNS = {
  CHATGPT: ['*://chatgpt.com/*', '*://www.chatgpt.com/*'],
  CLAUDE: ['https://claude.ai/*'],
  GEMINI: ['https://gemini.google.com/*', 'https://bard.google.com/*'],
  GROK: ['https://grok.com/*', 'https://x.com/*'],
  DEEPSEEK: ['https://deepseek.com/*', 'https://chat.deepseek.com/*']
}

// Find tabs for a specific platform
const findPlatformTabs = async (platform: keyof typeof PLATFORM_PATTERNS): Promise<chrome.tabs.Tab[]> => {
  return new Promise((resolve) => {
    chrome.tabs.query({ url: PLATFORM_PATTERNS[platform] }, resolve)
  })
}

// Find any AI platform tabs
const findAnyAIPlatformTabs = async (): Promise<chrome.tabs.Tab[]> => {
  const allPatterns = Object.values(PLATFORM_PATTERNS).flat()
  return new Promise((resolve) => {
    chrome.tabs.query({ url: allPatterns }, resolve)
  })
}

// Get platform name from URL
const getPlatformName = (url: string): string => {
  if (url.includes('chatgpt.com')) return 'ChatGPT'
  if (url.includes('claude.ai')) return 'Claude'
  if (url.includes('gemini.google.com') || url.includes('bard.google.com')) return 'Gemini'
  if (url.includes('grok.com') || url.includes('x.com')) return 'Grok'
  if (url.includes('deepseek.com')) return 'DeepSeek'
  return 'Unknown'
}

// Handle messages from the popup
chrome.runtime.onMessage.addListener(async (msg, _sender, sendResponse) => {
  console.log('🔔 BG got:', msg)

  if (msg.type === 'SEND_TO_CHATGPT') {
    // Legacy support - send to ChatGPT specifically
    const tabs = await findPlatformTabs('CHATGPT')
    if (tabs.length === 0) {
      console.warn('⚠️ No ChatGPT tab found!')
      return
    }
    
    chrome.tabs.sendMessage(tabs[0].id!, {
      type: 'INJECT_PROMPT',
      prompt: msg.prompt
    })
    return
  }

  if (msg.type === 'SEND_TO_PLATFORM') {
    // Send to specific platform
    const platform = msg.platform as keyof typeof PLATFORM_PATTERNS
    const tabs = await findPlatformTabs(platform)
    
    if (tabs.length === 0) {
      console.warn(`⚠️ No ${platform} tab found!`)
      return
    }
    
    chrome.tabs.sendMessage(tabs[0].id!, {
      type: 'INJECT_PROMPT',
      prompt: msg.prompt
    })
    return
  }

  if (msg.type === 'SEND_TO_ANY_AI') {
    // Send to any available AI platform
    const tabs = await findAnyAIPlatformTabs()
    
    if (tabs.length === 0) {
      console.warn('⚠️ No AI platform tabs found!')
      return
    }
    
    // Send to the first available tab
    const tab = tabs[0]
    const platformName = getPlatformName(tab.url || '')
    console.log(`🚀 Sending to ${platformName} tab`)
    
    chrome.tabs.sendMessage(tab.id!, {
      type: 'INJECT_PROMPT',
      prompt: msg.prompt
    })
    return
  }

  if (msg.type === 'GET_AVAILABLE_PLATFORMS') {
    // Return list of available platforms
    const tabs = await findAnyAIPlatformTabs()
    const platforms = tabs.map(tab => ({
      platform: getPlatformName(tab.url || ''),
      url: tab.url,
      title: tab.title,
      tabId: tab.id
    }))
    
    sendResponse({ platforms })
    return true // Keep the message channel open for async response
  }

  // Legacy behavior - default to ChatGPT
  if (msg.prompt) {
    const tabs = await findPlatformTabs('CHATGPT')
    if (tabs.length === 0) {
      console.warn('⚠️ No ChatGPT tab found!')
      return
    }
    
    chrome.tabs.sendMessage(tabs[0].id!, {
      type: 'INJECT_PROMPT',
      prompt: msg.prompt
    })
  }

  return false
})