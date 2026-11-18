"use client";

import * as Accordion from "@radix-ui/react-accordion";
import type { SectionProps, SectionsProps } from "./types";

/**
 * The accordion that holds the input groups, in the look of the FAQ list:
 * hairlines between the rows and a plus that turns into a cross. Any number
 * of groups can be open at once.
 *
 * Radix supplies the behaviour: the heading and button semantics, the arrow
 * keys between the headers, and the measured height that the stylesheet
 * animates (`.sim-section-panel`). A closed group is taken out of the tree,
 * so the page does not carry the inputs of groups nobody is looking at.
 */
export function Sections({ defaultOpen, children }: SectionsProps) {
  return (
    <Accordion.Root
      type="multiple"
      defaultValue={defaultOpen}
      className="border-t border-line"
    >
      {children}
    </Accordion.Root>
  );
}

/**
 * One group. The header is a single button, so the summary and the issues
 * marker are part of its accessible name: a screen reader hears the title,
 * what the closed group holds and how many problems it has in one go.
 *
 * The summary shows only while the group is closed, when the fields it sums
 * up are out of sight. It sits beside the title where there is room and
 * drops under it where there is not.
 */
export function Section({
  value,
  title,
  summary,
  issues,
  issuesLabel,
  children,
}: SectionProps) {
  return (
    <Accordion.Item value={value} className="border-b border-line">
      <Accordion.Header>
        <Accordion.Trigger className="group flex w-full cursor-pointer items-center gap-4 py-4 pr-1 text-left text-base font-medium text-fg transition-colors duration-200 ease-out hover:text-link">
          <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="wrap-anywhere">{title}</span>
            {summary ? (
              <span className="min-w-0 grow basis-32 truncate text-sm font-normal text-muted group-aria-expanded:hidden">
                {summary}
              </span>
            ) : null}
          </span>
          {issues ? (
            <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center bg-fg px-1 font-mono text-micro leading-none text-bg tabular-nums">
              {/* The bare count means little out of context, so the label
                  replaces it for a screen reader when there is one. */}
              <span aria-hidden={issuesLabel ? true : undefined}>{issues}</span>
              {issuesLabel ? (
                <span className="sr-only">{issuesLabel}</span>
              ) : null}
            </span>
          ) : null}
          <span
            aria-hidden
            className="relative block h-3 w-3 shrink-0 text-faint transition-[transform,color] duration-300 ease-out-quart group-aria-expanded:rotate-45 group-aria-expanded:text-accent"
          >
            <span className="absolute left-0 top-1/2 h-px w-3 -translate-y-1/2 bg-current" />
            <span className="absolute left-1/2 top-0 h-3 w-px -translate-x-1/2 bg-current" />
          </span>
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content className="sim-section-panel">
        <div className="pb-8 pt-2">{children}</div>
      </Accordion.Content>
    </Accordion.Item>
  );
}
