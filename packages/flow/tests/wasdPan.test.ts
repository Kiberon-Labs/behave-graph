import { describe, it, expect } from 'vitest';
import { isEventFromEditable } from '../src/hooks/useWasdPan.js';

const keydownOn = (element: HTMLElement): KeyboardEvent => {
  document.body.appendChild(element);
  let captured: KeyboardEvent | undefined;
  element.addEventListener('keydown', (e) => {
    captured = e;
  });
  element.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'w', bubbles: true })
  );
  element.remove();
  if (!captured) throw new Error('keydown was not captured');
  return captured;
};

describe('WASD pan editable guard', () => {
  it('treats form fields as editable (no pan)', () => {
    expect(
      isEventFromEditable(keydownOn(document.createElement('input')))
    ).toBe(true);
    expect(
      isEventFromEditable(keydownOn(document.createElement('textarea')))
    ).toBe(true);
    expect(
      isEventFromEditable(keydownOn(document.createElement('select')))
    ).toBe(true);
  });

  it('treats contenteditable divs (e.g. the note editor) as editable', () => {
    const editor = document.createElement('div');
    editor.contentEditable = 'true';
    expect(isEventFromEditable(keydownOn(editor))).toBe(true);
  });

  it('treats inputs inside shadow DOM (e.g. vscode-textfield) as editable', () => {
    // The conversation panel's chat input is a web component; at a window-level
    // listener the event is retargeted to the host element, so the guard must
    // look through composedPath. Simulate that with a shadow-DOM input and a
    // document-level capture listener (composedPath is only populated during
    // dispatch).
    const host = document.createElement('x-textfield');
    const shadow = host.attachShadow({ mode: 'open' });
    const inner = document.createElement('input');
    shadow.appendChild(inner);
    document.body.appendChild(host);

    let result: boolean | undefined;
    const listener = (e: Event) => {
      result = isEventFromEditable(e as KeyboardEvent);
    };
    document.addEventListener('keydown', listener, { capture: true });
    inner.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'w', bubbles: true, composed: true })
    );
    document.removeEventListener('keydown', listener, { capture: true });
    host.remove();

    expect(result).toBe(true);
  });

  it('does not treat plain elements as editable (pan proceeds)', () => {
    expect(isEventFromEditable(keydownOn(document.createElement('div')))).toBe(
      false
    );
    expect(isEventFromEditable(keydownOn(document.createElement('span')))).toBe(
      false
    );
  });
});
