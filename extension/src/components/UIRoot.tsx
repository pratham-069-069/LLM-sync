import React, { useState, useEffect, useCallback } from 'react';
import Highlighter from './Highlighter';
import type { Highlight } from '../types';
import { useStorage } from '../hooks/useStorage';
import { createHighlight, getPlatformName, getResponseSelectors } from '../content-scripts/dom_utils';

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
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      
      // Check if the selection is within a valid AI response container
      if (isWithinAIResponse(range.commonAncestorContainer)) {
        const rect = range.getBoundingClientRect();
        setHighlighter({
          top: window.scrollY + rect.top - 40, // Position above the selection
          left: window.scrollX + rect.left + rect.width / 2,
        });
        setCurrentSelection(selection);
      }
    } else {
      setHighlighter(null);
      setCurrentSelection(null);
    }
  }, [isWithinAIResponse]);

  /**
   * Applies the selected color as a highlight.
   */
  const applyHighlight = (color: Highlight['color']) => {
    if (!currentSelection || !currentSelection.rangeCount) return;

    const range = currentSelection.getRangeAt(0);
    const text = currentSelection.toString();
    
    // Create a unique ID for the highlight
    const id = `nexusmind-highlight-${Date.now()}`;

    // Use our DOM utility to apply the highlight
    const success = createHighlight(range, color, id);
    
    if (success) {
      // Save the new highlight to storage
      const newHighlight: Highlight = {
        id,
        url: window.location.href,
        text,
        color,
        timestamp: Date.now(),
      };
      setHighlights([...(highlights || []), newHighlight]);
    }

    // Clear the selection and hide the highlighter
    currentSelection.removeAllRanges();
    setHighlighter(null);
    setCurrentSelection(null);
  };

  useEffect(() => {
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseUp]);

  // Re-apply existing highlights on page load or when highlights change
  useEffect(() => {
    // TODO: Implement logic to re-apply highlights from storage.
    // This is a complex task that requires finding the text on the page.
  }, [highlights]);

  return (
    <>
      {highlighter && (
        <Highlighter
          position={highlighter}
          onSelectColor={applyHighlight}
        />
      )}
    </>
  );
};

export default UIRoot;
