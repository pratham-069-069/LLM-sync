import React from 'react';
import { useStorage } from '../hooks/useStorage';
import type { SidekickConfig } from '../types';

const defaultConfig: SidekickConfig = {
  enabled: false,
  platform: 'Claude',
  role: 'Critic',
};

/**
 * A component to configure the AI Sidekick feature.
 * This will be displayed within a tab in the main SidePanel.
 */
const SidekickPanel: React.FC = () => {
  const [config, setConfig] = useStorage<'nexusmind-sidekick-config'>(
    'nexusmind-sidekick-config',
    defaultConfig
  );

  // Ensure we have a complete config object, even if storage is empty
  const currentConfig = { ...defaultConfig, ...config };

  const handleToggleEnabled = () => {
    setConfig({ ...currentConfig, enabled: !currentConfig.enabled });
  };

  const handlePlatformChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setConfig({ ...currentConfig, platform: e.target.value as SidekickConfig['platform'] });
  };

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setConfig({ ...currentConfig, role: e.target.value as SidekickConfig['role'] });
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

      <div style={{ marginBottom: '16px' }}>
        <label htmlFor="sidekick-platform" style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
          Sidekick AI
        </label>
        <select
          id="sidekick-platform"
          value={currentConfig.platform}
          onChange={handlePlatformChange}
          disabled={!currentConfig.enabled}
          style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', opacity: !currentConfig.enabled ? 0.6 : 1, cursor: !currentConfig.enabled ? 'not-allowed' : 'pointer' }}
        >
          <option value="Claude">Claude</option>
          <option value="Gemini">Gemini</option>
          <option value="ChatGPT">ChatGPT</option>
        </select>
        <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0' }}>The AI that will analyze the primary response.</p>
      </div>

      <div>
        <label htmlFor="sidekick-role" style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
          Sidekick Role
        </label>
        <select
          id="sidekick-role"
          value={currentConfig.role}
          onChange={handleRoleChange}
          disabled={!currentConfig.enabled}
          style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', opacity: !currentConfig.enabled ? 0.6 : 1, cursor: !currentConfig.enabled ? 'not-allowed' : 'pointer' }}
        >
          <option value="Critic">Critic</option>
          <option value="Fact-Checker">Fact-Checker</option>
          <option value="Alternative View">Alternative View</option>
        </select>
        <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0' }}>The perspective the Sidekick will adopt.</p>
      </div>
    </div>
  );
};

export default SidekickPanel;
