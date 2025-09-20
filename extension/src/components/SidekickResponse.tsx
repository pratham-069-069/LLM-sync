import React from 'react';
import { getPlatformName } from '../content-scripts/dom_utils';

interface SidekickResponseProps {
  analysis: {
    role: string;
    content: string;
  };
  error?: string;
  onRetry?: () => void;
}

const SidekickResponse: React.FC<SidekickResponseProps> = ({ analysis, error, onRetry }) => {
  const platform = getPlatformName();
  const isGrok = platform === 'Grok';
  
  const getRoleStyle = (role: string) => {
    const baseStyles = {
      'Critic': { borderColor: '#F87171', backgroundColor: '#FEF2F2' },
      'Fact-Checker': { borderColor: '#60A5FA', backgroundColor: '#EFF6FF' },
      'Alternative View': { borderColor: '#A78BFA', backgroundColor: '#F5F3FF' },
      'Developer': { borderColor: '#10B981', backgroundColor: '#F0FDF4' },
      'Analyst': { borderColor: '#F59E0B', backgroundColor: '#FFFBEB' },
      'default': { borderColor: '#9CA3AF', backgroundColor: '#F3F4F6' }
    };
    
    const baseStyle = baseStyles[role as keyof typeof baseStyles] || baseStyles.default;
    
    // Adjust for Grok's dark theme
    if (isGrok) {
      return {
        borderColor: baseStyle.borderColor,
        backgroundColor: 'rgba(30, 30, 30, 0.8)',
        textColor: '#E5E7EB'
      };
    }
    
    return {
      ...baseStyle,
      textColor: '#1F2937'
    };
  };

  // Handle error display
  if (error) {
    const errorColors = {
      border: isGrok ? '#F87171' : '#EF4444',
      background: isGrok ? 'rgba(220, 38, 38, 0.2)' : '#FEF2F2',
      text: isGrok ? '#E5E7EB' : '#1F2937',
      title: isGrok ? '#F87171' : '#DC2626',
      button: isGrok ? '#B91C1C' : '#DC2626',
      buttonHover: isGrok ? '#991B1B' : '#B91C1C'
    };

    return (
      <div
        className="nexusmind-sidekick-container nexusmind-error"
        style={{
          border: `1px solid ${errorColors.border}`,
          backgroundColor: errorColors.background,
          borderRadius: '8px',
          padding: '12px',
          marginTop: '16px',
          fontFamily: 'system-ui, sans-serif',
          fontSize: '14px',
          lineHeight: '1.6',
          color: errorColors.text,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
        }}
      >
        <h4
          style={{
            margin: '0 0 8px 0',
            color: errorColors.title,
            fontSize: '12px',
            fontWeight: '600',
            textTransform: 'uppercase',
          }}
        >
          ❌ Sidekick Error
        </h4>
        <p style={{ margin: '0 0 12px 0' }}>{error}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              backgroundColor: errorColors.button,
              color: 'white',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '500',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = errorColors.buttonHover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = errorColors.button;
            }}
          >
            🔄 Retry Analysis
          </button>
        )}
      </div>
    );
  }

  const style = getRoleStyle(analysis.role);

  // Handle empty or missing content
  const content = analysis.content || 'No analysis available';
  const role = analysis.role || 'Assistant';

  return (
    <div
      className="nexusmind-sidekick-container"
      style={{
        border: `1px solid ${style.borderColor}`,
        backgroundColor: style.backgroundColor,
        borderRadius: '8px',
        padding: '12px',
        marginTop: '16px',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        lineHeight: '1.6',
        color: style.textColor,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
      }}
    >
      <h4
        style={{
          margin: '0 0 8px 0',
          color: style.borderColor,
          fontSize: '12px',
          fontWeight: '600',
          textTransform: 'uppercase',
        }}
      >
        🤖 {role} Analysis
      </h4>
      <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{content}</p>
    </div>
  );
};

export default SidekickResponse;
