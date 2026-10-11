import { useEffect } from "react";

/** Safari's keyboard and browser chrome can pan/shrink only the visual viewport. */
export function useChatViewport() {
  useEffect(() => {
    const viewport = window.visualViewport;
    const style = document.documentElement.style;
    let frame = 0;
    function sync() {
      const height = viewport?.height ?? window.innerHeight;
      style.setProperty("--chat-viewport-height", `${height}px`);
      style.setProperty("--chat-viewport-top", `${viewport?.offsetTop ?? 0}px`);
      const editing =
        document.activeElement?.closest("#assistantComposer, .chat-context") &&
        document.activeElement?.matches("input, textarea");
      document.body.toggleAttribute(
        "data-chat-keyboard",
        Boolean(editing && window.innerHeight - height > 140),
      );
      document.body.toggleAttribute("data-chat-compact", height <= 650);
    }
    function schedule() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(sync);
    }
    sync();
    viewport?.addEventListener("resize", schedule);
    viewport?.addEventListener("scroll", schedule);
    window.addEventListener("resize", schedule);
    document.addEventListener("focusin", schedule);
    document.addEventListener("focusout", schedule);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener("resize", schedule);
      viewport?.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      document.removeEventListener("focusin", schedule);
      document.removeEventListener("focusout", schedule);
      style.removeProperty("--chat-viewport-height");
      style.removeProperty("--chat-viewport-top");
      document.body.removeAttribute("data-chat-keyboard");
      document.body.removeAttribute("data-chat-compact");
    };
  }, []);
}
