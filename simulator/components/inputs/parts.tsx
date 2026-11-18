"use client";

import type { ReactNode } from "react";

/**
 * Small pieces the input groups share. They carry no wording of their own:
 * every string comes from the caller.
 */

/**
 * A blocking problem that belongs to a group of fields, where no single
 * control can show it. The site has no error colour, so the line is set apart
 * the way an invalid field is, by the stronger border.
 *
 * The line is an alert: it appears in answer to an edit, often to a slider
 * the person is still holding, and a screen reader should say so there and
 * then. A line whose text holds a figure that moves with every keystroke is
 * `running`: it waits for a pause, so it does not cut in on each digit.
 */
export function ErrorLine({
  running = false,
  children,
}: {
  running?: boolean;
  children: ReactNode;
}) {
  return (
    <p
      role={running ? "status" : "alert"}
      className="border-l-2 border-fg/60 pl-3 text-sm leading-snug text-fg wrap-anywhere"
    >
      {children}
    </p>
  );
}

/** A remark under a control or a group: why a button is off, what is left. */
export function Note({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="text-sm leading-snug text-muted">
      {children}
    </p>
  );
}

/** Heading of a block of fields inside an input group. The group's own
 *  heading is an h3 under the panel's h2, which makes this one an h4. */
export function SubHeading({ children }: { children: ReactNode }) {
  return <h4 className="label-mono mt-3 text-micro">{children}</h4>;
}

/** The count of blocking problems in a part of the form, drawn like the
 *  marker on the header of an input group. `label` says what the bare number
 *  means and replaces it for a screen reader. */
export function IssueMarker({ count, label }: { count: number; label: string }) {
  return (
    <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center bg-fg px-1 font-mono text-micro leading-none text-bg tabular-nums">
      <span aria-hidden>{count}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
