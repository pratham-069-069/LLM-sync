import React, { useState, useCallback, useEffect } from 'react';
import { useStorage } from '../hooks/useStorage';
import type { Snippet, Highlight } from '../types';

interface SidePanelProps {
  isVisible: boolean;
  onToggle: () => void;
}

/**
 * Side panel component for drag-and-drop snippet collection
 * This is our primary feature for platforms like Gemini and DeepSeek
 */
const SidePanel: React.FC<SidePanelProps> = ({ isVisible, onToggle }) => {
  const [snippets, setSnippets] = useStorage<'nexusmind-snippets'>('nexusmind-snippets', []);
  const [highlights, setHighlights] = useStorage<'nexusmind-highlights'>('nexusmind-highlights', []);
  const [isDragOver, setIsDragOver] = useState(false);
  const [activeTab, setActiveTab] = useState<'snippets' | 'highlights'>('snippets');

  useEffect(() => {
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === 'local' && changes['nexusmind-highlights']) {
        const newHighlights = changes['nexusmind-highlights'].newValue;
        console.log('🎨 NexusMind: Detected highlight changes in storage, updating SidePanel.');
        setHighlights(newHighlights || []);
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, [setHighlights]);

  // Handle drag and drop events
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    // Get the dropped text
    let droppedText = e.dataTransfer.getData('text/plain');
    
    if (droppedText && droppedText.trim().length > 0) {
      // Clean up the text by normalizing line breaks
      droppedText = droppedText
        .replace(/\r\n/g, '\n')  // Normalize Windows line breaks
        .replace(/\r/g, '\n')    // Normalize old Mac line breaks
        .trim();                 // Remove leading/trailing whitespace
      
      // Create a new snippet
      const newSnippet: Snippet = {
        id: `snippet-${Date.now()}`,
        text: droppedText,
        timestamp: Date.now(),
        url: window.location.href,
        platform: getPlatformFromUrl(window.location.href)
      };

      // Add to snippets list
      const currentSnippets = Array.isArray(snippets) ? snippets : [];
      setSnippets([newSnippet, ...currentSnippets]);
      
      console.log('✅ Snippet saved:', newSnippet);
    }
  }, [snippets, setSnippets]);

  // Delete a snippet
  const deleteSnippet = useCallback((id: string) => {
    const currentSnippets = Array.isArray(snippets) ? snippets : [];
    setSnippets(currentSnippets.filter((snippet: Snippet) => snippet.id !== id));
  }, [snippets, setSnippets]);

  // Clear all snippets
  const clearAllSnippets = useCallback(() => {
    if (confirm('Are you sure you want to delete all snippets?')) {
      setSnippets([]);
    }
  }, [setSnippets]);

  // Copy snippet to clipboard
  const copySnippet = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      console.log('✅ Snippet copied to clipboard');
    } catch (err) {
      console.error('Failed to copy snippet:', err);
    }
  }, []);

  // Simplified find function that uses browser search directly
  const findSnippetInPage = useCallback((snippetText: string) => {
    console.log('🔍 Searching for snippet:', snippetText.substring(0, 50) + '...');
    
    try {
      // Clear any existing selection
      window.getSelection()?.removeAllRanges();
      
      // Use a more effective search text - first line or first 50 chars
      const searchText = snippetText.split('\n')[0] || snippetText.substring(0, 50);
      console.log('🔍 Using search text:', searchText);
      
      // Execute browser's find
      const found = (window as any).find(searchText, false, false, true);
      
      if (found) {
        console.log('✅ Found text using browser search');
        
        // Use a delay to ensure the browser has updated the selection
        setTimeout(() => {
          const selection = window.getSelection();
          
          if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            
            console.log('📜 Scrolling to selection at:', 
              `top=${rect.top}, left=${rect.left}, height=${rect.height}, width=${rect.width}`);
            
            // Scroll the selection into view
            const parentNode = range.startContainer.parentElement;
            if (parentNode) {
              parentNode.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
              });
              
              // Also use window.scrollTo as a backup
              window.scrollTo({
                top: window.scrollY + rect.top - (window.innerHeight / 3),
                behavior: 'smooth'
              });
              
              console.log('📜 Scroll commands executed');
            } else {
              console.log('⚠️ Could not find parent element to scroll to');
            }
            
            // Add our custom flash highlight
            setTimeout(() => flashSelectedText(), 500);
            showFoundMessage();
          } else {
            // Try again if selection is empty
            console.log('🔍 Retrying search...');
            (window as any).find(searchText, false, false, true);
            flashSelectedText();
            showFoundMessage();
          }
        }, 300);
        
        return true;
      } else {
        console.log('❌ Snippet not found');
        showNotFoundMessage();
        return false;
      }
    } catch (error) {
      console.warn('Search failed:', error);
      showNotFoundMessage();
      return false;
    }
  }, []);

  // Flash effect for browser-found text
  const flashSelectedText = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;
    
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    
    // Create flash overlay
    const flash = document.createElement('div');
    flash.style.cssText = `
      position: fixed;
      top: ${rect.top}px;
      left: ${rect.left}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
      background: rgba(255, 215, 0, 0.5);
      border: 2px solid #FFD700;
      border-radius: 4px;
      pointer-events: none;
      z-index: 9999;
      animation: flashFound 1.5s ease-out;
    `;
    
    // Add flash animation
    if (!document.getElementById('nexusmind-flash-animation')) {
      const style = document.createElement('style');
      style.id = 'nexusmind-flash-animation';
      style.textContent = `
        @keyframes flashFound {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.05); }
          100% { opacity: 0; transform: scale(1); }
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 1500);
    
    showFoundMessage();
  }, []);

  // Show success notification
  const showFoundMessage = useCallback(() => {
    showNotification('✅ Snippet found and highlighted!', '#10B981');
  }, []);

  // Show not found notification
  const showNotFoundMessage = useCallback(() => {
    showNotification('❌ Snippet not found on current page', '#EF4444');
  }, []);

  // Generic notification system
  const showNotification = useCallback((message: string, color: string) => {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: white;
      color: ${color};
      padding: 12px 16px;
      border-radius: 6px;
      border: 1px solid ${color};
      z-index: 10001;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      animation: slideInNotification 0.3s ease;
    `;
    
    // Add animation
    if (!document.getElementById('nexusmind-notification-animation')) {
      const style = document.createElement('style');
      style.id = 'nexusmind-notification-animation';
      style.textContent = `
        @keyframes slideInNotification {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
      notification.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }, []);

  const getHighlightColor = useCallback((color: string, opacity: number) => {
    const colorMap = {
      yellow: `rgba(255, 215, 0, ${opacity})`,
      green: `rgba(50, 205, 50, ${opacity})`,
      blue: `rgba(0, 191, 255, ${opacity})`,
      red: `rgba(255, 99, 71, ${opacity})`,
      purple: `rgba(186, 85, 211, ${opacity})`,
    };
    return colorMap[color as keyof typeof colorMap] || colorMap.yellow;
  }, []);

  const deleteHighlight = useCallback((id: string) => {
    const currentHighlights = Array.isArray(highlights) ? highlights : [];
    setHighlights(currentHighlights.filter((h: Highlight) => h.id !== id));
    
    const el = document.getElementById(id);
    if (el) {
      const parent = el.parentNode;
      while (el.firstChild) {
        parent?.insertBefore(el.firstChild, el);
      }
      parent?.removeChild(el);
    }
  }, [highlights, setHighlights]);

  if (!isVisible) {
    return (
      <div className="nexusmind-side-panel-toggle" style={{
        position: 'fixed',
        top: '50%',
        right: '20px',
        zIndex: 10000,
        backgroundColor: '#4F46E5',
        color: 'white',
        border: 'none',
        borderRadius: '50%',
        width: '56px',
        height: '56px',
        cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '24px',
        transform: 'translateY(-50%)'
      }} onClick={onToggle}>
        📋
      </div>
    );
  }

  return (
    <div className="nexusmind-side-panel" style={{
      position: 'fixed',
      top: '0',
      right: '0',
      width: '400px',
      height: '100vh',
      backgroundColor: 'white',
      borderLeft: '1px solid #e5e7eb',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      boxShadow: '-4px 0 12px rgba(0, 0, 0, 0.1)',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Header */}
      <div style={{ padding: '16px', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#1f2937' }}>NexusMind</h3>
          <button onClick={onToggle} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', padding: '4px' }}>✕</button>
        </div>
        <div style={{ display: 'flex', gap: '4px', backgroundColor: '#e5e7eb', borderRadius: '6px', padding: '2px' }}>
          <button onClick={() => setActiveTab('snippets')} style={{ flex: 1, padding: '8px 12px', borderRadius: '4px', border: 'none', fontSize: '14px', fontWeight: '500', cursor: 'pointer', backgroundColor: activeTab === 'snippets' ? 'white' : 'transparent', color: activeTab === 'snippets' ? '#1f2937' : '#6b7280', boxShadow: activeTab === 'snippets' ? '0 1px 2px rgba(0, 0, 0, 0.1)' : 'none' }}>
            📝 Snippets ({Array.isArray(snippets) ? snippets.length : 0})
          </button>
          <button onClick={() => setActiveTab('highlights')} style={{ flex: 1, padding: '8px 12px', borderRadius: '4px', border: 'none', fontSize: '14px', fontWeight: '500', cursor: 'pointer', backgroundColor: activeTab === 'highlights' ? 'white' : 'transparent', color: activeTab === 'highlights' ? '#1f2937' : '#6b7280', boxShadow: activeTab === 'highlights' ? '0 1px 2px rgba(0, 0, 0, 0.1)' : 'none' }}>
            🎨 Highlights ({Array.isArray(highlights) ? highlights.length : 0})
          </button>
        </div>
      </div>

      {activeTab === 'snippets' && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
            transition: 'background-color 0.2s ease',
            backgroundColor: isDragOver ? '#f0f9ff' : 'transparent',
            border: isDragOver ? '2px dashed #3b82f6' : '2px dashed transparent',
            margin: '4px'
          }}
        >
          {/* Controls */}
          {Array.isArray(snippets) && snippets.length > 0 && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
              paddingBottom: '8px',
              borderBottom: '1px solid #f3f4f6'
            }}>
              <span style={{ fontSize: '14px', color: '#6b7280' }}>
                {snippets.length} snippet{snippets.length !== 1 ? 's' : ''}
              </span>
              <button
                onClick={clearAllSnippets}
                style={{
                  background: 'none',
                  border: '1px solid #fca5a5',
                  color: '#dc2626',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                Clear All
              </button>
            </div>
          )}

          {/* Snippets */}
          {Array.isArray(snippets) && snippets.length > 0 ? (
            snippets.map((snippet: Snippet) => (
              <div
                key={snippet.id}
                style={{
                  marginBottom: '12px',
                  padding: '12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  backgroundColor: '#ffffff'
                }}
              >
                <div style={{
                  fontSize: '14px',
                  lineHeight: '1.5',
                  color: '#374151',
                  marginBottom: '8px',
                  wordBreak: 'break-word'
                }}>
                  {snippet.text.length > 200 
                    ? snippet.text.substring(0, 200) + '...'
                    : snippet.text
                  }
                </div>
                
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '12px',
                  color: '#9ca3af'
                }}>
                  <span>
                    {snippet.platform} • {new Date(snippet.timestamp).toLocaleDateString()}
                  </span>
                  <div>
                    <button
                      onClick={() => findSnippetInPage(snippet.text)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#6b7280',
                        cursor: 'pointer',
                        marginRight: '8px',
                        fontSize: '16px'
                      }}
                      title="Find on page"
                    >
                      🔍
                    </button>
                    <button
                      onClick={() => copySnippet(snippet.text)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#6b7280',
                        cursor: 'pointer',
                        marginRight: '8px',
                        fontSize: '16px'
                      }}
                      title="Copy to clipboard"
                    >
                      📋
                    </button>
                    <button
                      onClick={() => deleteSnippet(snippet.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#ef4444',
                        cursor: 'pointer',
                        fontSize: '16px'
                      }}
                      title="Delete snippet"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div style={{
              textAlign: 'center',
              color: '#9ca3af',
              padding: '40px 20px',
              fontSize: '14px'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📝</div>
              <div style={{ fontWeight: '500', marginBottom: '8px' }}>No snippets yet</div>
              <div>
                Start by dragging text from AI responses into the drop zone above
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'highlights' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {Array.isArray(highlights) && highlights.length > 0 ? (
            highlights.map((highlight: Highlight) => (
              <div key={highlight.id} style={{ marginBottom: '12px', padding: '12px', borderRadius: '8px', backgroundColor: getHighlightColor(highlight.color, 0.15), borderLeft: `4px solid ${getHighlightColor(highlight.color, 1)}` }}>
                <div style={{ fontSize: '14px', lineHeight: '1.5', color: '#374151', marginBottom: '8px', wordBreak: 'break-word' }}>
                  {highlight.text.length > 200 ? highlight.text.substring(0, 200) + '...' : highlight.text}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#6b7280' }}>
                  <span>{highlight.color} • {new Date(highlight.timestamp).toLocaleDateString()}</span>
                  <div>
                    <button onClick={() => findSnippetInPage(highlight.text)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', marginRight: '8px', fontSize: '16px' }} title="Find highlight in page">🔍</button>
                    <button onClick={() => copySnippet(highlight.text)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', marginRight: '8px', fontSize: '16px' }} title="Copy to clipboard">📋</button>
                    <button onClick={() => deleteHighlight(highlight.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '16px' }} title="Delete highlight">🗑️</button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div style={{ textAlign: 'center', color: '#9ca3af', padding: '40px 20px', fontSize: '14px' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎨</div>
              <div style={{ fontWeight: '500', marginBottom: '8px' }}>No highlights yet</div>
              <div>Create highlights by selecting text and using the color picker or keyboard shortcuts (Alt+Shift+1-5)</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Helper function to extract platform from URL
const getPlatformFromUrl = (url: string): string => {
  if (url.includes('chatgpt.com')) return 'ChatGPT';
  if (url.includes('claude.ai')) return 'Claude';
  if (url.includes('gemini.google.com')) return 'Gemini';
  if (url.includes('deepseek.com')) return 'DeepSeek';
  if (url.includes('grok.com')) return 'Grok';
  return 'Unknown';
};

export default SidePanel;
