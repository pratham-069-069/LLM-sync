// Environment variables are injected at build time by Vite
declare const __OPENROUTER_API_KEY__: string | undefined;
declare const __EXTENSION_VERSION__: string | undefined;
declare const __DEBUG_MODE__: string | undefined;

// This API key is loaded from environment variables at build time
export const OPENROUTER_API_KEY: string = __OPENROUTER_API_KEY__ || 'sk-or-v1-missing-key';

// Extension configuration
export const EXTENSION_VERSION: string = __EXTENSION_VERSION__ || '1.0.0';
export const DEBUG_MODE: boolean = __DEBUG_MODE__ === 'true';

// Log configuration if in debug mode
if (DEBUG_MODE) {
  console.log(`[NexusMind] Version: ${EXTENSION_VERSION}`);
  console.log(`[NexusMind] API Key loaded: ${OPENROUTER_API_KEY ? 'Yes' : 'No'}`);
}
