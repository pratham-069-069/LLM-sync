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



  const injectAndSend = async () => {
    try {
      console.log('🧩 Step 1: Waiting for composer form…')
      const form = await waitForElement('form[data-type="unified-composer"]')
      console.log('✅ Found composer form')

      console.log('🧩 Step 2: Locating text input…')
      let inputField: HTMLElement | null = null
      
      // First try to find the visible contenteditable div (preferred)
      inputField = form.querySelector<HTMLElement>(
        'div[role="textbox"][contenteditable="true"]'
      )
      
      // If not found, try textarea but make sure it's visible
      if (!inputField) {
        const textareas = form.querySelectorAll<HTMLTextAreaElement>('textarea')
        for (const textarea of textareas) {
          const style = window.getComputedStyle(textarea)
          if (style.display !== 'none' && style.visibility !== 'hidden') {
            inputField = textarea
            break
          }
        }
      }

      if (!inputField) {
        throw new Error('Visible textbox not found inside composer form')
      }
      console.log('✅ Found textbox:', inputField)

      // FIXED: Properly set the text content in the visible input
      inputField.focus()
      
      if (inputField.tagName === 'TEXTAREA') {
        // For textarea elements
        (inputField as HTMLTextAreaElement).value = msg.prompt
        inputField.dispatchEvent(new Event('input', { bubbles: true }))
        inputField.dispatchEvent(new Event('change', { bubbles: true }))
      } else {
        // For contenteditable div elements (more common in modern ChatGPT)
        inputField.textContent = msg.prompt
        inputField.dispatchEvent(new InputEvent('input', { 
          bubbles: true, 
          inputType: 'insertText', 
          data: msg.prompt 
        }))
        // Also trigger keyup event to ensure ChatGPT detects the change
        inputField.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }))
      }

      console.log('🧩 Step 3: Text inserted, waiting for send button to appear…')
      
      // Wait for the send button to be created by ChatGPT's UI
      const waitForSendButton = async (timeout = 5000) => {
        const sendButtonSelectors = [
          'button[data-testid="send-button"]',
          '#composer-submit-button',
          'button[type="submit"]',
          'form[data-type="unified-composer"] button:not([disabled])',
          'button[aria-label*="Send"]',
          'button svg[data-icon="send"]'
        ]

        return new Promise<HTMLButtonElement>((resolve, reject) => {
          const checkForButton = () => {
            for (const selector of sendButtonSelectors) {
              const btn = form.querySelector<HTMLButtonElement>(selector)
              if (btn && !btn.disabled && !btn.hasAttribute('aria-disabled')) {
                console.log('✅ Found send button with selector:', selector)
                resolve(btn)
                return true
              }
            }
            return false
          }

          // Check immediately
          if (checkForButton()) return

          // Watch for button to appear
          const observer = new MutationObserver(() => {
            if (checkForButton()) {
              observer.disconnect()
            }
          })
          
          observer.observe(form, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['disabled', 'aria-disabled']
          })

          setTimeout(() => {
            observer.disconnect()
            reject(new Error('Send button did not appear within timeout'))
          }, timeout)
        })
      }

      let sendButton: HTMLButtonElement
      try {
        sendButton = await waitForSendButton()
        console.log('✅ Send button appeared!')
      } catch (err) {
        console.log('⚠️ Send button never appeared, trying Enter key fallback')
        // Fallback: press Enter key
        inputField.dispatchEvent(new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13
        }))
        return
      }

      console.log('🧩 Step 4: Clicking send button…')
      sendButton.click()

      // Check if message was sent
      setTimeout(() => {
        let currentText = ''
        if (inputField.tagName === 'TEXTAREA') {
          currentText = (inputField as HTMLTextAreaElement).value
        } else {
          currentText = inputField.textContent || ''
        }
        
        if (currentText.trim() === '') {
          console.log('✅ Message sent successfully (input cleared)')
        } else {
          console.warn('⚠️ Input not cleared; send may have failed. Current text:', currentText)
        }
      }, 1000)

    } catch (err) {
      console.error('❌ Error during injectAndSend:', err)
      console.log('🧩 Fallback: trying alternative method…')
      
      // Alternative fallback method
      const fallbackField = document.querySelector<HTMLElement>(
        'textarea, div[role="textbox"][contenteditable="true"]'
      )
      
      if (fallbackField) {
        fallbackField.focus()
        
        // Set text content
        if (fallbackField.tagName === 'TEXTAREA') {
          (fallbackField as HTMLTextAreaElement).value = msg.prompt
        } else {
          fallbackField.textContent = msg.prompt
        }
        
        // Trigger events
        fallbackField.dispatchEvent(new Event('input', { bubbles: true }))
        
        // Wait a bit then press Enter
        setTimeout(() => {
          fallbackField.dispatchEvent(new KeyboardEvent('keydown', {
            bubbles: true,
            cancelable: true,
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13
          }))
        }, 300)
      }
    }
  }

  injectAndSend()
})