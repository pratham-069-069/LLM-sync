import React from 'react';

interface SidekickResponseProps {
  analysis: {
    role: string;
    content: string;
  };
}

const SidekickResponse: React.FC<SidekickResponseProps> = ({ analysis }) => {
  const getRoleStyle = (role: string) => {
    switch (role) {
      case 'Critic':
        return { borderColor: '#F87171', backgroundColor: '#FEF2F2' };
      case 'Fact-Checker':
        return { borderColor: '#60A5FA', backgroundColor: '#EFF6FF' };
      case 'Alternative View':
        return { borderColor: '#A78BFA', backgroundColor: '#F5F3FF' };
      case 'Developer':
        return { borderColor: '#10B981', backgroundColor: '#F0FDF4' };
      case 'Analyst':
        return { borderColor: '#F59E0B', backgroundColor: '#FFFBEB' };
      default:
        return { borderColor: '#9CA3AF', backgroundColor: '#F3F4F6' };
    }
  };

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
        color: '#1F2937',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
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
