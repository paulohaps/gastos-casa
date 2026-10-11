import { Icon } from "./Icon";

/** Decorative depth stays separate from meaningful text and controls. */
export function DepthMark({ name = "spark" }: { name?: string }) {
  return (
    <span className="depth-mark" aria-hidden="true">
      <span className="depth-mark__back" />
      <span className="depth-mark__face">
        <Icon name={name} />
      </span>
    </span>
  );
}
