// Define the Platform interface
interface Platform {
  platform: string;
  url: string;
  title: string;
  tabId: number;
}

// Function to find all available AI platform tabs
async function getAvailablePlatforms(): Promise<Platform[]> {
  const tabs = await chrome.tabs.query({});
  const platforms: Platform[] = [];

  const platformPatterns = [
    { name: 'ChatGPT', pattern: /chatgpt\.com/ },
    { name: 'Claude', pattern: /claude\.ai/ },
    { name: 'Gemini', pattern: /gemini\.google\.com/ },
    { name: 'Grok', pattern: /grok\.com|x\.com/ },
    { name: 'DeepSeek', pattern: /chat\.deepseek\.com/ },
  ];

  for (const tab of tabs) {
    if (tab.url && tab.id) {
      for (const p of platformPatterns) {
        if (p.pattern.test(tab.url)) {
          platforms.push({ platform: p.name, url: tab.url, title: tab.title || 'Untitled', tabId: tab.id });
          break; // Move to the next tab once a platform is identified
        }
      }
    }
  }
  return platforms;
}

// Main message listener for the background script
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  // Handler to get a list of currently open LLM tabs
  if (msg.type === 'GET_AVAILABLE_PLATFORMS') {
    getAvailablePlatforms().then(platforms => {
      sendResponse({ platforms });
    });
    return true; // Keep the message channel open for the async response
  }

  // Handler to send a prompt to a specific platform
  if (msg.type === 'SEND_TO_PLATFORM' || msg.type === 'SEND_TO_CHATGPT') {
    const platformName = msg.platform || 'CHATGPT';
    console.log(`Background: Received SEND_TO_PLATFORM for ${platformName}`);
    getAvailablePlatforms().then(platforms => {
      const targetPlatform = platforms.find(p => p.platform.toUpperCase() === platformName.toUpperCase());
      if (targetPlatform) {
        chrome.tabs.sendMessage(targetPlatform.tabId, {
          type: 'INJECT_PROMPT',
          prompt: msg.prompt,
        });
      } else {
        console.error(`Platform ${platformName} not found.`);
      }
    });
  }
  
  // Handler to send a prompt to any available tab
  if (msg.type === 'SEND_TO_ANY_AI') {
      getAvailablePlatforms().then(platforms => {
          if (platforms.length > 0) {
              // Send to the first available platform
              const targetTabId = platforms[0].tabId;
              chrome.tabs.sendMessage(targetTabId, { type: 'INJECT_PROMPT', prompt: msg.prompt });
          } else {
              console.error('No AI platforms available to send prompt to.');
          }
      });
  }

  // ✨ NEW: Handler for executing Sidekick tasks with Worker AIs
  if (msg.type === 'EXECUTE_SIDEKICK_TASK') {
    console.log(`🚀 Background: Received EXECUTE_SIDEKICK_TASK for ${msg.platform}`);
    
    const executeSidekickTask = async () => {
      const startTime = Date.now();
      
      try {
        const available = await getAvailablePlatforms();
        const targetPlatform = available.find(p => p.platform.toUpperCase() === msg.platform.toUpperCase());

        if (!targetPlatform) {
          console.error(`❌ Background: Worker AI platform ${msg.platform} not found in available tabs`);
          sendResponse({
            success: false,
            error: `Worker AI platform "${msg.platform}" not available. Please open ${msg.platform} in a tab.`
          });
          return;
        }

        console.log(`🔧 Background: Found ${msg.platform} tab (ID: ${targetPlatform.tabId}), executing task...`);

        // Step 1: Inject the intelligent meta-prompt into the Worker AI
        await chrome.tabs.sendMessage(targetPlatform.tabId, {
          type: 'INJECT_PROMPT',
          prompt: msg.prompt
        });

        console.log(`🔧 Background: Prompt injected into ${msg.platform}, waiting for response...`);

        // Step 2: Wait for the Worker AI to generate a response
        // TODO: Make this more robust with DOM observation instead of fixed delay
        const waitTime = 15000; // 15 seconds - could be configurable
        await new Promise(resolve => setTimeout(resolve, waitTime));

        // Step 3: Read the Worker AI's analysis response
        const response = await chrome.tabs.sendMessage(targetPlatform.tabId, {
          type: 'READ_LATEST_RESPONSE'
        });

        const executionTime = Date.now() - startTime;

        if (response && response.success && response.response) {
          console.log(`✅ Background: Worker AI analysis completed in ${executionTime}ms`);
          
          sendResponse({
            success: true,
            analysis: response.response,
            executionTime: executionTime,
            workerAI: msg.platform,
            metadata: {
              ...msg.metadata,
              executionTime,
              workerTabId: targetPlatform.tabId
            }
          });
        } else {
          console.error(`❌ Background: Failed to read response from ${msg.platform}:`, response?.error);
          sendResponse({
            success: false,
            error: `Failed to read response from ${msg.platform}: ${response?.error || 'Unknown error'}`,
            executionTime: executionTime
          });
        }

      } catch (error) {
        const executionTime = Date.now() - startTime;
        console.error(`❌ Background: Error during ${msg.platform} task execution:`, error);
        
        sendResponse({
          success: false,
          error: `Error executing task with ${msg.platform}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          executionTime: executionTime
        });
      }
    };

    executeSidekickTask();
    return true; // Keep message channel open for async response
  }

  // ✨ NEW: Handler for chaining prompts between platforms
  if (msg.type === 'CHAIN_PROMPT') {
    console.log('Background: Received CHAIN_PROMPT with chain:', msg.chain);
    const chainAndExecute = async () => {
        const available = await getAvailablePlatforms();
        let currentPrompt = msg.prompt;

        for (const platformName of msg.chain) {
            const targetPlatform = available.find(p => p.platform.toUpperCase() === platformName.toUpperCase());

            if (targetPlatform) {
                try {
                    console.log(`🔗 Chain step: Sending to ${platformName}...`);
                    // 1. Inject the current prompt into the target platform
                    await chrome.tabs.sendMessage(targetPlatform.tabId, { type: 'INJECT_PROMPT', prompt: currentPrompt });

                    // 2. IMPORTANT: Wait for the LLM to generate a response.
                    // This is a simple but unreliable delay. A more robust solution would involve
                    // the content script monitoring the DOM for when the response is fully loaded.
                    await new Promise(resolve => setTimeout(resolve, 15000)); // 15-second wait

                    console.log(`🔗 Chain step: Reading response from ${platformName}...`);
                    // 3. Read the new response from the target platform
                    const response = await chrome.tabs.sendMessage(targetPlatform.tabId, { type: 'READ_LATEST_RESPONSE' });

                    if (response.success && response.response) {
                        currentPrompt = response.response; // This response becomes the prompt for the next step
                        console.log(`🔗 Chain step: Got response from ${platformName}. New prompt is: "${currentPrompt.substring(0, 100)}..."`);
                    } else {
                        console.error(`Failed to read response from ${platformName}. Stopping chain. Error:`, response.error);
                        // Optional: notify the UI about the failure
                        return; // Stop the chain
                    }
                } catch (e) {
                    console.error(`An error occurred during the chain with ${platformName}. Stopping chain. Error:`, e);
                    // Optional: notify the UI about the failure
                    return; // Stop the chain
                }
            } else {
                console.warn(`Platform ${platformName} in chain is not available. Skipping.`);
            }
        }
        console.log('✅ Chain finished. Final output:', currentPrompt);
        // Here you can send the final output back to the popup/dashboard UI
        // For example: chrome.runtime.sendMessage({ type: 'CHAIN_COMPLETE', finalResponse: currentPrompt });
    };

    chainAndExecute();
    return true; // Indicates async execution
  }
});

console.log('LLM Sync background script loaded.');