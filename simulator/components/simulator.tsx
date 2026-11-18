"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { getSimulatorUi } from "@/simulator/content";
import type { FormatLocale } from "@/simulator/engine/format";
import { simulate } from "@/simulator/engine/simulate";
import type {
  Model,
  ModelIssue,
  SimulationResult,
} from "@/simulator/engine/types";
import { validateModel } from "@/simulator/engine/validate";
import { Toolbar } from "./actions/toolbar";
import { InputsPanel } from "./inputs/inputs-panel";
import { PrintInputs } from "./print-inputs";
import { ChartsPanel } from "./results/charts-panel";
import { DataTable } from "./results/data-table";
import { HealthChecks } from "./results/health-checks";
import { HolderTable } from "./results/holder-table";
import { IssuesPanel } from "./results/issues-panel";
import { KpiTiles } from "./results/kpi-tiles";
import { ResultsBar } from "./results/results-bar";
import { SimulatorBoundary } from "./simulator-boundary";
import {
  ModelContext,
  ResultsContext,
  initialState,
  numberSetter,
  reducer,
  type ModelContextValue,
  type ResultsContextValue,
} from "./store";
import { useMonteCarlo } from "./use-monte-carlo";
import { useSavedModel, type LinkNotice } from "./use-saved-model";

interface Run {
  model: Model;
  result: SimulationResult;
}

const NO_ERRORS: ModelIssue[] = [];
/** How long a status message stays before it clears itself. */
const NOTICE_MS = 8000;

/** One pinned or current run, or null when the model has blocking errors. */
function runOf(model: Model | null): Run | null {
  if (!model) return null;
  const result = simulate(model);
  return result.ok ? { model, result } : null;
}

interface SimulatorProps {
  locale: FormatLocale;
  /** The page's public address, printed on the report. */
  pageUrl: string;
}

/** The tool, with a fallback in its place if it throws while rendering. */
export function Simulator(props: SimulatorProps) {
  return (
    <SimulatorBoundary locale={props.locale}>
      <Tool {...props} />
    </SimulatorBoundary>
  );
}

/**
 * The tool: inputs on one side, results on the other, a bar of actions above.
 *
 * Everything runs in the browser. The model lives in a reducer, the result is
 * derived from it on every change, and the Monte Carlo runs follow a moment
 * later.
 */
function Tool({ locale, pageUrl }: SimulatorProps) {
  const ui = getSimulatorUi(locale);
  const [state, dispatch] = useReducer(reducer, ui, initialState);
  const { model } = state;

  const issues = useMemo(() => validateModel(model), [model]);
  const current = useMemo(() => runOf(model), [model]);
  const baseline = useMemo(() => runOf(state.baseline), [state.baseline]);

  // While the inputs have a blocking error the last valid run stays on
  // screen, marked as such, so the page does not go blank mid-edit.
  const [lastValid, setLastValid] = useState<Run | null>(null);
  if (current && lastValid !== current) setLastValid(current);
  const shown = current ?? lastValid;

  const monteCarlo = useMonteCarlo(shown?.model ?? null);

  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<number | undefined>(undefined);
  const notify = useCallback((text: string) => {
    window.clearTimeout(noticeTimer.current);
    setNotice(text);
    noticeTimer.current = window.setTimeout(() => setNotice(null), NOTICE_MS);
  }, []);
  useEffect(() => () => window.clearTimeout(noticeTimer.current), []);

  const onLink = useCallback(
    (kind: LinkNotice) => notify(ui.toolbar[kind]),
    [notify, ui],
  );
  // A saved model with a blocking error has no valid run of its own, and the
  // default preset's run must not stand in for it.
  const onRestore = useCallback(() => setLastValid(null), []);
  useSavedModel({
    model,
    presetId: state.presetId,
    dispatch,
    onLink,
    onRestore,
  });

  // The report prints in the light theme whatever the screen shows.
  useEffect(() => {
    const root = document.documentElement;
    let screenTheme: string | undefined;
    const onBeforePrint = () => {
      screenTheme = root.dataset.theme;
      root.dataset.theme = "light";
    };
    const onAfterPrint = () => {
      if (screenTheme) root.dataset.theme = screenTheme;
      else delete root.dataset.theme;
    };
    window.addEventListener("beforeprint", onBeforePrint);
    window.addEventListener("afterprint", onAfterPrint);
    return () => {
      window.removeEventListener("beforeprint", onBeforePrint);
      window.removeEventListener("afterprint", onAfterPrint);
    };
  }, []);

  const edit = useCallback<ModelContextValue["edit"]>(
    (change) => dispatch({ type: "edit", edit: change, at: Date.now() }),
    [],
  );
  const modelValue = useMemo<ModelContextValue>(
    () => ({ locale, ui, model, issues, edit, setNumber: numberSetter(edit) }),
    [locale, ui, model, issues, edit],
  );

  const errors = useMemo(() => {
    const blocking = issues.filter((issue) => issue.severity === "error");
    return blocking.length > 0 ? blocking : NO_ERRORS;
  }, [issues]);
  const resultsValue = useMemo<ResultsContextValue | null>(
    () =>
      shown
        ? {
            locale,
            ui,
            model: shown.model,
            result: shown.result,
            errors,
            baseline,
            monteCarlo,
          }
        : null,
    [locale, ui, shown, errors, baseline, monteCarlo],
  );

  return (
    <ModelContext value={modelValue}>
      <section
        id="tool"
        aria-label={ui.toolbar.label}
        className="border-b border-line"
      >
        <div className="mx-auto w-full max-w-[90rem] px-6 py-8 md:px-8 md:py-10 print:p-0">
          <div className="hidden print:block">
            <p className="text-2xl font-semibold tracking-tight text-fg">
              {ui.print.title(model.token.name)}
            </p>
            <p className="mt-2 text-sm text-muted">{ui.print.disclaimer}</p>
            <p className="mt-1 text-xs text-faint">{ui.print.source(pageUrl)}</p>
          </div>

          <Toolbar
            presetId={state.presetId}
            canUndo={state.history.length > 0}
            hasBaseline={state.baseline !== null}
            valid={current !== null}
            result={shown?.result ?? null}
            dispatch={dispatch}
            notify={notify}
          />

          <div className="mt-8 grid items-start gap-8 lg:grid-cols-[26rem_minmax(0,1fr)] xl:grid-cols-[28rem_minmax(0,1fr)] print:mt-6 print:block">
            <div className="sim-inputs min-w-0 print:hidden">
              {/* For the keyboard: it shows when it takes the focus. A pointer
                  has the bar at the foot of the window instead. */}
              <a
                href="#results"
                className="sr-only mb-3 inline-flex min-h-11 items-center text-sm font-medium text-link underline-offset-4 hover:underline focus:not-sr-only"
              >
                {ui.toolbar.skipToResults}
              </a>
              <InputsPanel />
            </div>

            <div id="results" className="min-w-0 scroll-mt-4">
              <h2 className="text-2xl font-semibold tracking-tight text-fg print:hidden">
                {ui.results.title}
              </h2>
              <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted print:hidden">
                {ui.results.scenarioNote}
              </p>
              <div className="mt-6 grid gap-10">
                <IssuesPanel stale={current === null && shown !== null} />
                {resultsValue ? (
                  <ResultsContext value={resultsValue}>
                    <KpiTiles />
                    <HealthChecks />
                    <ChartsPanel source={ui.print.source(pageUrl)} />
                    <HolderTable />
                    <DataTable />
                  </ResultsContext>
                ) : null}
              </div>
            </div>
          </div>

          <PrintInputs />
        </div>

        {/* What stays at the foot of the window: the latest status message
            and, where the results sit under the inputs, a bar that leads to
            them. Only the two themselves take presses. */}
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex flex-col items-center print:hidden">
          {/* Always in the document, so a message set later is announced. */}
          <div role="status" className="px-4 pb-4">
            {notice ? (
              <p className="pointer-events-auto max-w-md bg-fg px-4 py-3 text-sm leading-snug font-medium text-bg transition-[opacity,transform] duration-200 ease-out-quart starting:translate-y-2 starting:opacity-0">
                {notice}
              </p>
            ) : null}
          </div>
          {resultsValue ? (
            <div className="w-full lg:hidden">
              <ResultsContext value={resultsValue}>
                <ResultsBar targetId="results" />
              </ResultsContext>
            </div>
          ) : null}
        </div>
      </section>
    </ModelContext>
  );
}
