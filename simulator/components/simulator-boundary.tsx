"use client";

import { catchError, type ErrorInfo } from "next/error";
import { getSimulatorUi } from "@/simulator/content";
import type { FormatLocale } from "@/simulator/engine/format";
import { buttonClass, primaryButtonClass } from "./classes";
import { forgetSavedModel } from "./use-saved-model";

/**
 * What stands in for the tool when it throws while rendering.
 *
 * The saved model is loaded again on every visit, so a model that stops the
 * page would stop it each time. The second button is the way out: it forgets
 * that model and starts the tool from its default. The rest of the page (the
 * method, the questions, the links) stays where it is.
 */
function Fallback({ locale }: { locale: FormatLocale }, { reset }: ErrorInfo) {
  const t = getSimulatorUi(locale).failure;
  return (
    <section id="tool" className="border-b border-line">
      <div className="mx-auto w-full max-w-[90rem] px-6 py-12 md:px-8 md:py-16">
        <div role="alert" className="card max-w-2xl p-6 md:p-8">
          <h2 className="text-xl font-semibold tracking-tight text-fg">
            {t.title}
          </h2>
          <p className="mt-4 text-body leading-relaxed text-muted">{t.body}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            {/* Nothing here comes from the server, so the tool is mounted
                again as it is, without fetching the page a second time. */}
            <button
              type="button"
              className={primaryButtonClass}
              onClick={() => reset()}
            >
              {t.retry}
            </button>
            <button
              type="button"
              className={buttonClass}
              onClick={() => {
                forgetSavedModel();
                reset();
              }}
            >
              {t.startAgain}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export const SimulatorBoundary = catchError(Fallback);
