"use client";

import { useCallback, useState } from "react";

const NONE: ReadonlySet<string> = new Set<string>();

/**
 * The series a reader has switched off in the legend, by id.
 *
 * Ids are kept, not positions, so a series stays hidden when the data
 * behind the chart is recomputed, and an id that no longer exists is
 * harmless.
 */
export function useHiddenSeries(): {
  hidden: ReadonlySet<string>;
  toggle: (id: string) => void;
} {
  const [hidden, setHidden] = useState(NONE);
  const toggle = useCallback((id: string) => {
    setHidden((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);
  return { hidden, toggle };
}
