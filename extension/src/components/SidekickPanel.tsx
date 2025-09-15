import React from 'react';
import { useStorage } from '../hooks/useStorage';
import type { SidekickConfig } from '../types';

const defaultConfig: SidekickConfig = {
  enabled: false,
  workerAI: 'Claude',
  role: 'Critic',
  useMediator: true,
};

/**
 * A component to configure the AI Sidekick feature.
 * This will be displayed within a tab in the main SidePanel.
 * 
 * Separates the concept of:
 * - Mediator (Gemini): The "brain" that creates intelligent meta-prompts
 * - Worker AI: The AI that executes the actual analysis task
 */
const SidekickPanel: React.FC = () => {
  const [config, setConfig] = useStorage<'nexusmind-sidekick-config'>(
    'nexusmind-sidekick-config',
    defaultConfig
  );

  // Ensure we have a complete config object, even if storage is empty
  // Handle migration from old 'platform' field to new 'workerAI' field
  const currentConfig: SidekickConfig = {
    ...defaultConfig,
    ...config,
    // Migration: if old 'platform' exists but no 'workerAI', use 'platform' as 'workerAI'
    ...(config && 'platform' in config && !config.workerAI ? { workerAI: (config as any).platform } : {}),
  };

  const handleToggleEnabled = () => {
    setConfig({ ...currentConfig, enabled: !currentConfig.enabled });
  };

  const handleWorkerAIChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setConfig({ ...currentConfig, workerAI: e.target.value as SidekickConfig['workerAI'] });
  };

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setConfig({ ...currentConfig, role: e.target.value as SidekickConfig['role'] });
  };

  const handleMediatorToggle = () => {
    setConfig({ ...currentConfig, useMediator: !currentConfig.useMediator });
  };

  return (
    <div style={{ padding: '16px', fontFamily: 'system-ui, sans-serif', color: '#374151' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>AI Sidekick</h4>
        <button
          onClick={handleToggleEnabled}
          style={{
            padding: '4px',
            borderRadius: '9999px',
            width: '44px',
            backgroundColor: currentConfig.enabled ? '#34d399' : '#d1d5db',
            position: 'relative',
            display: 'inline-flex',
            border: 'none',
            cursor: 'pointer',
            transition: 'background-color 0.2s ease-in-out',
          }}
          aria-pressed={currentConfig.enabled}
          title={currentConfig.enabled ? 'Disable Sidekick' : 'Enable Sidekick'}
        >
          <span
            style={{
              display: 'inline-block',
              width: '20px',
              height: '20px',
              borderRadius: '9999px',
              backgroundColor: 'white',
              transform: currentConfig.enabled ? 'translateX(20px)' : 'translateX(0)',
              transition: 'transform 0.2s ease-in-out',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}
          />
        </button>
      </div>

      {/* Mediator Configuration */}
      <div style={{ marginBottom: '20px', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div>
            <label style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937' }}>
              🧠 AI Mediator (Intelligence)
            </label>
            <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0' }}>
              Uses Gemini to create intelligent meta-prompts
            </p>
          </div>
          <button
            onClick={handleMediatorToggle}
            disabled={!currentConfig.enabled}
            style={{
              padding: '2px',
              borderRadius: '9999px',
              width: '36px',
              backgroundColor: currentConfig.useMediator && currentConfig.enabled ? '#3b82f6' : '#d1d5db',
              position: 'relative',
              display: 'inline-flex',
              border: 'none',
              cursor: !currentConfig.enabled ? 'not-allowed' : 'pointer',
              opacity: !currentConfig.enabled ? 0.5 : 1,
              transition: 'background-color 0.2s ease-in-out',
            }}
            aria-pressed={currentConfig.useMediator}
            title={currentConfig.useMediator ? 'Disable Mediator (use basic prompts)' : 'Enable Mediator (use intelligent prompts)'}
          >
            <span
              style={{
                display: 'inline-block',
                width: '16px',
                height: '16px',
                borderRadius: '9999px',
                backgroundColor: 'white',
                transform: currentConfig.useMediator ? 'translateX(16px)' : 'translateX(0)',
                transition: 'transform 0.2s ease-in-out',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
              }}
            />
          </button>
        </div>
        <div style={{ fontSize: '11px', color: '#6b7280', marginLeft: '4px' }}>
          {currentConfig.useMediator ? 
            '✓ Smart prompts powered by Gemini Flash' : 
            '○ Basic template-based prompts'
          }
        </div>
      </div>

      {/* Worker AI Configuration */}
      <div style={{ marginBottom: '16px' }}>
        <label htmlFor="sidekick-worker" style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
          🤖 Worker AI (Executor)
        </label>
        <select
          id="sidekick-worker"
          value={currentConfig.workerAI}
          onChange={handleWorkerAIChange}
          disabled={!currentConfig.enabled}
          style={{ 
            width: '100%', 
            padding: '8px', 
            borderRadius: '6px', 
            border: '1px solid #d1d5db', 
            opacity: !currentConfig.enabled ? 0.6 : 1, 
            cursor: !currentConfig.enabled ? 'not-allowed' : 'pointer' 
          }}
        >
          <option value="Claude">Claude (Analysis & Reasoning)</option>
          <option value="ChatGPT">ChatGPT (General & Creative)</option>
          <option value="Gemini">Gemini (Research & Facts)</option>
        </select>
        <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0' }}>
          The AI that will execute the analysis task.
        </p>
      </div>

      {/* Role Configuration */}
      <div>
        <label htmlFor="sidekick-role" style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
          🎭 Analysis Role
        </label>
        <select
          id="sidekick-role"
          value={currentConfig.role}
          onChange={handleRoleChange}
          disabled={!currentConfig.enabled}
          style={{ 
            width: '100%', 
            padding: '8px', 
            borderRadius: '6px', 
            border: '1px solid #d1d5db', 
            opacity: !currentConfig.enabled ? 0.6 : 1, 
            cursor: !currentConfig.enabled ? 'not-allowed' : 'pointer' 
          }}
        >
          <option value="Critic">🔍 Critic - Find issues & improvements</option>
          <option value="Fact-Checker">✅ Fact-Checker - Verify accuracy</option>
          <option value="Alternative View">🔄 Alternative View - Different perspectives</option>
          <option value="Developer">💻 Developer - Technical analysis</option>
          <option value="Analyst">📊 Analyst - Deep insights</option>
        </select>
        <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0' }}>
          The perspective the Worker AI will adopt during analysis.
        </p>
      </div>

      {/* Architecture Explanation */}
      {currentConfig.enabled && (
        <div style={{ marginTop: '20px', padding: '12px', backgroundColor: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
          <div style={{ fontSize: '12px', color: '#1e40af', lineHeight: '1.4' }}>
            <strong>🔄 How it works:</strong>
            <div style={{ marginTop: '4px' }}>
              {currentConfig.useMediator ? (
                <>
                  1. <strong>Mediator</strong> (Gemini) creates intelligent meta-prompt<br/>
                  2. <strong>Worker AI</strong> ({currentConfig.workerAI}) performs {currentConfig.role.toLowerCase()} analysis<br/>
                  3. Results displayed alongside original response
                </>
              ) : (
                <>
                  1. <strong>Template</strong> generates basic prompt<br/>
                  2. <strong>Worker AI</strong> ({currentConfig.workerAI}) performs {currentConfig.role.toLowerCase()} analysis<br/>
                  3. Results displayed alongside original response
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SidekickPanel;
