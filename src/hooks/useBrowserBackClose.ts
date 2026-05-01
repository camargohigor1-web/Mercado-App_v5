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
    backStack.push(id);
    window.history.pushState({ ...(window.history.state || {}), mercadoBackCloseId: id }, "", window.location.href);

    function handlePopState() {
      if (backStack[backStack.length - 1] === id) {
        onCloseRef.current();
      }
    }

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      const idx = backStack.lastIndexOf(id);
      if (idx >= 0) backStack.splice(idx, 1);
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
