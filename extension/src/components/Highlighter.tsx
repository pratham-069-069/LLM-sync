import React from 'react';
import type { Highlight } from '../types';

// Define the colors that can be used for highlighting.
const HIGHLIGHT_COLORS: Highlight['color'][] = ['yellow', 'green', 'blue', 'red', 'purple'];

interface HighlighterProps {
  /** The position (top, left) where the highlighter should be rendered. */
  position: { top: number; left: number };
  /** Callback function to execute when a color is selected. */
  onSelectColor: (color: Highlight['color']) => void;
}

/**
 * A floating color picker component that appears near selected text.
 */
const Highlighter: React.FC<HighlighterProps> = ({ position, onSelectColor }) => {
  if (!position.top && !position.left) {
    return null;
  }

  return (
    <div
      className="absolute z-[10000] bg-white rounded-lg shadow-lg p-2 flex gap-2"
      style={{
        top: position.top,
        left: position.left,
      }}
      // Prevent the mouseup event from bubbling up and closing the highlighter immediately
      onMouseUp={(e) => e.stopPropagation()}
    >
      {HIGHLIGHT_COLORS.map((color) => (
        <button
          key={color}
          onClick={() => onSelectColor(color)}
          className={`w-6 h-6 rounded-full border-2 border-white transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
          style={{ backgroundColor: getCssColor(color) }}
          aria-label={`Highlight ${color}`}
        />
      ))}
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
