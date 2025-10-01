import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import Highlighter from './Highlighter';
import SidePanel from './SidePanel';
import SidekickResponse from './SidekickResponse';
import type { Highlight } from '../types';
import { useStorage } from '../hooks/useStorage';
import { createHighlight, getPlatformName, getResponseSelectors, debugResponseContainers, getSupportedFeatures } from '../content-scripts/dom_utils';
import { SidekickManager } from '../services/SidekickManager';

/**
 * The root component for all UI injected into the page.
 * It manages the state for the highlighter and other future UI elements.
 */
const UIRoot: React.FC = () => {
  const [highlighter, setHighlighter] = useState<{ top: number; left: number } | null>(null);
  const [currentSelection, setCurrentSelection] = useState<Selection | null>(null);
  const [highlights, setHighlights] = useStorage<'nexusmind-highlights'>(
    'nexusmind-highlights',
    []
  );
  const [sidePanelVisible, setSidePanelVisible] = useState(false);
  const [sidekickConfig] = useStorage<'nexusmind-sidekick-config'>(
    'nexusmind-sidekick-config',
    { enabled: false, workerAI: 'Claude', customPrompt: 'Analyze this response and provide critical feedback on accuracy, completeness, and potential improvements.', useMediator: true }
  );
  const [sidekickResponses, setSidekickResponses] = useState<{
    [targetId: string]: { analysis: string; role: string; element: HTMLElement }
  }>({});
  const [analyzingElements, setAnalyzingElements] = useState<Set<string>>(new Set());
  
  // Ref to store the active selection for direct keyboard access
  const activeSelectionRef = useRef<Selection | null>(null);

  // Get platform-specific features
  const platform = getPlatformName();
  const features = getSupportedFeatures(platform);
  
  console.log(`NexusMind: Platform detected as ${platform}, features:`, features);

  /**
   * Checks if a DOM node is within an AI response container.
   */
  const isWithinAIResponse = useCallback((node: Node): boolean => {
    const platform = getPlatformName();
    const selectors = getResponseSelectors(platform);
    
    // If we don't have selectors for this platform, allow highlights anywhere
    if (!selectors || selectors.length === 0) return true;
    
    // Walk up the DOM tree to check if we're in an AI response
    let current: Node | null = node;
    while (current && current !== document.body) {
      if (current instanceof HTMLElement) {
        // Check if the element matches any of our selectors
        for (const selector of selectors) {
          try {
            if (current.matches(selector) || current.closest(selector)) {
              return true;
            }
          } catch (e) {
            console.log(`Invalid selector: ${selector}`, e);
          }
        }
      }
      current = current.parentNode;
    }
    return false;
  }, []);

  /**
   * Handles the mouseup event to detect text selections.
   */
  const handleMouseUp = useCallback(() => {
    // Only show highlighter if inline highlighting is supported
    if (!features.inlineHighlighting) return;
    
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      
      // Store in ref for direct keyboard access
      activeSelectionRef.current = selection;
      
      // Debug output for selection analysis
      console.log('Selection common ancestor:', range.commonAncestorContainer);
      console.log('Selection text:', selection.toString().substring(0, 50) + '...');
      
      // Check if the selection is within a valid AI response container
      const isInResponse = isWithinAIResponse(range.commonAncestorContainer);
      console.log('Is within AI response?', isInResponse);
      
      if (isInResponse) {
        const rect = range.getBoundingClientRect();
        setHighlighter({
          top: window.scrollY + rect.top - 40, // Position above the selection
          left: window.scrollX + rect.left + rect.width / 2,
        });
        setCurrentSelection(selection);
      }
    } else {
      activeSelectionRef.current = null;
      setHighlighter(null);
      setCurrentSelection(null);
    }
  }, [isWithinAIResponse, features]);

  /**
   * Handles keyboard shortcuts for highlighting.
   */
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Only proceed if keyboard shortcuts are supported
    if (!features.keyboardShortcuts) return;
    
    // Only proceed if Alt+Shift is pressed
    if (!event.altKey || !event.shiftKey) return;
    
    // Debug the key pressed with modifiers
    console.log(`Shortcut attempted: Alt+Shift+${event.key} (keyCode: ${event.keyCode})`);
    
    // Only proceed if text is selected
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;
    
    const range = selection.getRangeAt(0);
    
    // Check if selection is in AI response
    if (!isWithinAIResponse(range.commonAncestorContainer)) return;
    
    // Handle different color shortcuts
    let color: Highlight['color'] | null = null;
    
    switch(event.key) {
      // Handle both number keys and their shift-modified versions
      case '1': 
      case '!': 
        color = 'yellow';
        break;
      case '2': 
      case '@': 
        color = 'blue';
        break;
      case '3': 
      case '#': 
        color = 'green';
        break;
      case '4': 
      case '$': 
        color = 'red';
        break;
      case '5': 
      case '%': 
        color = 'purple';
        break;
      default: 
        return; // Unknown shortcut, do nothing
    }
    
    if (color) {
      // Stop event propagation and prevent default behavior
      event.preventDefault();
      event.stopPropagation();
      
      console.log(`✓ Applying ${color} highlight via keyboard shortcut`);
      
      // Apply the highlight directly
      applyHighlightFromKeyboard(color, selection);
      
      // Show notification
      showHighlightNotification(color);
    }
  }, [isWithinAIResponse, features]);

  /**
   * Applies the selected color as a highlight.
   */
  const applyHighlight = async (color: Highlight['color']) => {
    if (!currentSelection || !currentSelection.rangeCount) return;
    
    console.log(`Applying highlight with color: ${color}`);
    const range = currentSelection.getRangeAt(0);
    const text = currentSelection.toString().trim();
    if (!text) return;

    console.log(`Selected text: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
    
    // Create a unique ID for the highlight
    const id = `nexusmind-highlight-${Date.now()}`;
    console.log(`Generated highlight ID: ${id}`);

    // Use our DOM utility to apply the highlight
    console.log(`Calling createHighlight for platform: ${getPlatformName()}`);
    const success = await createHighlight(range, color, id);
    console.log(`Highlight creation result: ${success ? 'Success' : 'Failed'}`);
    
    if (success) {
      // Save the new highlight to storage
      const newHighlight: Highlight = {
        id,
        url: window.location.href,
        text,
        color,
        timestamp: Date.now(),
        platform: getPlatformName(),
      };
      setHighlights([newHighlight, ...(highlights || [])]);
      console.log(`Highlight saved to storage, total highlights: ${(highlights || []).length + 1}`);
    }

    // Clear the selection and hide the highlighter
    currentSelection.removeAllRanges();
    setHighlighter(null);
    setCurrentSelection(null);
  };  /**
   * Applies highlight from keyboard shortcut (without using currentSelection state).
   */
  const applyHighlightFromKeyboard = async (color: Highlight['color'], selection: Selection) => {
    if (!selection || !selection.rangeCount) return;

    console.log(`Applying keyboard highlight with color: ${color}`);
    const range = selection.getRangeAt(0);
    const text = selection.toString().trim();
    if (!text) return;
    
    console.log(`Selected text: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
    
    // Create a unique ID for the highlight
    const id = `nexusmind-highlight-${Date.now()}`;
    console.log(`Generated highlight ID: ${id}`);

    // Use our DOM utility to apply the highlight
    console.log(`Calling createHighlight for platform: ${getPlatformName()}`);
    const success = await createHighlight(range, color, id);
    console.log(`Highlight creation result: ${success ? 'Success' : 'Failed'}`);
    
    if (success) {
      // Save the new highlight to storage
      const newHighlight: Highlight = {
        id,
        url: window.location.href,
        text,
        color,
        timestamp: Date.now(),
        platform: getPlatformName(),
      };
      setHighlights([newHighlight, ...(highlights || [])]);
      console.log(`Highlight saved to storage, total highlights: ${(highlights || []).length + 1}`);
      
      // Show notification
      showHighlightNotification(color);
    }

    // Clear the selection and hide any UI
    selection.removeAllRanges();
    setHighlighter(null);
    setCurrentSelection(null);
    activeSelectionRef.current = null;
  };

  /**
   * Shows a temporary notification when highlighting via keyboard.
   */
  const showHighlightNotification = (color: Highlight['color']) => {
    const notification = document.createElement('div');
    notification.textContent = `✅ Highlighted with ${color}`;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #333;
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
      z-index: 10000;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      border-left: 4px solid var(--highlight-color);
      animation: slideIn 0.3s ease;
    `;
    
    // Set the highlight color variable
    const colorMap = {
      yellow: '#FFD700',
      blue: '#4169E1',
      green: '#32CD32',
      red: '#FF4444',
      purple: '#9370DB'
    };
    notification.style.setProperty('--highlight-color', colorMap[color]);
    
    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(notification);
    
    // Remove after 2 seconds with fade out
    setTimeout(() => {
      notification.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        notification.remove();
        style.remove();
      }, 300);
    }, 2000);
  };

  // Render the SidekickResponse components using portals
  const renderSidekickResponses = () => {
    return Object.entries(sidekickResponses).map(([targetId, responseData]) => {
      // Skip internal force update entries
      if (targetId === '__forceUpdate') return null;
      
      const { analysis, role, element, error } = responseData as any;
      
      // Skip if the element is no longer in the DOM
      if (!document.body.contains(element)) {
        return null;
      }
      
      // A more robust way to create and find the container
      const containerId = `sidekick-container-for-${targetId}`;
      let container = element.querySelector(`#${containerId}`);

      if (!container) {
        container = document.createElement('div');
        container.id = containerId;
        // The class is still useful for styling and selection
        container.classList.add('nexusmind-sidekick-container');
        
        // Append as the LAST CHILD of the element. This is much more stable
        // than trying to guess where the "next" element is.
        element.appendChild(container);
      }
      
      // Retry handler for this specific response
      const handleRetry = () => {
        console.log(`🔄 Retrying analysis for target: ${targetId}`);
        
        // Clear this specific error
        setSidekickResponses(prev => {
          const updated = { ...prev };
          delete updated[targetId];
          return updated;
        });
        
        // Dispatch retry event
        const retryEvent = new CustomEvent('nexusmind-retry-analysis', {
          detail: { 
            targetId,
            element,
            timestamp: Date.now()
          }
        });
        document.dispatchEvent(retryEvent);
      };
      
      return createPortal(
        <SidekickResponse 
          key={targetId}
          analysis={{ role: role || 'Unknown', content: analysis || '' }}
          error={error}
          onRetry={error ? handleRetry : undefined}
        />,
        container as HTMLElement
      );
    }).filter(Boolean); // Remove null entries
  };

  // Add direct keyboard handling with capture phase and debug logging
  useEffect(() => {
    // Only add keyboard listeners if shortcuts are supported
    if (!features.keyboardShortcuts) return;
    
    const handleKeyDownDirect = (e: KeyboardEvent) => {
      // Debug logging for all key events
      if (e.altKey || e.ctrlKey) {
        console.log('Key pressed:', e.key, 
          'Alt:', e.altKey, 
          'Shift:', e.shiftKey, 
          'Ctrl:', e.ctrlKey, 
          'Selection:', window.getSelection()?.toString().slice(0, 20)
        );
      }
      
      if (e.altKey && e.shiftKey && activeSelectionRef.current) {
        const num = parseInt(e.key);
        if (num >= 1 && num <= 5) {
          e.preventDefault();
          e.stopPropagation(); // Stop event bubbling
          console.log(`Applying highlight color for Alt+Shift+${num}`);
          
          const colorMap = ['yellow', 'blue', 'green', 'red', 'purple'];
          applyHighlightFromKeyboard(colorMap[num-1] as Highlight['color'], activeSelectionRef.current);
        }
      }
    };

    // Use capture phase to intercept events before they bubble
    document.addEventListener('keydown', handleKeyDownDirect, true);
    return () => document.removeEventListener('keydown', handleKeyDownDirect, true);
  }, [features.keyboardShortcuts]);

  // Initialize SidekickManager when config changes
  useEffect(() => {
    const sidekickManager = SidekickManager.getInstance();
    
    if (sidekickConfig && sidekickConfig.enabled) {
      console.log('NexusMind: Starting SidekickManager with config:', sidekickConfig);
      sidekickManager.start(sidekickConfig);
    } else {
      sidekickManager.stop();
    }
    
    return () => {
      sidekickManager.stop();
    };
  }, [sidekickConfig]);

  // Listen for sidekick response events
  useEffect(() => {
    const handleSidekickResponse = (event: CustomEvent) => {
      const { targetElement, analysis, metadata } = event.detail;
      
      console.log('🔄 UIRoot: Received sidekick response event', { analysis, metadata });
      
      // Generate a unique ID for this response
      const targetId = targetElement.dataset.nexusmindId || `nexusmind-response-${Date.now()}`;
      if (!targetElement.dataset.nexusmindId) {
        targetElement.dataset.nexusmindId = targetId;
      }
      
      setSidekickResponses(prev => ({
        ...prev,
        [targetId]: {
          analysis,
          role: metadata?.role || 'Unknown',
          element: targetElement
        }
      }));
      
      console.log('✅ UIRoot: Sidekick response state updated');
    };

    // ENHANCED BUG FIX 3: Add comprehensive refresh event handler to force UI updates
    const handleForceRefresh = (event: CustomEvent) => {
      console.log('🔄 UIRoot: Force refresh triggered', event.detail);
      
      // Force React to re-render by updating a timestamp with state manipulation
      const timestamp = Date.now();
      setSidekickResponses(prev => ({ 
        ...prev, 
        __forceUpdate: timestamp 
      } as any)); // Force re-render with timestamp
      
      // Additional method: Force component re-mount by changing key
      const rootElement = document.querySelector('.nexusmind-ui-root');
      if (rootElement && rootElement.parentElement) {
        const parent = rootElement.parentElement;
        const newRoot = rootElement.cloneNode(true);
        parent.removeChild(rootElement);
        parent.appendChild(newRoot);
        console.log('🔄 UIRoot: DOM re-mounted for refresh');
      }
      
      // Additional refresh for highlights if needed
      const currentUrl = window.location.href;
      const pageHighlights = highlights?.filter(h => h.url === currentUrl) || [];
      if (pageHighlights.length > 0) {
        // Trigger highlight restoration by setting the same array (forces re-render)
        setHighlights([...(highlights || [])]);
      }
    };

    // ENHANCED: Add retry event handler for failed sidekick requests
    const handleRetryAnalysis = (event: CustomEvent) => {
      console.log('🔄 UIRoot: Retry analysis triggered', event.detail);
      
      // Clear any error state and trigger fresh analysis
      setSidekickResponses(prev => {
        const filtered = Object.fromEntries(
          Object.entries(prev).filter(([key]) => key !== '__forceUpdate')
        );
        return filtered;
      });
      
      // Dispatch event to SidekickManager to retry latest message
      const retryEvent = new CustomEvent('nexusmind-retry-latest-message', {
        detail: { 
          timestamp: Date.now(),
          requestId: event.detail?.requestId || 'manual-retry'
        }
      });
      document.dispatchEvent(retryEvent);
    };

    // Add error event handler with retry capability
    const handleSidekickError = (event: CustomEvent) => {
      const { error, metadata, targetElement } = event.detail;
      console.error('❌ UIRoot: Received sidekick error event', { error, metadata });
      
      // Display error in UI with retry option
      if (targetElement) {
        const targetId = targetElement.dataset.nexusmindId || `nexusmind-error-${Date.now()}`;
        if (!targetElement.dataset.nexusmindId) {
          targetElement.dataset.nexusmindId = targetId;
        }
        
        setSidekickResponses(prev => ({
          ...prev,
          [targetId]: {
            analysis: '',
            role: 'Error',
            element: targetElement,
            error: error || 'Unknown error occurred'
          }
        }));
      }
    };

    document.addEventListener('nexusmind-sidekick-response', 
      handleSidekickResponse as EventListener);
    document.addEventListener('nexusmind-force-ui-refresh', 
      handleForceRefresh as EventListener);
    document.addEventListener('nexusmind-retry-analysis',
      handleRetryAnalysis as EventListener);
    document.addEventListener('nexusmind-sidekick-error', 
      handleSidekickError as EventListener);
    
    return () => {
      document.removeEventListener('nexusmind-sidekick-response', 
        handleSidekickResponse as EventListener);
      document.removeEventListener('nexusmind-force-ui-refresh', 
        handleForceRefresh as EventListener);
      document.removeEventListener('nexusmind-retry-analysis',
        handleRetryAnalysis as EventListener);
      document.removeEventListener('nexusmind-sidekick-error', 
        handleSidekickError as EventListener);
    };
  }, [highlights]);

  useEffect(() => {
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleMouseUp, handleKeyDown]);

  // Debug response containers after a delay to ensure page is loaded
  useEffect(() => {
    const timer = setTimeout(() => {
      console.log('NexusMind: Running response container debug...');
      debugResponseContainers();
    }, 3000);
    
    return () => clearTimeout(timer);
  }, []);

  // Implement hover-to-reveal toolbar for clean UI
  useEffect(() => {
    if (!sidekickConfig?.enabled) return;

    const setupHoverToolbars = () => {
      const platform = getPlatformName();
      const responseSelectors = getResponseSelectors(platform);
      
      if (!responseSelectors || responseSelectors.length === 0) return;

      const responses = document.querySelectorAll<HTMLElement>(responseSelectors.join(', '));
      
      responses.forEach(responseElement => {
        // Skip if already has hover toolbar setup
        if (responseElement.dataset.nexusmindToolbar === 'setup') return;

        // Skip if this is our own UI
        if (responseElement.classList.contains('nexusmind-') || 
            responseElement.id?.startsWith('nexusmind-')) return;

        // Mark as setup to prevent duplicates
        responseElement.dataset.nexusmindToolbar = 'setup';

        // Create the hover toolbar
        const toolbar = document.createElement('div');
        toolbar.className = 'nexusmind-hover-toolbar';
        toolbar.style.cssText = `
          position: absolute;
          top: 8px;
          right: 8px;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(0, 0, 0, 0.1);
          border-radius: 8px;
          padding: 4px;
          display: flex;
          gap: 4px;
          opacity: 0;
          pointer-events: none;
          transition: all 0.2s ease;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 10000;
          font-family: system-ui, -apple-system, sans-serif;
        `;

        // Create analyze button
        const analyzeButton = document.createElement('button');
        analyzeButton.className = 'nexusmind-analyze-btn';
        analyzeButton.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 12l2 2 4-4"/>
            <circle cx="12" cy="12" r="9"/>
          </svg>
        `;
        analyzeButton.title = `Analyze with ${sidekickConfig.workerAI}`;
        analyzeButton.style.cssText = `
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none;
          border-radius: 6px;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
          color: white;
        `;

        // Add hover effects to button
        analyzeButton.onmouseenter = () => {
          analyzeButton.style.transform = 'scale(1.1)';
          analyzeButton.style.boxShadow = '0 2px 8px rgba(102, 126, 234, 0.4)';
        };
        
        analyzeButton.onmouseleave = () => {
          analyzeButton.style.transform = 'scale(1)';
          analyzeButton.style.boxShadow = 'none';
        };

        // Handle analyze click
        analyzeButton.onclick = async (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          const targetId = responseElement.dataset.nexusmindId || 
            `nexusmind-response-${Date.now()}`;
          
          if (!responseElement.dataset.nexusmindId) {
            responseElement.dataset.nexusmindId = targetId;
          }

          // Check if already analyzing
          if (analyzingElements.has(targetId)) return;

          // Show loading state
          setAnalyzingElements(prev => new Set([...prev, targetId]));
          analyzeButton.disabled = true;
          analyzeButton.innerHTML = `
            <div style="
              display: inline-block; 
              width: 14px; 
              height: 14px; 
              border: 2px solid rgba(255,255,255,0.3); 
              border-top: 2px solid white; 
              border-radius: 50%; 
              animation: spin 1s linear infinite;
            "></div>
          `;
          
          // Ensure spin animation is available
          if (!document.querySelector('#nexusmind-spin-styles')) {
            const style = document.createElement('style');
            style.id = 'nexusmind-spin-styles';
            style.textContent = `
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `;
            document.head.appendChild(style);
          }

          try {
            // Call SidekickManager to analyze this message
            const result = await SidekickManager.getInstance().analyzeMessage(responseElement);
            
            if (!result.success) {
              // Show error state
              analyzeButton.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="15" y1="9" x2="9" y2="15"/>
                  <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
              `;
              analyzeButton.style.background = 'linear-gradient(135deg, #ff6b6b 0%, #ffa500 100%)';
              analyzeButton.title = `Error: ${result.error}`;
              
              // Reset after 3 seconds
              setTimeout(() => {
                analyzeButton.disabled = false;
                analyzeButton.innerHTML = `
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 12l2 2 4-4"/>
                    <circle cx="12" cy="12" r="9"/>
                  </svg>
                `;
                analyzeButton.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                analyzeButton.title = `Analyze with ${sidekickConfig.workerAI}`;
              }, 3000);
            } else {
              // Show success state
              analyzeButton.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 12l2 2 4-4"/>
                  <circle cx="12" cy="12" r="9"/>
                </svg>
              `;
              analyzeButton.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
              analyzeButton.title = 'Analysis complete!';
              analyzeButton.disabled = true;
            }
          } catch (error) {
            console.error('Analysis failed:', error);
            analyzeButton.innerHTML = `
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
            `;
            analyzeButton.style.background = 'linear-gradient(135deg, #ff6b6b 0%, #ffa500 100%)';
            analyzeButton.title = 'Analysis failed';
          } finally {
            setAnalyzingElements(prev => {
              const next = new Set(prev);
              next.delete(targetId);
              return next;
            });
          }
        };

        toolbar.appendChild(analyzeButton);

        // Make the response element relative positioned for proper toolbar placement
        const computedStyle = window.getComputedStyle(responseElement);
        if (computedStyle.position === 'static') {
          responseElement.style.position = 'relative';
        }

        // Add toolbar to response element
        responseElement.appendChild(toolbar);

        // Add hover event listeners to show/hide toolbar
        const showToolbar = () => {
          toolbar.style.opacity = '1';
          toolbar.style.pointerEvents = 'auto';
        };

        const hideToolbar = () => {
          toolbar.style.opacity = '0';
          toolbar.style.pointerEvents = 'none';
        };

        // Add hover listeners to both the response and toolbar
        responseElement.addEventListener('mouseenter', showToolbar);
        responseElement.addEventListener('mouseleave', hideToolbar);
        
        // Keep toolbar visible when hovering over it
        toolbar.addEventListener('mouseenter', showToolbar);
        toolbar.addEventListener('mouseleave', hideToolbar);
      });
    };

    // Initial setup
    setupHoverToolbars();

    // Watch for new responses
    const observer = new MutationObserver((mutations) => {
      let shouldSetup = false;
      
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement;
            // Check if new response was added
            const responseSelectors = getResponseSelectors(getPlatformName());
            if (responseSelectors.some(selector => {
              try {
                return element.matches?.(selector) || element.querySelector?.(selector);
              } catch {
                return false;
              }
            })) {
              shouldSetup = true;
            }
          }
        });
      });

      if (shouldSetup) {
        setTimeout(setupHoverToolbars, 500); // Delay to ensure content is stable
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    return () => {
      observer.disconnect();
      // Clean up existing toolbars
      document.querySelectorAll('.nexusmind-hover-toolbar').forEach(toolbar => {
        toolbar.remove();
      });
      // Reset position styles
      document.querySelectorAll('[data-nexusmind-toolbar="setup"]').forEach(element => {
        const htmlElement = element as HTMLElement;
        delete htmlElement.dataset.nexusmindToolbar;
        if (htmlElement.style.position === 'relative') {
          htmlElement.style.position = '';
        }
      });
    };
  }, [sidekickConfig, analyzingElements]);



  const waitForPageContent = useCallback(() => {
    const platform = getPlatformName();
    const responseSelectors = getResponseSelectors(platform);
    
    return new Promise<void>((resolve) => {
      if (responseSelectors.length > 0 && document.querySelector(responseSelectors[0])) {
        return resolve();
      }
      const observer = new MutationObserver((_mutations, obs) => {
        if (responseSelectors.length > 0 && document.querySelector(responseSelectors[0])) {
          obs.disconnect();
          resolve();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { // Failsafe timeout
        observer.disconnect();
        resolve();
      }, 10000);
    });
  }, []);

  const findTextInElement = useCallback((element: Element, text: string): Range | null => {
    const normalizedSearchText = text.replace(/\s+/g, ' ').trim();
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node;
    while (node = walker.nextNode()) {
      const nodeText = node.textContent || '';
      const start = nodeText.indexOf(normalizedSearchText);
      if (start > -1) {
        const range = document.createRange();
        range.setStart(node, start);
        range.setEnd(node, start + normalizedSearchText.length);
        return range;
      }
    }
    return null;
  }, []);

  const restoreSingleHighlight = useCallback(async (highlight: Highlight) => {
    // Only restore highlights for the current platform
    if (highlight.platform !== getPlatformName()) return;

    const platform = getPlatformName();
    const responseSelectors = getResponseSelectors(platform);
    for (const selector of responseSelectors) {
      const containers = document.querySelectorAll(selector);
      for (const container of Array.from(containers)) {
        const range = findTextInElement(container, highlight.text);
        if (range) {
          // Check if the highlight already exists to prevent duplicates
          if (document.getElementById(highlight.id)) {
            console.log(`Skipping duplicate highlight: ${highlight.id}`);
            return;
          }
          await createHighlight(range, highlight.color, highlight.id);
          console.log(`✅ Restored highlight: ${highlight.id}`);
          return;
        }
      }
    }
    console.warn(`Could not find text to restore highlight: ${highlight.text.substring(0, 50)}...`);
  }, [findTextInElement]);

  // Re-apply existing highlights on page load or when highlights change
  useEffect(() => {
    const restoreHighlights = async () => {
      if (!features.inlineHighlighting || !highlights || !Array.isArray(highlights)) return;
      
      await waitForPageContent();
      
      const currentUrl = window.location.href;
      const pageHighlights = highlights.filter(h => h.url === currentUrl);
      
      console.log(`Found ${pageHighlights.length} highlights for this page. Restoring...`);
      
      for (const highlight of pageHighlights) {
        // A short delay between restorations can help with page rendering
        await new Promise(res => setTimeout(res, 50));
        await restoreSingleHighlight(highlight);
      }
      console.log('Finished restoring highlights.');
    };
    
    // Use a timeout to ensure the page has settled before restoring
    const timer = setTimeout(restoreHighlights, 500);
    return () => clearTimeout(timer);
  }, [highlights, features.inlineHighlighting, waitForPageContent, restoreSingleHighlight]);

  return (
    <>
      {/* Conditional rendering based on platform capabilities */}
      
      {/* Enhanced highlighter for platforms that support inline highlighting */}
      {features.inlineHighlighting && highlighter && (
        <Highlighter
          position={highlighter}
          onSelectColor={applyHighlight}
          onAnalyzeComplete={() => {
            setHighlighter(null);
            setCurrentSelection(null);
          }}
        />
      )}
      
      {/* Side panel for snippet collection (especially useful for Gemini/DeepSeek) */}
      {features.sidePanelSnippets && (
        <SidePanel
          isVisible={sidePanelVisible}
          onToggle={() => setSidePanelVisible(!sidePanelVisible)}
        />
      )}

      {/* Render sidekick analyses */}
      {renderSidekickResponses()}
    </>
  );
};

export default UIRoot;
