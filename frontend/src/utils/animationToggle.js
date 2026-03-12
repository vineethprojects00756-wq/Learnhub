// Utility to enable/disable hover/motion effects across the app.
export function disableHoverEffects() {
  if (typeof document !== 'undefined') {
    document.body.setAttribute('data-hover-effects', 'off');
  }
}

export function enableHoverEffects() {
  if (typeof document !== 'undefined') {
    document.body.setAttribute('data-hover-effects', 'on');
  }
}

export function toggleHoverEffects() {
  if (typeof document !== 'undefined') {
    const cur = document.body.getAttribute('data-hover-effects');
    if (cur === 'off') enableHoverEffects();
    else disableHoverEffects();
  }
}

export function hoverEffectsEnabled() {
  if (typeof document === 'undefined') return false;
  return document.body.getAttribute('data-hover-effects') !== 'off';
}

// disable by default (importing this module will not auto-trigger change - do it explicitly)
// call disableHoverEffects() from main entry to set default.
