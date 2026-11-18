"use client";

import * as Tabs from "@radix-ui/react-tabs";
import actions from "../actions/actions.module.css";
import { useEffect, useRef, useState, type ComponentType } from "react";
import { flushSync } from "react-dom";
import { chartTabIds, type ChartTabId } from "@/simulator/content/ui.en";
import { panelTitleClass, textButtonClass } from "../classes";
import { downloadBlob, fileStem } from "../download";
import { SelectField } from "../fields/select-field";
import { useResults } from "../store";
import { chartImage } from "./chart-image";
import {
  AllocationChart,
  FlowsChart,
  PriceChart,
  StakingChart,
  SupplyChart,
  TreasuryChart,
  UnlocksChart,
  ValuationChart,
} from "./chart-views";

const views: Record<ChartTabId, ComponentType> = {
  supply: SupplyChart,
  unlocks: UnlocksChart,
  allocation: AllocationChart,
  price: PriceChart,
  valuation: ValuationChart,
  flows: FlowsChart,
  staking: StakingChart,
  treasury: TreasuryChart,
};

/* The open tab looks like the chosen option of a segmented control: the
   raised fill, the foreground text and an accent rule under it. */
const tabClass = actions.tab;

/** One chart view in its card, with the button that saves it as a picture. */
function ChartCard({ id, source }: { id: ChartTabId; source: string }) {
  const { ui, model } = useResults();
  const c = ui.results.charts;
  const view = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const View = views[id];
  const title = c.tabs[id];

  async function download() {
    if (!view.current) return;
    setBusy(true);
    setFailed(false);
    try {
      const name = model.token.name.trim();
      const blob = await chartImage(view.current, {
        title: name ? `${name}: ${title}` : title,
        footer: source,
      });
      if (blob) downloadBlob(blob, `${fileStem(model)}-${id}.png`);
      else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card sim-print-keep p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
        <h3 className={panelTitleClass}>{title}</h3>
        <button
          type="button"
          className={`${textButtonClass} print:hidden`}
          onClick={download}
          disabled={busy}
        >
          {c.downloadPng}
        </button>
      </div>
      <p role="status" className="text-sm text-(--color-status-risk) print:hidden">
        {failed ? c.downloadFailed : null}
      </p>
      <div ref={view} className="mt-4">
        <View />
      </div>
    </div>
  );
}

/**
 * The charts, one view at a time behind tabs. For printing every view is
 * laid out in turn, in tab order, because a report cannot be clicked
 * through.
 * `source` is the line printed under a saved picture.
 */
export function ChartsPanel({ source }: { source: string }) {
  const { ui } = useResults();
  const c = ui.results.charts;
  const [tab, setTab] = useState<ChartTabId>("supply");
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    // The browser lays the page out for print as soon as this event has
    // run, so the extra charts have to be in the document before it ends.
    const onBeforePrint = () => flushSync(() => setPrinting(true));
    const onAfterPrint = () => setPrinting(false);
    window.addEventListener("beforeprint", onBeforePrint);
    window.addEventListener("afterprint", onAfterPrint);
    return () => {
      window.removeEventListener("beforeprint", onBeforePrint);
      window.removeEventListener("afterprint", onAfterPrint);
    };
  }, []);

  // The open view stays mounted through a print, so what the person set in
  // it (a holder view, a log scale, a hidden series) is what gets printed
  // and is still there afterwards. The other views are mounted beside it for
  // as long as the print takes.
  //
  // Eight tabs need about two lines of a wide results column. Where the
  // column is narrower than that, on a phone and beside the inputs on a
  // small laptop, one select takes their place.
  return (
    <section aria-label={c.label} className="@container min-w-0">
      <SelectField<ChartTabId>
        id="sim-chart"
        label={c.label}
        hideLabel
        value={tab}
        options={chartTabIds.map((id) => ({ value: id, label: c.tabs[id] }))}
        onChange={setTab}
        className="@2xl:hidden print:hidden"
      />
      <Tabs.Root
        value={tab}
        onValueChange={(value) => {
          const next = chartTabIds.find((id) => id === value);
          if (next) setTab(next);
        }}
        className="print:grid print:gap-8"
      >
        <Tabs.List
          aria-label={c.label}
          className={`${actions.tabs} hidden flex-wrap @2xl:flex print:hidden`}
        >
          {chartTabIds.map((id) => (
            <Tabs.Trigger key={id} value={id} className={tabClass}>
              {c.tabs[id]}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
        {chartTabIds.map((id) => (
          <Tabs.Content
            key={id}
            value={id}
            forceMount={printing ? true : undefined}
            className="mt-4 print:mt-0"
            tabIndex={-1}
          >
            <ChartCard id={id} source={source} />
          </Tabs.Content>
        ))}
      </Tabs.Root>
    </section>
  );
}
