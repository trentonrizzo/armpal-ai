import { useState, useRef, useCallback, useEffect } from "react";

const LP_MS = 500;
const MOVE_SQ = 100;

export default function useMultiSelect() {
  const [active, setActive] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const timerRef = useRef(null);
  const originRef = useRef(null);
  const firedRef = useRef(false);

  const clearLP = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const onPointerDown = useCallback((id, e) => {
    if (e.button !== 0) return;
    firedRef.current = false;
    originRef.current = { x: e.clientX, y: e.clientY };
    clearLP();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      firedRef.current = true;
      setActive(true);
      setSelected(new Set([id]));
    }, LP_MS);
  }, [clearLP]);

  const onPointerMove = useCallback((e) => {
    if (!timerRef.current || !originRef.current) return;
    const dx = e.clientX - originRef.current.x;
    const dy = e.clientY - originRef.current.y;
    if (dx * dx + dy * dy > MOVE_SQ) clearLP();
  }, [clearLP]);

  const toggle = useCallback((id) => {
    setSelected((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  const cancel = useCallback(() => {
    setActive(false);
    setSelected(new Set());
  }, []);

  const removeIds = useCallback((ids) => {
    setSelected((p) => {
      const n = new Set(p);
      ids.forEach((i) => n.delete(i));
      return n;
    });
  }, []);

  const consumeLP = useCallback(() => {
    if (firedRef.current) {
      firedRef.current = false;
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    if (!active) return;
    const h = (e) => {
      if (e.key === "Escape") cancel();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [active, cancel]);

  useEffect(() => () => clearLP(), [clearLP]);

  return {
    active,
    selected,
    count: selected.size,
    onPointerDown,
    onPointerMove,
    endLP: clearLP,
    toggle,
    cancel,
    removeIds,
    consumeLP,
  };
}
