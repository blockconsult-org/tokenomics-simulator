"use client";

import {
  useRef,
  type ChangeEvent,
  type Dispatch,
} from "react";
import { presetIds, type PresetId } from "@/simulator/engine/presets";
import { scenarios, type Scenario, type SimulationResult } from "@/simulator/engine/types";
import { buttonClass, primaryButtonClass } from "../classes";
import { downloadText, fileStem } from "../download";
import { Help } from "../fields/help";
import { Segmented } from "../fields/segmented";
import { SelectField } from "../fields/select-field";
import { ActionMenu as Menu, ActionMenuItem as MenuItem } from "./menu";
import { monthlyCsv } from "../results/monthly-columns";
import { presetModel, useModel, type SimulatorAction } from "../store";
import { modelFileText, readModelFile, shareLink } from "../use-saved-model";

/** The preset list's entry for a model that came from a link or a file. */
const CUSTOM = "custom";
type PresetChoice = PresetId | typeof CUSTOM;

interface ToolbarProps {
  presetId: PresetId | null;
  canUndo: boolean;
  hasBaseline: boolean;
  /** The current inputs run without blocking errors. */
  valid: boolean;
  /** The run on screen, for the CSV. Null when there is none. */
  result: SimulationResult | null;
  dispatch: Dispatch<SimulatorAction>;
  /** Shows a status message; the tool announces and clears it. */
  notify: (text: string) => void;
}

/**
 * The bar above the tool: where a model comes from (preset, link, file),
 * which scenario runs, and where it can go (link, files, paper).
 */
export function Toolbar({
  presetId,
  canUndo,
  hasBaseline,
  valid,
  result,
  dispatch,
  notify,
}: ToolbarProps) {
  const { ui, model, edit } = useModel();
  const t = ui.toolbar;
  const fileInput = useRef<HTMLInputElement>(null);

  const choice: PresetChoice = presetId ?? CUSTOM;
  const presetOptions = [
    ...(presetId === null ? [{ value: CUSTOM, label: t.customModel } as const] : []),
    ...presetIds.map((id) => ({ value: id, label: t.presets[id].name })),
  ];
  const description =
    presetId === null ? t.customModelDescription : t.presets[presetId].description;

  function loadPreset(id: PresetId) {
    dispatch({ type: "replace", model: presetModel(id, ui), presetId: id });
  }

  function setScenario(scenario: Scenario) {
    edit((current) => ({
      ...current,
      speculation: { ...current.speculation, scenario },
    }));
  }

  async function copyLink() {
    let link: string | null = null;
    try {
      link = await shareLink(model);
      await navigator.clipboard.writeText(link);
      notify(t.shareCopied);
    } catch {
      // Without clipboard access the link goes into the address bar, where
      // the message tells the person to copy it from.
      if (link) window.history.replaceState(null, "", link);
      notify(t.shareFailed);
    }
  }

  async function loadFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    // Cleared so that picking the same file again fires a change.
    input.value = "";
    if (!file) return;
    const loaded = await readModelFile(file);
    if (loaded) {
      dispatch({ type: "replace", model: loaded, presetId: null });
      notify(t.importDone);
    } else {
      notify(t.importFailed);
    }
  }

  return (
    <div
      role="group"
      aria-label={t.label}
      className="border-b border-line pb-6 print:hidden"
    >
      {/* Two groups pushed apart: what the model starts from, and what can
          be done with it. Side by side the actions sit at the right-hand
          end. When they do not fit, in a narrower window or with German
          labels, each group has a line to itself and starts at the left. */}
      <div className="flex flex-wrap items-end justify-between gap-x-5 gap-y-4">
        <div className="flex w-full flex-wrap items-end gap-x-5 gap-y-4 sm:w-auto">
          <SelectField<PresetChoice>
            id="sim-preset"
            label={t.preset}
            value={choice}
            options={presetOptions}
            onChange={(value) => {
              if (value !== CUSTOM) loadPreset(value);
            }}
            className="w-full sm:w-72"
          />
          <Segmented<Scenario>
            id="sim-toolbar-scenario"
            label={t.scenario}
            value={model.speculation.scenario}
            options={scenarios.map((value) => ({
              value,
              label: t.scenarios[value],
            }))}
            onChange={setScenario}
            className="w-full sm:w-64"
          />
        </div>

        {/* On a phone the actions are two even columns with the filled
            button across both. From there up they are a row. */}
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
          <button
            type="button"
            className={buttonClass}
            disabled={!canUndo}
            onClick={() => dispatch({ type: "undo" })}
          >
            {t.undo}
          </button>
          <button
            type="button"
            className={buttonClass}
            disabled={presetId === null}
            onClick={() => {
              if (presetId) loadPreset(presetId);
            }}
          >
            {t.reset}
          </button>
          <button
            type="button"
            className={buttonClass}
            disabled={!hasBaseline && !valid}
            onClick={() => dispatch({ type: hasBaseline ? "unpin" : "pin" })}
          >
            {hasBaseline ? t.clearBaseline : t.pinBaseline}
          </button>
          <Menu label={t.more}>
            <MenuItem
              onClick={() =>
                downloadText(
                  modelFileText(model),
                  `${fileStem(model)}.json`,
                  "application/json",
                )
              }
            >
              {t.exportJson}
            </MenuItem>
            <MenuItem
              disabled={!result}
              onClick={() => {
                if (!result) return;
                downloadText(
                  monthlyCsv(result, ui),
                  `${fileStem(model)}.csv`,
                  "text/csv",
                );
              }}
            >
              {t.exportCsv}
            </MenuItem>
            <MenuItem onClick={() => window.print()}>{t.print}</MenuItem>
            <MenuItem onClick={() => fileInput.current?.click()}>
              {t.importJson}
            </MenuItem>
          </Menu>
          <span className="col-span-2 flex items-center gap-2">
            <button
              type="button"
              className={`${primaryButtonClass} flex-1 sm:flex-none`}
              onClick={() => void copyLink()}
            >
              {t.share}
            </button>
            <Help label={ui.inputs.helpAbout(t.share)}>{t.shareNote}</Help>
          </span>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(event) => void loadFile(event)}
          />
        </div>
      </div>

      <div className="mt-4 grid max-w-prose gap-1 text-sm leading-relaxed text-muted">
        <p>{description}</p>
        {hasBaseline ? <p>{t.baselineNote}</p> : null}
      </div>
    </div>
  );
}
