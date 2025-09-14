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
    { enabled: false, platform: 'Gemini', role: 'Critic' }
  );
  const [sidekickResponses, setSidekickResponses] = useState<{
    [targetId: string]: { analysis: string; role: string; element: HTMLElement }
  }>({});
  
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
        
        // Show keyboard shortcut hint if supported
        if (features.keyboardShortcuts) {
          showKeyboardShortcutHint(rect);
        }
      }
    } else {
      activeSelectionRef.current = null;
      setHighlighter(null);
      setCurrentSelection(null);
      hideKeyboardShortcutHint();
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
    hideKeyboardShortcutHint();
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

  /**
   * Shows keyboard shortcut hints when text is selected.
   */
  const showKeyboardShortcutHint = (rect: DOMRect) => {
    // Remove any existing hint
    hideKeyboardShortcutHint();
    
    const hint = document.createElement('div');
    hint.id = 'nexusmind-shortcut-hint';
    hint.innerHTML = `
      <div style="font-weight: 600; margin-bottom: 4px; color: #333;">Keyboard Shortcuts:</div>
      <div>Alt+Shift+1: <span style="color: #FFD700;">●</span> Yellow</div>
      <div>Alt+Shift+2: <span style="color: #4169E1;">●</span> Blue</div>
      <div>Alt+Shift+3: <span style="color: #32CD32;">●</span> Green</div>
      <div>Alt+Shift+4: <span style="color: #FF4444;">●</span> Red</div>
      <div>Alt+Shift+5: <span style="color: #9370DB;">●</span> Purple</div>
      <div style="font-size: 0.9em; margin-top: 4px; color: #666;">(Works with !@#$% symbols too)</div>
    `;
    hint.style.cssText = `
      position: absolute;
      top: ${rect.top + window.scrollY + rect.height + 5}px;
      left: ${rect.left + window.scrollX}px;
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 11px;
      font-family: system-ui, -apple-system, sans-serif;
      line-height: 1.4;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      max-width: 200px;
      animation: fadeIn 0.2s ease;
    `;
    
    // Add fade in animation
    const style = document.createElement('style');
    style.id = 'nexusmind-hint-styles';
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(-5px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `;
    if (!document.getElementById('nexusmind-hint-styles')) {
      document.head.appendChild(style);
    }
    
    document.body.appendChild(hint);
    
    // Auto-hide after 4 seconds
    setTimeout(() => {
      hideKeyboardShortcutHint();
    }, 4000);
  };

  /**
   * Hides the keyboard shortcut hint.
   */
  const hideKeyboardShortcutHint = () => {
    const existingHint = document.getElementById('nexusmind-shortcut-hint');
    if (existingHint) {
      existingHint.remove();
    }
  };

  // Render the SidekickResponse components using portals
  const renderSidekickResponses = () => {
    return Object.entries(sidekickResponses).map(([targetId, { analysis, role, element }]) => {
      // Skip if the element is no longer in the DOM
      if (!document.body.contains(element)) {
        return null;
      }
      
      // Create a container for the sidekick response if it doesn't exist
      let container = element.nextElementSibling;
      if (!container || !container.classList.contains('nexusmind-sidekick-container')) {
        container = document.createElement('div');
        container.classList.add('nexusmind-sidekick-container');
        if (element.nextSibling) {
          element.parentNode?.insertBefore(container, element.nextSibling);
        } else {
          element.parentNode?.appendChild(container);
        }
      }
      
      return createPortal(
        <SidekickResponse 
          key={targetId} 
          analysis={{ role, content: analysis }}
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
      const { targetElement, analysis, config } = event.detail;
      
      // Generate a unique ID for this response
      const targetId = targetElement.dataset.nexusmindId || `nexusmind-response-${Date.now()}`;
      if (!targetElement.dataset.nexusmindId) {
        targetElement.dataset.nexusmindId = targetId;
      }
      
      setSidekickResponses(prev => ({
        ...prev,
        [targetId]: {
          analysis,
          role: config.role,
          element: targetElement
        }
      }));
    };

    document.addEventListener('nexusmind-sidekick-response', 
      handleSidekickResponse as EventListener);
    
    return () => {
      document.removeEventListener('nexusmind-sidekick-response', 
        handleSidekickResponse as EventListener);
    };
  }, []);

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
      
      {/* Traditional highlighter for platforms that support inline highlighting */}
      {features.inlineHighlighting && highlighter && (
        <Highlighter
          position={highlighter}
          onSelectColor={applyHighlight}
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
