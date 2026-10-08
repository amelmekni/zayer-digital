import { useEffect } from 'react'

const focusableSelector = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'audio[controls]',
  'video[controls]',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',')

function getFocusableElements(dialog) {
  return [...dialog.querySelectorAll(focusableSelector)].filter((element) =>
    !element.hasAttribute('hidden')
    && element.getAttribute('aria-hidden') !== 'true'
    && element.getClientRects().length > 0,
  )
}

function makeBackgroundInert(dialog) {
  const changedElements = []
  let branch = dialog

  while (branch?.parentElement) {
    const parent = branch.parentElement

    for (const sibling of parent.children) {
      if (sibling === branch) continue

      changedElements.push({
        element: sibling,
        inert: sibling.inert,
        ariaHidden: sibling.getAttribute('aria-hidden'),
      })
      sibling.inert = true
      sibling.setAttribute('aria-hidden', 'true')
    }

    if (parent === document.body) break
    branch = parent
  }

  return () => {
    for (const { element, inert, ariaHidden } of changedElements.reverse()) {
      element.inert = inert
      if (ariaHidden === null) element.removeAttribute('aria-hidden')
      else element.setAttribute('aria-hidden', ariaHidden)
    }
  }
}

export default function useFocusTrap(dialogRef, active) {
  useEffect(() => {
    const dialog = dialogRef.current
    if (!active || !dialog) return undefined

    const opener = document.activeElement
    const restoreBackground = makeBackgroundInert(dialog)
    const focusableElements = getFocusableElements(dialog)
    const initialFocus = focusableElements[0] || dialog
    initialFocus.focus()

    const onKeyDown = (event) => {
      if (event.key !== 'Tab') return

      const elements = getFocusableElements(dialog)
      if (elements.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }

      const first = elements[0]
      const last = elements[elements.length - 1]
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    const onFocusIn = (event) => {
      if (!dialog.contains(event.target)) {
        const firstFocusable = getFocusableElements(dialog)[0] || dialog
        firstFocusable.focus()
      }
    }

    dialog.addEventListener('keydown', onKeyDown)
    document.addEventListener('focusin', onFocusIn)

    return () => {
      dialog.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('focusin', onFocusIn)
      restoreBackground()
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
    }
  }, [active, dialogRef])
}
