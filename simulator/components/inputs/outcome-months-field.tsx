"use client";

import { useState } from "react";
import { LIMITS } from "@/simulator/engine/constants";
import { parseOutcomeMonths } from "@/simulator/engine/model-edit";
import { TextField } from "../fields/text-field";
import { useModel } from "../store";
import { fieldCopy, fieldId } from "./model-field";

/** Four three-digit months with their commas take 18 characters. The rest is
 *  room for the spaces people put around them. */
const MAX_LENGTH = LIMITS.MAX_OUTCOME_MONTHS * 8;

/** The months as the field writes them out: "12, 24, 36". */
function toText(months: number[]): string {
  return months.join(", ");
}

/**
 * The months at which the holder table reports, typed as a list.
 *
 * The model holds a sorted list of numbers and the field holds text, and the
 * two cannot be the same thing: "12, 2" is on its way to "12, 24", and
 * rewriting it to "2, 12" halfway would pull the text out from under the
 * caret. So the field keeps the text as typed. A text that parses is written
 * to the model on every change, and one that does not parse shows the error
 * and leaves the model as it was.
 *
 * Beside the text the field remembers which stored months that text stands
 * for. When the model holds anything else, the months were changed somewhere
 * else, by a preset or an undo, and the text is replaced with them.
 */
export function OutcomeMonthsField() {
  const { ui, model, edit } = useModel();
  const stored = toText(model.outcomeMonths);
  const [draft, setDraft] = useState({ text: stored, stored });

  if (draft.stored !== stored) setDraft({ text: stored, stored });
  const text = draft.stored === stored ? draft.text : stored;
  const valid = parseOutcomeMonths(text) !== null;

  function handleChange(next: string) {
    const months = parseOutcomeMonths(next);
    if (months === null) {
      setDraft({ text: next, stored });
      return;
    }
    const nextStored = toText(months);
    setDraft({ text: next, stored: nextStored });
    // Retyping the months the model already holds is not an edit, and must
    // not become a step to undo.
    if (nextStored !== stored) {
      edit((current) => ({ ...current, outcomeMonths: months }));
    }
  }

  // Once the person has left the field, a valid list is shown the way the
  // model holds it: sorted, with one comma and one space between months.
  function handleBlur() {
    if (valid && text !== stored) setDraft({ text: stored, stored });
  }

  return (
    <div onBlur={handleBlur}>
      <TextField
        id={fieldId("outcomeMonths")}
        {...fieldCopy(ui, ui.inputs.outcomeMonths)}
        value={text}
        maxLength={MAX_LENGTH}
        error={valid ? undefined : ui.inputs.outcomeMonthsInvalid}
        onChange={handleChange}
      />
    </div>
  );
}
