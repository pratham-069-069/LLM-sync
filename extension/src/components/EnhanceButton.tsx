import React from 'react';

interface EnhanceButtonProps {
  onClick: () => void;
  isLoading: boolean;
}

const EnhanceButton: React.FC<EnhanceButtonProps> = ({ onClick, isLoading }) => {
  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      style={{
        backgroundColor: isLoading ? '#9CA3AF' : '#8B5CF6',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        padding: '8px 12px',
        fontSize: '13px',
        fontWeight: '500',
        cursor: isLoading ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        transition: 'background-color 0.2s ease',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
        opacity: isLoading ? 0.7 : 1,
      }}
      onMouseEnter={(e) => {
        if (!isLoading) {
          e.currentTarget.style.backgroundColor = '#7C3AED';
        }
      }}
      onMouseLeave={(e) => {
        if (!isLoading) {
          e.currentTarget.style.backgroundColor = '#8B5CF6';
        }
      }}
    >
      {isLoading ? (
        <>
          <div
            style={{
              width: '12px',
              height: '12px',
              border: '2px solid transparent',
              borderTop: '2px solid white',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
          Enhancing...
        </>
      ) : (
        <>
          ✨ Enhance
        </>
      )}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </button>
  );
};

export default EnhanceButton;
