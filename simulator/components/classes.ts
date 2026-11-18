/**
 * Class strings shared by the simulator's panels, in the site's own terms:
 * square corners, hairlines, token colours.
 */

import actions from "./actions/actions.module.css";

export const buttonClass = actions.button;
export const primaryButtonClass = actions.primary;
export const textButtonClass = actions.text;

/** Heading of a results panel. */
export const panelTitleClass =
  "text-lg font-semibold tracking-tight text-fg";

/** The short paragraph under a panel heading. */
export const panelIntroClass = "mt-2 max-w-prose text-sm leading-relaxed text-muted";

/** Numbers in tables and tiles line up when their digits share a width. They
 *  stay in the text face: the mono face is kept for the small labels. */
export const figureClass = "tabular-nums";
