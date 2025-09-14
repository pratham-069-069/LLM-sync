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
      default:
        return { borderColor: '#9CA3AF', backgroundColor: '#F3F4F6' };
    }
  };

  const style = getRoleStyle(analysis.role);

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
        🤖 {analysis.role} Analysis
      </h4>
      <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{analysis.content}</p>
    </div>
  );
};

export default SidekickResponse;
