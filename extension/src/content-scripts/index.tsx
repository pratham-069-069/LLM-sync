import React from 'react';
import UIRoot from '../components/UIRoot';
import { createRoot } from 'react-dom/client';
import {
    getPlatformName,
    getInputSelectors,
    getSendButtonSelectors,
    getChatContainerSelector,
    waitForElement,
    setTextContent,
    clickSendButton,
    tryEnterKey,
    readLatestResponse
} from './dom_utils';

console.log('🧩 Multi-platform content script loaded on', location.href);

// --- UI Injection & Styling ---

/**
 * Injects a style tag into the document head to define highlight colors.
 */
const addHighlightStyles = () => {
  const style = document.createElement('style');
  style.textContent = `
    .nexusmind-highlight-yellow { background-color: rgba(255, 215, 0, 0.4); }
    .nexusmind-highlight-green { background-color: rgba(52, 211, 153, 0.4); }
    .nexusmind-highlight-blue { background-color: rgba(96, 165, 250, 0.4); }
    .nexusmind-highlight-red { background-color: rgba(248, 113, 113, 0.4); }
    .nexusmind-highlight-purple { background-color: rgba(167, 139, 250, 0.4); }
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

// --- Initialization ---
initializeUI();

// Main message listener
if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
        const platform = getPlatformName();

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