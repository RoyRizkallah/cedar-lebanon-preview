let sequence = 0;
const stack = [];
let previousOverflow = '';

// Shared focus and scroll behavior for forms, drawers and workspace search.
export function dialogFocus(node, options) {
  let settings = options;
  const trigger = document.activeElement;
  const heading = node.querySelector('h2');
  node.setAttribute('role', 'dialog');
  node.setAttribute('aria-modal', 'true');
  node.setAttribute('tabindex', '-1');
  if (heading && !node.hasAttribute('aria-label')) {
    heading.id ||= `cedar-dialog-${++sequence}`;
    node.setAttribute('aria-labelledby', heading.id);
  }
  if (!stack.length) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  stack.push(node);
  const focusable = () => [...node.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]')].filter(el => el.getClientRects().length && !el.closest('[hidden]'));
  const frame = requestAnimationFrame(() => (node.querySelector('[data-autofocus], input:not([disabled]), textarea:not([disabled]), select:not([disabled])') || focusable()[0] || node).focus());
  function keydown(event) {
    if (stack.at(-1) !== node) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); settings?.onClose?.(); }
    if (event.key !== 'Tab') return;
    const items = focusable();
    if (!items.length) { event.preventDefault(); node.focus(); return; }
    if (event.shiftKey && (document.activeElement === items[0] || !node.contains(document.activeElement))) { event.preventDefault(); items.at(-1).focus(); }
    else if (!event.shiftKey && (document.activeElement === items.at(-1) || !node.contains(document.activeElement))) { event.preventDefault(); items[0].focus(); }
  }
  document.addEventListener('keydown', keydown, true);
  return {
    update(value) { settings = value; },
    destroy() {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', keydown, true);
      const index = stack.indexOf(node);
      if (index >= 0) stack.splice(index, 1);
      if (!stack.length) document.body.style.overflow = previousOverflow;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    }
  };
}

export function navigationFocus(node, initial) {
  let dialog;
  function update(settings) {
    if (settings.compact && settings.open) {
      node.removeAttribute('inert');
      if (!dialog) dialog = dialogFocus(node, { onClose: settings.onClose });
      else dialog.update({ onClose: settings.onClose });
    } else {
      if (dialog) {
        dialog.destroy();
        dialog = null;
        node.removeAttribute('role');
        node.removeAttribute('aria-modal');
        node.removeAttribute('tabindex');
      }
      node.toggleAttribute('inert', settings.compact && !settings.open);
    }
  }
  update(initial);
  return { update, destroy() { dialog?.destroy(); } };
}
