"use client";

import { createContext, useContext } from "react";
import type { SimulatorUi } from "@/simulator/content";
import type { ModelFieldPath } from "@/simulator/engine/fields";
import type { FormatLocale } from "@/simulator/engine/format";
import { nameRows, setNumber } from "@/simulator/engine/model-edit";
import {
  defaultPresetId,
  getPreset,
  type PresetId,
} from "@/simulator/engine/presets";
import type {
  Model,
  ModelIssue,
  MonteCarloResult,
  SimulationResult,
} from "@/simulator/engine/types";

/* -------------------------------------------------------------------------- */
/* State                                                                      */
/* -------------------------------------------------------------------------- */

interface Snapshot {
  model: Model;
  presetId: PresetId | null;
}

export interface SimulatorState {
  model: Model;
  /** The preset the model started from, or null for a loaded or shared one. */
  presetId: PresetId | null;
  /** Earlier models, oldest first, for undo. */
  history: Snapshot[];
  /** When the last edit landed, so that a slider drag undoes as one step. */
  lastEditAt: number;
  /** A pinned model the results are compared against. */
  baseline: Model | null;
}

export type SimulatorAction =
  /** An edit to the current model. `at` is the time of the edit in ms. */
  | { type: "edit"; edit: (model: Model) => Model; at: number }
  /** Swap the whole model: a preset, an imported file, a share link. */
  | { type: "replace"; model: Model; presetId: PresetId | null }
  /** Put the saved model in place on first load. Not an undo step. */
  | { type: "restore"; model: Model; presetId: PresetId | null }
  | { type: "undo" }
  | { type: "pin" }
  | { type: "unpin" };

/** Edits closer together than this undo as one step. */
const EDIT_GROUP_MS = 800;
const MAX_HISTORY = 50;

function pushHistory(state: SimulatorState): Snapshot[] {
  return [
    ...state.history.slice(-(MAX_HISTORY - 1)),
    { model: state.model, presetId: state.presetId },
  ];
}

/** A preset with its row names in the page's language. */
export function presetModel(id: PresetId, ui: SimulatorUi): Model {
  return nameRows(getPreset(id), ui.inputs.allocations.presetRowNames);
}

export function initialState(ui: SimulatorUi): SimulatorState {
  return {
    model: presetModel(defaultPresetId, ui),
    presetId: defaultPresetId,
    history: [],
    lastEditAt: 0,
    baseline: null,
  };
}

export function reducer(
  state: SimulatorState,
  action: SimulatorAction,
): SimulatorState {
  switch (action.type) {
    case "edit": {
      const model = action.edit(state.model);
      if (model === state.model) return state;
      const sameGesture = action.at - state.lastEditAt < EDIT_GROUP_MS;
      return {
        ...state,
        model,
        history: sameGesture ? state.history : pushHistory(state),
        lastEditAt: action.at,
      };
    }
    case "replace":
      return {
        ...state,
        model: action.model,
        presetId: action.presetId,
        history: pushHistory(state),
        lastEditAt: 0,
      };
    case "restore":
      return { ...state, model: action.model, presetId: action.presetId };
    case "undo": {
      const last = state.history.at(-1);
      if (!last) return state;
      return {
        ...state,
        model: last.model,
        presetId: last.presetId,
        history: state.history.slice(0, -1),
        lastEditAt: 0,
      };
    }
    case "pin":
      return { ...state, baseline: state.model };
    case "unpin":
      return { ...state, baseline: null };
  }
}

/* -------------------------------------------------------------------------- */
/* Contexts                                                                   */
/* -------------------------------------------------------------------------- */

/** What the input panels need: the model, its problems and how to edit it. */
export interface ModelContextValue {
  locale: FormatLocale;
  ui: SimulatorUi;
  model: Model;
  /** Errors and warnings of the current model, for marking fields. */
  issues: ModelIssue[];
  /** Apply an edit from simulator/engine/model-edit.ts. */
  edit: (edit: (model: Model) => Model) => void;
  /** Shorthand for the most common edit. */
  setNumber: (path: ModelFieldPath, value: number | null) => void;
}

/** Progress of the Monte Carlo job behind the bands. */
export interface MonteCarloState {
  /** Bands from the runs finished so far. Null before the first batch, and
   *  while the runs for changed inputs have not produced one yet. */
  result: MonteCarloResult | null;
  done: number;
  total: number;
  running: boolean;
}

/** What the result panels need. */
export interface ResultsContextValue {
  locale: FormatLocale;
  ui: SimulatorUi;
  /** The model the result was computed from. */
  model: Model;
  /** The last valid run. */
  result: SimulationResult;
  /** Blocking problems of the current inputs; empty when `result` is current. */
  errors: ModelIssue[];
  baseline: { model: Model; result: SimulationResult } | null;
  monteCarlo: MonteCarloState;
}

export const ModelContext = createContext<ModelContextValue | null>(null);
export const ResultsContext = createContext<ResultsContextValue | null>(null);

export function useModel(): ModelContextValue {
  const value = useContext(ModelContext);
  if (!value) throw new Error("useModel must be used inside <Simulator>");
  return value;
}

export function useResults(): ResultsContextValue {
  const value = useContext(ResultsContext);
  if (!value) throw new Error("useResults must be used inside <Simulator>");
  return value;
}

/** Issues that point at `field` or at something inside it. */
export function issuesAt(issues: ModelIssue[], field: string): ModelIssue[] {
  return issues.filter(
    (issue) => issue.field === field || issue.field.startsWith(`${field}.`),
  );
}

/** Build the `setNumber` shorthand from `edit`. */
export function numberSetter(
  edit: ModelContextValue["edit"],
): ModelContextValue["setNumber"] {
  return (path, value) => edit((model) => setNumber(model, path, value));
}
