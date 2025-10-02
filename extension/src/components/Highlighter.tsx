import React, { useState, useEffect } from 'react';
import type { Highlight } from '../types';
import { useStorage } from '../hooks/useStorage';
import { SidekickManager } from '../services/SidekickManager';
import { getPlatformName, getResponseSelectors } from '../content-scripts/dom_utils';

// Define the colors that can be used for highlighting.
const HIGHLIGHT_COLORS: Highlight['color'][] = ['yellow', 'green', 'blue', 'red', 'purple'];

interface HighlighterProps {
  /** The position (top, left) where the highlighter should be rendered. */
  position: { top: number; left: number };
  /** Callback function to execute when a color is selected. */
  onSelectColor: (color: Highlight['color']) => void;
  /** Callback function to execute when analysis is requested. */
  onAnalyzeComplete?: () => void;
}

/**
 * A floating toolbar component that appears near selected text,
 * allowing users to highlight text or analyze it with AI.
 */
const Highlighter: React.FC<HighlighterProps> = ({ position, onSelectColor, onAnalyzeComplete }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [sidekickConfig] = useStorage<'nexusmind-sidekick-config'>(
    'nexusmind-sidekick-config',
    { enabled: false, workerAI: 'Claude', customPrompt: 'Analyze this response and provide critical feedback on accuracy, completeness, and potential improvements.', useMediator: true }
  );

  // Configure SidekickManager when component mounts or config changes
  useEffect(() => {
    if (sidekickConfig && sidekickConfig.enabled) {
      console.log('Configuring SidekickManager with:', sidekickConfig);
      const sidekickManager = SidekickManager.getInstance();
      
      // Use the configure method to set up SidekickManager
      sidekickManager.configure(sidekickConfig);
      
      console.log('SidekickManager configured successfully');
    }
  }, [sidekickConfig]);

  if (!position.top && !position.left) {
    return null;
  }

  // Add spin animation style
  React.useEffect(() => {
    const styleId = 'nexusmind-highlighter-animation-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);



  const handleAnalyzeClick = async () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    
    setIsAnalyzing(true);
    
    try {
      // Store the selected text before we do anything else
      const selectedText = selection.toString().trim();
      if (!selectedText) {
        console.warn('No text selected');
        setIsAnalyzing(false);
        return;
      }
      
      // Find the containing AI response element
      const range = selection.getRangeAt(0);
      const selectionNode = range.commonAncestorContainer;
      const platform = getPlatformName();
      const selectors = getResponseSelectors(platform);
      
      // Find the closest AI response container
      let responseElement: HTMLElement | null = null;
      let currentNode: Node | null = selectionNode;
      
      while (currentNode && currentNode !== document.body) {
        if (currentNode instanceof HTMLElement) {
          for (const selector of selectors) {
            try {
              if (currentNode.matches(selector) || currentNode.closest(selector)) {
                responseElement = currentNode.matches(selector) 
                  ? currentNode 
                  : currentNode.closest(selector) as HTMLElement;
                break;
              }
            } catch (e) {
              console.log(`Invalid selector: ${selector}`, e);
            }
          }
          if (responseElement) break;
        }
        currentNode = currentNode.parentNode;
      }
      
      if (!responseElement) {
        // If we couldn't find the container, create a temporary element
        console.warn('Could not find AI response container, using selection directly');
        responseElement = document.createElement('div');
        responseElement.textContent = selectedText;
        // Don't append it to DOM, just use it as a container
      }
      
      // Get the SidekickManager instance and ensure it's configured
      const sidekickManager = SidekickManager.getInstance();
      
      // Double-check that it's configured before proceeding
      if (sidekickConfig && sidekickConfig.enabled) {
        console.log('Re-configuring SidekickManager before analysis:', sidekickConfig);
        sidekickManager.configure(sidekickConfig);
      }
      
      console.log('About to call analyzeMessage with:', {
        sidekickManager,
        sidekickConfig,
        isInitialized: sidekickManager.isInitialized
      });
      
      try {
        // Use SidekickManager to analyze the response
        const result = await sidekickManager.analyzeMessage(responseElement);
        console.log('Analysis result:', result);
        
        if (!result || !result.success) {
          console.error('Analysis failed:', result?.error);
        }
      } catch (innerError) {
        console.error('Analysis process failed:', innerError);
      } finally {
        // Clear the selection and call completion callback
        window.getSelection()?.removeAllRanges();
        onAnalyzeComplete?.();
        setIsAnalyzing(false);
      }
    } catch (error) {
      console.error('Failed to analyze text:', error);
      setIsAnalyzing(false);
      window.getSelection()?.removeAllRanges();
      onAnalyzeComplete?.();
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: position.top,
        left: position.left,
        zIndex: 999999,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(8px)',
        borderRadius: '12px',
        padding: '8px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        transform: 'translateX(-50%)',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
      // Prevent the mouseup event from bubbling up and closing the highlighter immediately
      onMouseUp={(e) => e.stopPropagation()}
    >
      {/* Add Analyze button - only if Sidekick is enabled */}
      {sidekickConfig?.enabled && (
        <button
          onClick={handleAnalyzeClick}
          disabled={isAnalyzing}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            justifyContent: 'center',
            backgroundColor: 'transparent',
            backgroundImage: isAnalyzing
              ? 'none' 
              : 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)',
            border: 'none',
            borderRadius: '8px',
            padding: '8px 12px',
            color: isAnalyzing ? 'rgba(255, 255, 255, 0.5)' : 'white',
            cursor: isAnalyzing ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            width: '100%',
            transition: 'all 0.2s ease',
            outline: 'none',
          }}
          onMouseEnter={(e) => {
            if (!isAnalyzing) {
              e.currentTarget.style.backgroundImage = 'linear-gradient(135deg, #7c3aed 0%, #2563eb 100%)';
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(139, 92, 246, 0.4)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isAnalyzing) {
              e.currentTarget.style.backgroundImage = 'linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%)';
              e.currentTarget.style.boxShadow = 'none';
            }
          }}
        >
          {isAnalyzing ? (
            <>
              <div
                style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  borderTop: '2px solid white',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }}
              />
              Analyzing...
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 12l2 2 4-4"/>
                <circle cx="12" cy="12" r="9"/>
              </svg>
              Analyze with {sidekickConfig?.workerAI || 'AI'}
            </>
          )}
        </button>
      )}
      
      {/* Existing color buttons - wrap in a row container */}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
        {HIGHLIGHT_COLORS.map((color) => (
          <button
            key={color}
            onClick={() => onSelectColor(color)}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: getCssColor(color),
              border: '2px solid rgba(255, 255, 255, 0.3)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: '600',
              color: 'white',
              textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
              transition: 'all 0.2s ease',
              outline: 'none',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.1)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = 'none';
            }}
            title={`Highlight ${color}`}
          >
            {color.charAt(0).toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
};

/**
 * Helper function to get the CSS color value for a highlight color name.
 * @param color The name of the color from our type definition.
 * @returns A CSS color string.
 */
const getCssColor = (color: Highlight['color']): string => {
  switch (color) {
    case 'yellow': return '#FFD700'; // Gold
    case 'green': return '#34D399'; // Emerald-400
    case 'blue': return '#60A5FA';  // Blue-400
    case 'red': return '#F87171';   // Red-400
    case 'purple': return '#A78BFA';// Violet-400
    default: return '#FFFFFF';
  }
};

export default Highlighter;
