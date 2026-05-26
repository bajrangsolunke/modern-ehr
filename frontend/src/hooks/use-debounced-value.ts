import { useEffect, useState } from "react";

/**
 * Returns `value` after `delay` ms of stillness.
 * Useful for search inputs that drive expensive queries.
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return debounced;
}
