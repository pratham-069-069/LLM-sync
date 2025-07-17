// extension/src/content-scripts/shared.ts
console.log('🧩 LLM Sync content script loaded on', location.href)

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== 'INJECT_PROMPT') return
  console.log('🧩 Injecting prompt into page:', msg.prompt)

  // 1) Find the input field
  const textarea = document.querySelector<HTMLTextAreaElement>('textarea')
  const cedit = document.querySelector<HTMLDivElement>(
    'div[role="textbox"][contenteditable="true"]'
  )
  const inputEl = (textarea as any) || cedit
  if (!inputEl) {
    console.error('❌ ChatGPT input field not found')
    return
  }

  // 2) Insert text & dispatch input
  if (textarea && inputEl instanceof HTMLTextAreaElement) {
    inputEl.value = msg.prompt
    inputEl.dispatchEvent(new Event('input', { bubbles: true }))
  } else {
    inputEl.innerText = msg.prompt
    inputEl.dispatchEvent(new InputEvent('input', { bubbles: true }))
  }

  // 3) Poll for the real send control
  let attempts = 0
  const maxAttempts = 30  // ~3 seconds
  const interval = 100

  const trySend = () => {
    attempts++
    // Try common button selectors
    const candidates: (string | HTMLElement)[] = [
      'button[data-testid="send-button"]',
      'button[aria-label="Send message"]',
      'button[aria-label="Send"]',
      // Sometimes it's a div with role=button:
      'div[role="button"][aria-label="Send message"]',
      'div[role="button"][aria-label="Send"]',
      // Or an SVG icon wrapped by a clickable parent:
      Array.from(document.querySelectorAll('svg[aria-label="Send"]')).map(svg =>
        svg.closest<HTMLElement>('button,div[role="button"]')
      ).filter((el): el is HTMLElement => !!el)
    ].flat()

    for (const sel of candidates) {
      let btn: HTMLElement | null = null
      if (typeof sel === 'string') btn = document.querySelector<HTMLElement>(sel)
      else btn = sel
      if (btn) {
        console.log('🧩 Clicking send control', btn)
        btn.click()
        return
      }
    }

    if (attempts < maxAttempts) {
      setTimeout(trySend, interval)
    } else {
      console.warn('⚠️ Send control never appeared—falling back to Enter')
      inputEl.focus()
      ;['keydown','keypress','keyup'].forEach(type => 
        inputEl.dispatchEvent(new KeyboardEvent(type, {
          bubbles:true,cancelable:true,key:'Enter',code:'Enter',which:13,keyCode:13
        }))
      )
    }
  }

  // start polling
  setTimeout(trySend, interval)
})
