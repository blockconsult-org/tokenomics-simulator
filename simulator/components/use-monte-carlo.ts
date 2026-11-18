"use client";

import { useEffect, useState } from "react";
import {
  advanceMonteCarlo,
  createMonteCarlo,
  summariseMonteCarlo,
} from "@/simulator/engine/monte-carlo";
import type { Model, MonteCarloResult } from "@/simulator/engine/types";
import type { MonteCarloState } from "./store";

/** Wait this long after the last edit before starting, so a slider drag
 *  does not start a job per frame. */
const START_DELAY_MS = 350;
/** Time spent on runs per frame. The rest of the frame stays free for input. */
const FRAME_BUDGET_MS = 10;
const RUNS_PER_BATCH = 10;

interface Finished {
  model: Model;
  result: MonteCarloResult;
  done: number;
}

/**
 * Runs the Monte Carlo job for a valid model on the main thread, a few
 * milliseconds per frame, and reports bands as they firm up.
 *
 * While the runs for changed inputs are pending, the bands of the earlier
 * inputs stay in place: dropping them would make the price chart rescale
 * twice for every edit.
 */
export function useMonteCarlo(model: Model | null): MonteCarloState {
  const [state, setState] = useState<Finished | null>(null);

  useEffect(() => {
    if (!model) return;
    let cancelled = false;
    let frame = 0;

    const timer = window.setTimeout(() => {
      const job = createMonteCarlo(model);
      // The caller passes the last model that ran, so no failure is expected
      // here. Without a job the earlier bands simply stay.
      if ("ok" in job) return;
      // Summarising sorts every month's values, so it is done a few times
      // per job and not after every batch.
      const reportEvery = Math.max(100, Math.ceil(job.runs / 4));
      let reported = 0;

      const step = () => {
        if (cancelled) return;
        const started = performance.now();
        do {
          advanceMonteCarlo(job, RUNS_PER_BATCH);
        } while (
          job.completed < job.runs &&
          performance.now() - started < FRAME_BUDGET_MS
        );

        const finished = job.completed >= job.runs;
        if (finished || job.completed - reported >= reportEvery) {
          reported = job.completed;
          setState({
            model,
            result: summariseMonteCarlo(job),
            done: job.completed,
          });
        }
        if (!finished) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    }, START_DELAY_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [model]);

  const total = model?.monteCarlo.runs ?? 0;
  const current = state !== null && state.model === model;
  const done = current ? state.done : 0;
  return {
    result: state?.result ?? null,
    done,
    total,
    running: model !== null && done < total,
  };
}
