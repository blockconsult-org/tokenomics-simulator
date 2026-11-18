"use client";

import { useEffect, useRef, useState, type Dispatch } from "react";
import { decodeModel, encodeModel } from "@/simulator/engine/codec";
import { normaliseModel } from "@/simulator/engine/normalise";
import { presetIds, type PresetId } from "@/simulator/engine/presets";
import type { Model } from "@/simulator/engine/types";
import type { SimulatorAction } from "./store";

/**
 * Where a model lives outside the page: the browser's storage, a share link
 * and a JSON file. All three are read through normaliseModel, so nothing
 * that arrives from outside reaches the engine unchecked.
 */

const STORAGE_KEY = "bc-token-simulator:v1";
/** The share link keeps the model after the #, which browsers do not send. */
const HASH_PREFIX = "#m=";
const SAVE_DELAY_MS = 300;
const MAX_FILE_BYTES = 1_000_000;

export type LinkNotice = "linkLoaded" | "linkInvalid";

interface Saved {
  model: Model;
  presetId: PresetId | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asPresetId(value: unknown): PresetId | null {
  return presetIds.find((id) => id === value) ?? null;
}

function readSaved(): Saved | null {
  try {
    const text = window.localStorage.getItem(STORAGE_KEY);
    if (!text) return null;
    const parsed: unknown = JSON.parse(text);
    if (!isRecord(parsed) || !isRecord(parsed.model)) return null;
    return {
      model: normaliseModel(parsed.model),
      presetId: asPresetId(parsed.presetId),
    };
  } catch {
    // Storage can be blocked or hold something else under the key.
    return null;
  }
}

function writeSaved(saved: Saved): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch {
    // Private windows and full storage: the page works without autosave.
  }
}

function encodedInHash(): string | null {
  const { hash } = window.location;
  return hash.startsWith(HASH_PREFIX) ? hash.slice(HASH_PREFIX.length) : null;
}

/** Takes a model out of the address without adding a history entry. */
function clearHash(): void {
  const { pathname, search } = window.location;
  window.history.replaceState(null, "", `${pathname}${search}`);
}

/**
 * Forgets the model this browser would load next: the saved one and one in
 * the address. The way out when a model keeps stopping the page, since it
 * would otherwise come back on every visit.
 */
export function forgetSavedModel(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage that cannot be reached holds no model to come back.
  }
  if (encodedInHash() !== null) clearHash();
}

/** The link a person shares: this page with the model after the #. */
export async function shareLink(model: Model): Promise<string> {
  const origin = "https://www.blockconsult.org"; const { pathname } = window.location;
  return `${origin}${pathname}${HASH_PREFIX}${await encodeModel(model)}`;
}

/** The text of a downloadable model file. */
export function modelFileText(model: Model): string {
  return `${JSON.stringify(model, null, 2)}\n`;
}

/** Read a model file. Null when it is not one. */
export async function readModelFile(file: File): Promise<Model | null> {
  if (file.size > MAX_FILE_BYTES) return null;
  try {
    const parsed: unknown = JSON.parse(await file.text());
    // normaliseModel turns anything into a valid model, so check first that
    // the file looks like one: a random JSON file must not load as defaults.
    if (!isRecord(parsed) || !Array.isArray(parsed.allocations)) return null;
    return normaliseModel(parsed);
  } catch {
    return null;
  }
}

interface Options {
  model: Model;
  presetId: PresetId | null;
  dispatch: Dispatch<SimulatorAction>;
  /** Called with what happened to a model found in the address. */
  onLink: (notice: LinkNotice) => void;
  /** Called when the saved model has been put in place. */
  onRestore: () => void;
}

/**
 * Loads the model on first render and keeps the browser's copy current.
 *
 * Load order: the saved model first, then a model in the address on top of
 * it. A shared model therefore arrives as an ordinary replacement, and Undo
 * brings back what the person had before they opened the link.
 *
 * A model from a link stays in the address and out of storage until it is
 * edited. Someone who only looks at a shared model keeps their own in the
 * browser, and a reload shows the shared one again. The first edit makes it
 * theirs: it is saved, and the address is cleared so a reload shows the
 * edits and not the link's model.
 */
export function useSavedModel({
  model,
  presetId,
  dispatch,
  onLink,
  onRestore,
}: Options): void {
  const [loaded, setLoaded] = useState(false);
  /** The model the last link put in place. The store holds that same object
   *  until the first edit replaces it. */
  const fromLink = useRef<Model | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadLink = async (first: boolean) => {
      const encoded = encodedInHash();
      const linked = await (encoded ? decodeModel(encoded) : null);
      if (cancelled) return;

      if (first) {
        const saved = readSaved();
        if (saved) {
          dispatch({ type: "restore", ...saved });
          onRestore();
        }
        setLoaded(true);
      }
      if (encoded === null) return;

      if (linked) {
        fromLink.current = linked;
        dispatch({ type: "replace", model: linked, presetId: null });
        onLink("linkLoaded");
      } else {
        // Nothing to come back to, so the address is cleaned up at once.
        clearHash();
        onLink("linkInvalid");
      }
    };

    void loadLink(true);
    // A link pasted into the address bar of the open page changes only the
    // hash, which does not reload the page.
    const onHashChange = () => void loadLink(false);
    window.addEventListener("hashchange", onHashChange);
    return () => {
      cancelled = true;
      window.removeEventListener("hashchange", onHashChange);
    };
  }, [dispatch, onLink, onRestore]);

  useEffect(() => {
    // Saving before the load has finished would overwrite the saved model
    // with the default one.
    if (!loaded || model === fromLink.current) return;
    // From here the model is the person's own. A model still in the address
    // is the one they started from, and no longer the one on screen.
    fromLink.current = null;
    if (encodedInHash() !== null) clearHash();
    const timer = window.setTimeout(
      () => writeSaved({ model, presetId }),
      SAVE_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [loaded, model, presetId]);
}
