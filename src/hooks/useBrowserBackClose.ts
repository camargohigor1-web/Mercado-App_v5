import { useCallback, useEffect, useRef } from "react";

const backStack: string[] = [];

export function useBrowserBackClose(active: boolean, onClose: () => void) {
  const idRef = useRef(`back-close-${Math.random().toString(36).slice(2)}`);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!active || typeof window === "undefined") return;

    const id = idRef.current;

    // Delay by two frames so any in-progress popstate from a previous
    // navigation (e.g. tab switch remount) has time to settle before
    // we push a new history entry and attach our listener.
    let raf1: number;
    let raf2: number;
    let cleanup: (() => void) | null = null;

    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        backStack.push(id);
        window.history.pushState(
          { ...(window.history.state || {}), mercadoBackCloseId: id },
          "",
          window.location.href
        );

        function handlePopState() {
          if (backStack[backStack.length - 1] === id) {
            onCloseRef.current();
          }
        }

        window.addEventListener("popstate", handlePopState);
        cleanup = () => {
          window.removeEventListener("popstate", handlePopState);
          const idx = backStack.lastIndexOf(id);
          if (idx >= 0) backStack.splice(idx, 1);
        };
      });
    });

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      cleanup?.();
    };
  }, [active]);

  return useCallback(() => {
    if (
      active &&
      typeof window !== "undefined" &&
      window.history.state?.mercadoBackCloseId === idRef.current
    ) {
      window.history.back();
      return;
    }
    onCloseRef.current();
  }, [active]);
}
