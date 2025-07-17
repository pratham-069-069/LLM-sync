// extension/src/options/main.tsx
// import React from 'react'
import { createRoot } from 'react-dom/client'

/**
 * A simple placeholder Options UI.
 * You’ll expand this with form fields for slash-commands, hotkeys, etc.
 */
function OptionsApp() {
  return (
    <div className="p-4 font-sans">
      <h1 className="text-2xl font-bold mb-2">LLM Sync Settings</h1>
      <p className="mb-4 text-gray-600">
        Configure your extension options below.
      </p>
      {/* TODO: Add inputs for custom slash commands, hotkeys, and premium toggles */}
      <div className="space-y-2">
        <label className="block">
          <span className="font-medium">Example Setting</span>
          <input
            type="text"
            placeholder="Value"
            className="mt-1 block w-full border rounded p-2"
          />
        </label>
      </div>
    </div>
  )
}

// Find the <div id="root"> in options/index.html and render into it
const container = document.getElementById('root')
if (container) {
  createRoot(container).render(<OptionsApp />)
}
