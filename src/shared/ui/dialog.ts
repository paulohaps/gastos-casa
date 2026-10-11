import type { KeyboardEvent } from "react";
// Native dialog makes the background inert; wrap its two boundary controls so
// keyboard focus also stays visible while cycling through the actions.
export function containDialogFocus(event: KeyboardEvent<HTMLDialogElement>) {
  if (event.key !== "Tab") return;
  const controls = [
    ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
      "button:not([disabled])",
    ),
  ];
  const target = event.shiftKey ? controls.at(-1) : controls[0];
  const boundary = event.shiftKey ? controls[0] : controls.at(-1);
  if (document.activeElement === boundary && target) {
    event.preventDefault();
    target.focus();
  }
}
