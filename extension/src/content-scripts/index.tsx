import React from 'react';
import UIRoot from '../components/UIRoot';
import EnhanceButton from '../components/EnhanceButton';
import { createRoot } from 'react-dom/client';
import { restoreHighlights } from './dom_utils';
import {
    getPlatformName,
    getInputSelectors,
    getSendButtonSelectors,
    getChatContainerSelector,
    getPromptContainerSelector,
    getResponseSelectors,
    waitForElement,
    setTextContent,
    clickSendButton,
    tryEnterKey,
    readLatestResponse,
    removeHighlightFromPage
} from './dom_utils';

console.log('🧩 Multi-platform content script loaded on', location.href);

// --- UI Injection & Styling ---

/**
 * Injects a style tag into the document head to define highlight colors and hover toolbar styles.
 */
const addHighlightStyles = () => {
  const style = document.createElement('style');
  style.textContent = `
    /* Highlight colors */
    .nexusmind-highlight-yellow { background-color: rgba(255, 215, 0, 0.4); }
    .nexusmind-highlight-green { background-color: rgba(52, 211, 153, 0.4); }
    .nexusmind-highlight-blue { background-color: rgba(96, 165, 250, 0.4); }
    .nexusmind-highlight-red { background-color: rgba(248, 113, 113, 0.4); }
    .nexusmind-highlight-purple { background-color: rgba(167, 139, 250, 0.4); }
    
    /* Hover toolbar enhancements for cross-platform compatibility */
    .nexusmind-hover-toolbar {
      /* Ensure toolbar stays above all platform-specific content */
      z-index: 999999 !important;
      /* Prevent text selection interference */
      user-select: none;
      -webkit-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
    }
    
    /* Platform-specific toolbar positioning adjustments */
    /* ChatGPT */
    [data-testid*="conversation-turn"] .nexusmind-hover-toolbar,
    [data-message-author-role="assistant"] .nexusmind-hover-toolbar {
      top: 12px;
      right: 12px;
    }
    
    /* Claude */
    .font-claude-message .nexusmind-hover-toolbar,
    [data-is-streaming="false"] .nexusmind-hover-toolbar {
      top: 8px;
      right: 8px;
    }
    
    /* Gemini - specific adjustments for complex layout */
    [data-test-id*="conversation"] .nexusmind-hover-toolbar,
    .model-response-text .nexusmind-hover-toolbar {
      top: 16px;
      right: 16px;
      /* Extra backdrop blur for Gemini's busy interface */
      backdrop-filter: blur(12px) saturate(180%);
    }
    
    /* Grok */
    .prose .nexusmind-hover-toolbar,
    [dir="auto"] .nexusmind-hover-toolbar {
      top: 10px;
      right: 10px;
    }
    
    /* Ensure smooth animations */
    @keyframes nexusmind-fade-in {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    .nexusmind-hover-toolbar {
      animation: nexusmind-fade-in 0.2s ease;
    }
    
    /* Loading spinner animation */
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
};


/**
 * Creates the root container for the React UI and renders the UIRoot component.
 */
const initializeUI = () => {
  // Add styles for highlights
  addHighlightStyles();

  // Create a container for our React app
  const rootEl = document.createElement('div');
  rootEl.id = 'nexusmind-root';
  document.body.appendChild(rootEl);

  // Render the UIRoot component into the container
  const root = createRoot(rootEl);
  root.render(
    <React.StrictMode>
      <UIRoot />
    </React.StrictMode>
  );
  console.log('✅ NexusMind UI Root injected.');
};

/**
 * Injects the Enhance button into the prompt container
 */
const injectEnhanceButton = async () => {
  const platform = getPlatformName();
  console.log(`✨ Injecting Enhance button for ${platform}...`);
  
  try {
    // Find the prompt container using the new selector
    const containerSelector = getPromptContainerSelector(platform);
    const promptContainer = await waitForElement(containerSelector, 5000);
    
    if (!promptContainer) {
      console.warn(`⚠️ Could not find prompt container for ${platform} with selector: ${containerSelector}`);
      return;
    }
    
    console.log(`✅ Found prompt container for ${platform}`);
    
    // Create a container for the Enhance button
    const buttonContainer = document.createElement('div');
    buttonContainer.id = 'nexusmind-enhance-button-container';
    buttonContainer.style.cssText = `
      position: absolute;
      top: 8px;
      right: 8px;
      z-index: 1000;
    `;
    
    // Insert the button container into the prompt container
    promptContainer.style.position = 'relative'; // Ensure relative positioning for absolute child
    promptContainer.appendChild(buttonContainer);
    
    // Create React root and render the EnhanceButton
    const root = createRoot(buttonContainer);
    
    // Standalone function to trigger enhancement
    const triggerEnhancement = async () => {
      try {
        console.log('✨ Triggering enhancement process...');
        
        // Find the prompt input element
        let inputField: HTMLElement | null = null;
        const inputSelectors = getInputSelectors(platform);
        
        for (const selector of inputSelectors) {
          try {
            inputField = await waitForElement(selector, 1000);
            if (inputField) {
              console.log(`✅ Found input field with selector: ${selector}`);
              break;
            }
          } catch (err) {
            console.log(`⚠️ Input selector failed: ${selector}`);
          }
        }
        
        if (!inputField) {
          console.error('❌ Could not find input field for enhancement');
          return;
        }
        
        // Read current prompt text
        const currentPrompt = inputField.innerText || inputField.textContent || (inputField as HTMLTextAreaElement).value || '';
        
        if (!currentPrompt.trim()) {
          console.log('⚠️ No prompt text found, skipping enhancement');
          return;
        }
        
        console.log(`📝 Current prompt: "${currentPrompt.substring(0, 100)}..."`);
        
        // Set loading state
        root.render(<EnhanceButton onClick={triggerEnhancement} isLoading={true} />);
        
        // Send enhancement request to background script
        chrome.runtime.sendMessage({
          type: 'ENHANCE_USER_PROMPT',
          originalPrompt: currentPrompt
        }, (response) => {
          try {
            if (chrome.runtime.lastError) {
              console.error('❌ Error sending enhancement request:', chrome.runtime.lastError);
              root.render(<EnhanceButton onClick={triggerEnhancement} isLoading={false} />);
              return;
            }
            
            if (response.success && response.enhancedPrompt) {
              console.log(`✨ Enhancement successful! Enhanced prompt: "${response.enhancedPrompt.substring(0, 100)}..."`);
              
              // Replace the text in the input field
              setTextContent(inputField, response.enhancedPrompt, platform);
              
              console.log('✅ Enhanced prompt applied to input field');
            } else {
              console.error('❌ Enhancement failed:', response.error);
            }
          } catch (error) {
            console.error('❌ Error processing enhancement response:', error);
          } finally {
            // Reset loading state
            root.render(<EnhanceButton onClick={triggerEnhancement} isLoading={false} />);
          }
        });
        
      } catch (error) {
        console.error('❌ Error during enhancement process:', error);
        root.render(<EnhanceButton onClick={triggerEnhancement} isLoading={false} />);
      }
    };
    
    // Add keyboard shortcut listener to the input field
    const addKeyboardShortcut = async () => {
      try {
        // Find the prompt input element for keyboard listener
        let inputField: HTMLElement | null = null;
        const inputSelectors = getInputSelectors(platform);
        
        for (const selector of inputSelectors) {
          try {
            inputField = await waitForElement(selector, 1000);
            if (inputField) {
              console.log(`✅ Found input field for keyboard shortcut with selector: ${selector}`);
              break;
            }
          } catch (err) {
            console.log(`⚠️ Input selector failed for keyboard shortcut: ${selector}`);
          }
        }
        
        if (inputField) {
          // Add keyboard event listener
          inputField.addEventListener('keydown', (event) => {
            // Check for Ctrl + Shift + E shortcut
            if (event.ctrlKey && event.shiftKey && event.key === 'E') {
              event.preventDefault(); // Stop any default browser behavior
              console.log('⌨️ Keyboard shortcut Ctrl+Shift+E detected, triggering enhancement...');
              triggerEnhancement();
            }
          });
          
          console.log('⌨️ Keyboard shortcut (Ctrl+Shift+E) listener added to input field');
        } else {
          console.warn('⚠️ Could not find input field for keyboard shortcut listener');
        }
      } catch (error) {
        console.error('❌ Error adding keyboard shortcut listener:', error);
      }
    };
    
    // Add the keyboard shortcut listener
    addKeyboardShortcut();
    
    // Render the initial button
    root.render(<EnhanceButton onClick={triggerEnhancement} isLoading={false} />);
    
    console.log(`✅ Enhance button injected successfully for ${platform}`);
    
  } catch (error) {
    console.error(`❌ Error injecting Enhance button for ${platform}:`, error);
  }
};

// --- Initialization ---
initializeUI();
injectEnhanceButton();

// --- PART 3: HIGHLIGHT RESTORATION ON PAGE LOAD ---
// Restore highlights when page loads
const initializeHighlights = async () => {
  try {
    console.log('🎨 Initializing highlight restoration...');
    
    // Wait a bit for the page to stabilize
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const restoredCount = await restoreHighlights();
    console.log(`🎨 Restored ${restoredCount} highlights on page load`);
  } catch (error) {
    console.error('🎨 Error restoring highlights:', error);
  }
};

// Initialize highlights after a short delay to let the page load
setTimeout(initializeHighlights, 2000);

// Add selection change listener for enhanced toolbar functionality
document.addEventListener('selectionchange', () => {
    const selection = window.getSelection();
    
    // Only proceed if we have a valid selection
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        return;
    }
    
    const range = selection.getRangeAt(0);
    const selectedElement = range.commonAncestorContainer;
    
    // Import and use the response validation functions
    const platform = getPlatformName();
    const responseSelectors = getResponseSelectors(platform);
    
    // First, check if we're in a text input area - if so, don't show toolbar
    let currentNode: Node | null = selectedElement instanceof Element ? selectedElement : selectedElement.parentElement;
    let isInTextInput = false;
    
    // Check if we're within any input elements
    while (currentNode && currentNode !== document.body) {
        if (currentNode instanceof HTMLElement) {
            const tagName = currentNode.tagName.toLowerCase();
            const isEditable = currentNode.isContentEditable;
            const hasTextInputRole = currentNode.getAttribute('role') === 'textbox';
            
            if (tagName === 'input' || tagName === 'textarea' || isEditable || hasTextInputRole) {
                isInTextInput = true;
                break;
            }
        }
        currentNode = currentNode.parentNode;
    }
    
    // Don't show toolbar if we're in a text input area
    if (isInTextInput) {
        console.log('⚠️ Selection is within text input area, skipping toolbar');
        return;
    }
    
    // Now check if the selected element is within a valid AI response container
    let isWithinResponse = false;
    currentNode = selectedElement instanceof Element ? selectedElement : selectedElement.parentElement;
    
    while (currentNode && currentNode !== document.body) {
        if (currentNode instanceof HTMLElement) {
            // Check if the element matches any of the response selectors
            for (const selector of responseSelectors) {
                try {
                    if (currentNode.matches(selector) || currentNode.closest(selector)) {
                        isWithinResponse = true;
                        break;
                    }
                } catch (e) {
                    console.log(`Invalid response selector: ${selector}`, e);
                }
            }
            if (isWithinResponse) break;
        }
        currentNode = currentNode.parentNode;
    }
    
    // Only send SHOW_TOOLBAR message if selection is within a valid response area
    if (isWithinResponse) {
        console.log('✅ Selection detected within AI response area, sending SHOW_TOOLBAR message');
        
        // Send message to show toolbar (this would be consumed by UIRoot or another component)
        window.postMessage({
            type: 'SHOW_TOOLBAR',
            selection: {
                text: selection.toString(),
                rect: range.getBoundingClientRect(),
                platform: platform
            }
        }, '*');
    } else {
        console.log('⚠️ Selection detected but not within AI response area, skipping toolbar');
    }
});

// Add window message listener for messages from React components
window.addEventListener('message', (event) => {
    // Make sure the message is from our extension
    if (event.source !== window || !event.data || typeof event.data !== 'object') return;
    
    const { type, text, config } = event.data;
    
    if (type === 'PERFORM_ANALYSIS') {
        console.log('🤖 Content Script: Received PERFORM_ANALYSIS from React component, forwarding to background script');
        
        // Send message to background script with a proper callback
        chrome.runtime.sendMessage(
            { 
                type: 'EXECUTE_SIDEKICK_TASK', // Use the correct message type that background expects
                platform: config?.workerAI?.toLowerCase() || 'claude',
                prompt: `${config?.customPrompt || 'Analyze this:'} ${text}`
            },
            (response) => {
                // Handle the response from background script
                if (chrome.runtime.lastError) {
                    console.error('❌ Error from background script:', chrome.runtime.lastError);
                } else {
                    console.log('✅ Analysis request processed by background script:', response);
                    
                    // Send a confirmation back to the React component if needed
                    window.postMessage({ 
                        type: 'ANALYSIS_RESPONSE',
                        success: true,
                        data: response
                    }, '*');
                }
            }
        );
    }
});

// Main message listener
if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
        const platform = getPlatformName();

        // Handle PING to verify content script is ready
        if (msg.type === 'PING') {
            console.log('🤖 Content Script: Received ping, responding as ready');
            sendResponse({ status: 'ready' });
            return true;
        }

        if (msg.type === 'INJECT_PROMPT') {
            const injectAndSend = async () => {
                try {
                    console.log(`🚀 Starting INJECT_PROMPT for ${platform} with enhanced response detection...`);
                    
                    let inputField: HTMLElement | null = null;
                    const selectors = getInputSelectors(platform);
                    
                    for (const selector of selectors) {
                        try {
                            inputField = await waitForElement(selector, 2000);
                            if (inputField) {
                                console.log(`✅ Found input field with selector: ${selector}`);
                                break;
                            }
                        } catch (err) { 
                            console.log(`⚠️ Input selector failed: ${selector}`);
                        }
                    }
                    
                    if (!inputField) throw new Error('No visible text input found.');
                    
                    // Set up response observer BEFORE sending the prompt
                    setupResponseObserver(platform, msg.taskId || 'unknown');
                    
                    setTextContent(inputField, msg.prompt, platform);
                    await new Promise(resolve => setTimeout(resolve, platform === 'Grok' ? 500 : 300));
                    
                    let sendButton: HTMLElement | undefined;
                    const buttonSelectors = getSendButtonSelectors(platform);
                    
                    for (const selector of buttonSelectors) {
                        try {
                            sendButton = await waitForElement(selector, 1000);
                            if (sendButton) {
                                console.log(`✅ Found send button with selector: ${selector}`);
                                break;
                            }
                        } catch (err) { 
                            console.log(`⚠️ Send button selector failed: ${selector}`);
                        }
                    }
                    
                    if (sendButton) {
                        clickSendButton(sendButton, platform);
                    } else {
                        console.log('⚠️ No send button found, trying Enter key...');
                        tryEnterKey(inputField, platform);
                    }

                    console.log(`🔍 Prompt injected and sent, response observer is now watching for completion...`);
                    sendResponse({ success: true, message: 'Prompt injected, response observer active' });

                } catch (err) {
                    console.error(`❌ Error during INJECT_PROMPT for ${platform}:`, err);
                    sendResponse({ success: false, error: err instanceof Error ? err.message : String(err) });
                }
            };
            injectAndSend();
            return true;
        }
        
        else if (msg.type === 'READ_LATEST_RESPONSE') {
            readLatestResponse(platform)
                .then(response => sendResponse({ success: true, response: response }))
                .catch(err => sendResponse({ success: false, error: err.message }));
            return true;
        }
        
        else if (msg.type === 'UNHIGHLIGHT_TEXT') {
            console.log('🎨 Content Script: Received UNHIGHLIGHT_TEXT message', msg.payload);
            
            if (msg.payload && msg.payload.id) {
                removeHighlightFromPage(msg.payload)
                    .then(success => {
                        console.log(`🎨 Unhighlight operation ${success ? 'successful' : 'failed'}`);
                        sendResponse({ success });
                    })
                    .catch(error => {
                        console.error('🎨 Error during unhighlight operation:', error);
                        sendResponse({ success: false, error: error.message });
                    });
            } else {
                console.warn('🎨 Invalid unhighlight payload received');
                sendResponse({ success: false, error: 'Invalid highlight data' });
            }
            
            return true; // Async response
        }
    });
    console.log('🧩 Enhanced content script message listener registered successfully');
}

/**
 * ENHANCED RESPONSE DETECTION SYSTEM
 * Sets up a MutationObserver to reliably detect when the AI response is complete
 */
function setupResponseObserver(platform: string, taskId: string): MutationObserver {
    console.log(`🔍 Setting up response observer for ${platform} (task: ${taskId})`);
    
    const containerSelector = getChatContainerSelector(platform);
    const chatContainer = document.querySelector(containerSelector);
    
    if (!chatContainer) {
        console.error(`❌ Could not find chat container for ${platform} with selector: ${containerSelector}`);
        // Still try to set up observer on body as fallback
    }
    
    const targetContainer = chatContainer || document.body;
    let debounceTimer: number | null = null;
    let lastResponseLength = 0;
    let stabilityCount = 0;
    const STABILITY_THRESHOLD = 3; // Need 3 consecutive stable checks
    const DEBOUNCE_DELAY = 1000; // 1 second delay
    
    const observer = new MutationObserver((mutations) => {
        // Clear existing timer
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }
        
        // Check if we have mutations that could indicate new content
        const hasRelevantMutations = mutations.some(mutation => {
            if (mutation.type === 'childList') {
                return mutation.addedNodes.length > 0;
            }
            if (mutation.type === 'characterData') {
                return true;
            }
            return false;
        });
        
        if (!hasRelevantMutations) {
            return;
        }
        
        // Set up debounced check
        debounceTimer = window.setTimeout(async () => {
            try {
                // Try to read the current response
                const currentResponse = await readLatestResponse(platform);
                const currentLength = currentResponse.length;
                
                console.log(`🔍 Response check - Length: ${currentLength}, Previous: ${lastResponseLength}`);
                
                if (currentLength === lastResponseLength && currentLength > 50) {
                    // Response length is stable and substantial
                    stabilityCount++;
                    console.log(`🔍 Stability count: ${stabilityCount}/${STABILITY_THRESHOLD}`);
                    
                    if (stabilityCount >= STABILITY_THRESHOLD) {
                        console.log(`✅ Response appears complete for ${platform} (task: ${taskId})`);
                        console.log(`📝 Final response preview: "${currentResponse.substring(0, 100)}..."`);
                        
                        // Disconnect observer
                        observer.disconnect();
                        
                        // Send WORKER_RESPONSE_COMPLETE message to background script
                        chrome.runtime.sendMessage({
                            type: 'WORKER_RESPONSE_COMPLETE',
                            taskId: taskId,
                            platform: platform,
                            response: currentResponse,
                            metadata: {
                                responseLength: currentLength,
                                detectionMethod: 'mutation_observer',
                                timestamp: Date.now()
                            }
                        }, () => {
                            if (chrome.runtime.lastError) {
                                console.error('❌ Error sending WORKER_RESPONSE_COMPLETE:', chrome.runtime.lastError);
                            } else {
                                console.log('✅ WORKER_RESPONSE_COMPLETE sent successfully');
                            }
                        });
                        
                        return;
                    }
                } else {
                    // Response is still changing, reset stability counter
                    stabilityCount = 0;
                    lastResponseLength = currentLength;
                }
                
                // Continue monitoring
                console.log(`🔍 Response still changing, continuing to monitor...`);
                
            } catch (error) {
                console.error(`❌ Error reading response during monitoring:`, error);
                // Continue monitoring despite errors
                stabilityCount = 0;
            }
        }, DEBOUNCE_DELAY);
    });
    
    // Start observing
    observer.observe(targetContainer, {
        childList: true,
        subtree: true,
        characterData: true,
    });
    
    // Set up a safety timeout (fallback in case observer fails)
    const SAFETY_TIMEOUT = 60000; // 60 seconds max
    setTimeout(async () => {
        if (observer) {
            console.warn(`⚠️ Safety timeout reached for ${platform} (task: ${taskId}), attempting to read response anyway...`);
            
            try {
                const finalResponse = await readLatestResponse(platform);
                
                observer.disconnect();
                
                chrome.runtime.sendMessage({
                    type: 'WORKER_RESPONSE_COMPLETE',
                    taskId: taskId,
                    platform: platform,
                    response: finalResponse,
                    metadata: {
                        responseLength: finalResponse.length,
                        detectionMethod: 'safety_timeout',
                        timestamp: Date.now()
                    }
                });
                
                console.log(`🆘 Sent response via safety timeout for ${platform}`);
                
            } catch (error) {
                console.error(`❌ Safety timeout failed to read response:`, error);
                
                observer.disconnect();
                
                chrome.runtime.sendMessage({
                    type: 'WORKER_RESPONSE_ERROR',
                    taskId: taskId,
                    platform: platform,
                    error: error instanceof Error ? error.message : 'Safety timeout failed'
                });
            }
        }
    }, SAFETY_TIMEOUT);
    
    console.log(`✅ Response observer active for ${platform}, watching for completion...`);
    return observer;
}