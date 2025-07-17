// extension/src/content-scripts/shared.ts
console.log('🧩 ChatGPT-specific content script loaded on', location.href)

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== 'INJECT_PROMPT') return
  console.log('🧩 Injecting prompt into ChatGPT:', msg.prompt)

  const waitForElement = (selector: string, timeout = 10000) =>
    new Promise<HTMLElement>((resolve, reject) => {
      const el = document.querySelector<HTMLElement>(selector)
      if (el) return resolve(el)
      const obs = new MutationObserver(() => {
        const found = document.querySelector<HTMLElement>(selector)
        if (found) {
          obs.disconnect()
          resolve(found)
        }
      })
      obs.observe(document.body, { childList: true, subtree: true })
      setTimeout(() => {
        obs.disconnect()
        reject(new Error(`Element ${selector} not found within ${timeout}ms`))
      }, timeout)
    })

  const waitForButtonEnabled = (btn: HTMLElement, timeout = 5000) =>
    new Promise<HTMLElement>((resolve, reject) => {
      const check = () => {
        const disabled = btn.hasAttribute('disabled')
        const ariaDisabled = btn.getAttribute('aria-disabled') === 'true'
        if (!disabled && !ariaDisabled) {
          resolve(btn)
          return true
        }
        return false
      }
      if (check()) return
      const obs = new MutationObserver(() => {
        if (check()) obs.disconnect()
      })
      obs.observe(btn, { attributes: true, attributeFilter: ['disabled', 'aria-disabled'] })
      setTimeout(() => {
        obs.disconnect()
        reject(new Error('Send button not enabled in time'))
      }, timeout)
    })

  const injectAndSend = async () => {
    try {
      console.log('🧩 Step 1: Waiting for composer form…')
      const form = await waitForElement('form[data-type="unified-composer"]')
      console.log('✅ Found composer form')

      // ---------- UPDATED INPUT-SELECTION ----------
      console.log('🧩 Step 2: Locating text input…')
      let inputField =
        form.querySelector<HTMLTextAreaElement>('textarea') as HTMLElement | null

      if (!inputField) {
        inputField = form.querySelector<HTMLElement>(
          'div[role="textbox"][contenteditable="true"]'
        )
      }

      if (!inputField) {
        throw new Error('Textbox not found inside composer form')
      }
      console.log('✅ Found textbox:', inputField)

      inputField.focus()
      inputField.innerText = ''
      console.log('🧩 Step 3: Inserting prompt…')
      inputField.innerText = msg.prompt
      inputField.dispatchEvent(
        new InputEvent('input', { bubbles: true, inputType: 'insertText', data: msg.prompt })
      )

      console.log('🧩 Step 4: Waiting for UI update…')
      await new Promise((r) => setTimeout(r, 300))

      console.log('🧩 Step 5: Locating send button…')
      const sendButton = form.querySelector<HTMLButtonElement>(
        '#composer-submit-button, button[data-testid="send-button"]'
      )
      if (!sendButton) throw new Error('Send button not found in composer form')
      console.log('✅ Found send button:', sendButton)

      console.log('🧩 Step 6: Waiting for button to enable…')
      await waitForButtonEnabled(sendButton)
      console.log('✅ Send button is enabled')

      console.log('🧩 Step 7: Clicking send button…')
      sendButton.click()

      setTimeout(() => {
        const leftover = inputField!.innerText.trim()
        if (!leftover) {
          console.log('✅ Message sent (input cleared)')
        } else {
          console.warn('⚠️ Input not cleared; send may have failed')
        }
      }, 1000)
    } catch (err) {
      console.error('❌ Error during injectAndSend:', err)
      console.log('🧩 Fallback: dispatching Enter key…')
      const fallbackField = document.querySelector<HTMLElement>(
        'textarea, div[role="textbox"][contenteditable="true"]'
      )
      if (fallbackField) {
        fallbackField.focus()
        fallbackField.dispatchEvent(
          new KeyboardEvent('keydown', {
            bubbles: true,
            cancelable: true,
            key: 'Enter',
            code: 'Enter',
            which: 13,
            keyCode: 13,
          })
        )
      }
    }
  }

  injectAndSend()
})
