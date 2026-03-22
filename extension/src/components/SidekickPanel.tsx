import React, { useState } from 'react';
import { useStorage } from '../hooks/useStorage';
import type { SidekickConfig } from '../types';
import MediatorService from '../services/MediatorService';

const defaultConfig: SidekickConfig = {
  enabled: false,
  workerAI: 'Claude',
  customPrompt: 'Analyze this response and provide critical feedback on accuracy, completeness, and potential improvements.',
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

  const [groupChatPrompt, setGroupChatPrompt] = useState('');
  const [gcSelectedPlatforms, setGcSelectedPlatforms] = useState<string[]>([]);
  const [gcIterations, setGcIterations] = useState(1);
  const [isGroupChatting, setIsGroupChatting] = useState(false);
  const [gcLog, setGcLog] = useState<{platform: string, text: string}[]>([]);
  const [gcConclusion, setGcConclusion] = useState('');

  const handleTogglePlatform = (platform: string) => {
    setGcSelectedPlatforms(prev => 
      prev.includes(platform) ? prev.filter(p => p !== platform) : [...prev, platform]
    );
  };

  const runGroupChat = async () => {
    if (!groupChatPrompt.trim() || gcSelectedPlatforms.length === 0 || gcIterations < 1) return;
    
    setIsGroupChatting(true);
    setGcLog([]);
    setGcConclusion('');
    
    let currentLog: {platform: string, text: string}[] = [];
    
    // Check available platforms first
    const availableResp = await new Promise<any>((resolve) => chrome.runtime.sendMessage({ type: 'GET_AVAILABLE_PLATFORMS' }, resolve));
    const availableNames = availableResp?.platforms?.map((p: any) => p.platform.toLowerCase()) || [];
    
    // Validate selected platforms
    for (const p of gcSelectedPlatforms) {
      if (!availableNames.includes(p.toLowerCase())) {
        alert(`Platform ${p} is not open in a tab.`);
        setIsGroupChatting(false);
        return;
      }
    }
    
    try {
      for (let i = 0; i < gcIterations; i++) {
        for (const platform of gcSelectedPlatforms) {
          let promptToSend = '';
          if (currentLog.length === 0) {
            promptToSend = `User asked: "${groupChatPrompt}". Please start the discussion.`;
          } else {
            const transcript = currentLog.map(l => `${l.platform}: ${l.text}`).join('\n\n');
            promptToSend = `User originally asked: "${groupChatPrompt}".\n\nHere is the discussion so far:\n${transcript}\n\nPlease add your perspective or continue the discussion.`;
          }
          
          const response = await new Promise<any>((resolve) => {
            chrome.runtime.sendMessage({
              type: 'EXECUTE_SIDEKICK_TASK',
              platform: platform,
              prompt: promptToSend,
              taskId: `groupchat_${Date.now()}`
            }, resolve);
          });
          
          if (response && response.success) {
            const entry = { platform, text: response.analysis };
            currentLog = [...currentLog, entry];
            setGcLog(currentLog);
          } else {
            throw new Error(`Failed to get response from ${platform}: ${response?.error}`);
          }
        }
      }
      
      // Get conclusion from Gemini
      const transcriptStr = currentLog.map(l => `${l.platform}: ${l.text}`).join('\n\n');
      const conclusionResult = await MediatorService.generateGroupChatConclusion(groupChatPrompt, transcriptStr);
      
      if (conclusionResult.success && conclusionResult.result) {
        setGcConclusion(conclusionResult.result);
      } else {
        setGcConclusion(`Error generating conclusion: ${conclusionResult.error}`);
      }
      
    } catch (error) {
       console.error("Group chat error:", error);
       alert("Error during group chat: " + error);
    } finally {
      setIsGroupChatting(false);
    }
  };

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

  const handleCustomPromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setConfig({ ...currentConfig, customPrompt: e.target.value });
  };

  const handleMediatorToggle = () => {
    setConfig({ ...currentConfig, useMediator: !currentConfig.useMediator });
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px', fontFamily: 'system-ui, sans-serif', color: '#374151' }}>
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

      {/* Custom Prompt Configuration */}
      <div>
        <label htmlFor="sidekick-prompt" style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
          📝 Custom Analysis Prompt
        </label>
        <textarea
          id="sidekick-prompt"
          value={currentConfig.customPrompt}
          onChange={handleCustomPromptChange}
          disabled={!currentConfig.enabled}
          placeholder="Describe what kind of analysis you want the AI to perform..."
          rows={4}
          style={{ 
            width: '100%', 
            padding: '8px', 
            borderRadius: '6px', 
            border: '1px solid #d1d5db',
            fontSize: '13px',
            fontFamily: 'system-ui, sans-serif',
            resize: 'vertical',
            minHeight: '80px',
            opacity: !currentConfig.enabled ? 0.6 : 1, 
            cursor: !currentConfig.enabled ? 'not-allowed' : 'text',
            backgroundColor: !currentConfig.enabled ? '#f9fafb' : 'white'
          }}
        />
        <p style={{ fontSize: '12px', color: '#6b7280', margin: '4px 0 0' }}>
          Describe the analysis you want the Worker AI to perform on each response.
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
                  1. <strong>Mediator</strong> (Gemini) optimizes your custom prompt with conversation context<br/>
                  2. <strong>Worker AI</strong> ({currentConfig.workerAI}) executes the mediated analysis<br/>
                  3. Results displayed alongside original response
                </>
              ) : (
                <>
                  1. Your <strong>custom prompt</strong> is sent directly to the Worker AI<br/>
                  2. <strong>Worker AI</strong> ({currentConfig.workerAI}) performs the requested analysis<br/>
                  3. Results displayed alongside original response
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- NEW: Group Chat Feature --- */}
      <hr style={{ margin: '24px 0', borderColor: '#e5e7eb' }} />
      <div style={{ marginBottom: '16px' }}>
        <h4 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600' }}>🗣️ LLM Group Chat</h4>
        <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 12px 0' }}>
          Start a multi-turn discussion between selected AIs, followed by a final conclusion from Gemini.
        </p>
        
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>Topic / Prompt</label>
          <textarea
            value={groupChatPrompt}
            onChange={(e) => setGroupChatPrompt(e.target.value)}
            placeholder="e.g., What are the ethical implications of AGI?"
            rows={3}
            style={{ 
              width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db',
              fontSize: '13px', fontFamily: 'system-ui, sans-serif', resize: 'vertical'
            }}
            disabled={isGroupChatting}
          />
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>Select Participants</label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {['ChatGPT', 'Claude', 'Grok'].map(p => (
              <button
                key={p}
                onClick={() => handleTogglePlatform(p)}
                disabled={isGroupChatting}
                style={{
                  padding: '6px 12px',
                  borderRadius: '16px',
                  fontSize: '12px',
                  fontWeight: '500',
                  border: gcSelectedPlatforms.includes(p) ? '2px solid #3b82f6' : '1px solid #d1d5db',
                  backgroundColor: gcSelectedPlatforms.includes(p) ? '#eff6ff' : '#ffffff',
                  color: gcSelectedPlatforms.includes(p) ? '#1d4ed8' : '#374151',
                  cursor: isGroupChatting ? 'not-allowed' : 'pointer'
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>Iterations ({gcIterations})</label>
          <input 
            type="range" 
            min="1" max="5" 
            value={gcIterations}
            onChange={(e) => setGcIterations(parseInt(e.target.value))}
            disabled={isGroupChatting}
            style={{ width: '100%' }}
          />
        </div>

        <button
          onClick={runGroupChat}
          disabled={isGroupChatting || !groupChatPrompt.trim() || gcSelectedPlatforms.length === 0}
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: isGroupChatting || !groupChatPrompt.trim() || gcSelectedPlatforms.length === 0 ? '#9ca3af' : '#8b5cf6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontWeight: '600',
            cursor: isGroupChatting || !groupChatPrompt.trim() || gcSelectedPlatforms.length === 0 ? 'not-allowed' : 'pointer'
          }}
        >
          {isGroupChatting ? 'Discussion in progress...' : 'Start Group Chat'}
        </button>

        {/* Display Log */}
        {gcLog.length > 0 && (
          <div style={{ marginTop: '16px', maxHeight: '300px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px', backgroundColor: '#f9fafb' }}>
            <h5 style={{ margin: '0 0 8px 0', fontSize: '13px' }}>Discussion Log:</h5>
            {gcLog.map((log, idx) => (
              <div key={idx} style={{ marginBottom: '8px', fontSize: '12px' }}>
                <strong style={{ color: '#4f46e5' }}>{log.platform}:</strong>
                <div style={{ whiteSpace: 'pre-wrap', marginTop: '2px', color: '#374151' }}>{log.text}</div>
              </div>
            ))}
          </div>
        )}

        {/* Display Conclusion */}
        {gcConclusion && (
          <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#ecfdf5', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
            <h5 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#065f46' }}>✨ Gemini Conclusion</h5>
            <div style={{ fontSize: '13px', color: '#064e3b', whiteSpace: 'pre-wrap' }}>
              {gcConclusion}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SidekickPanel;
