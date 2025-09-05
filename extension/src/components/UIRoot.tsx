import React, { useState, useEffect, useCallback } from 'react';
import Highlighter from './Highlighter';
import type { Highlight } from '../types';
import { useStorage } from '../hooks/useStorage';

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
   * Handles the mouseup event to detect text selections.
   */
  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      // TODO: Add logic to check if the selection is within a valid AI response container.
      
      const rect = range.getBoundingClientRect();
      setHighlighter({
        top: window.scrollY + rect.top - 40, // Position above the selection
        left: window.scrollX + rect.left + rect.width / 2,
      });
      setCurrentSelection(selection);
    } else {
      setHighlighter(null);
      setCurrentSelection(null);
    }
  }, []);

  /**
   * Applies the selected color as a highlight.
   */
  const applyHighlight = (color: Highlight['color']) => {
    if (!currentSelection || !currentSelection.rangeCount) return;

    const range = currentSelection.getRangeAt(0);
    const text = currentSelection.toString();
    
    // Create a unique ID for the highlight
    const id = `nexusmind-highlight-${Date.now()}`;

    // Create the <span> element for the highlight
    const span = document.createElement('span');
    span.id = id;
    span.className = `nexusmind-highlight nexusmind-highlight-${color}`;
    span.dataset.color = color;

    try {
      // Wrap the selected text with the span
      range.surroundContents(span);

      // Save the new highlight to storage
      const newHighlight: Highlight = {
        id,
        url: window.location.href,
        text,
        color,
        timestamp: Date.now(),
      };
      setHighlights([...(highlights || []), newHighlight]);

    } catch (e) {
      // This can happen if the selection spans across different block-level elements.
      // For this MVP, we'll log the error and not highlight in this complex case.
      console.error('NexusMind: Could not apply highlight to complex selection.', e);
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
