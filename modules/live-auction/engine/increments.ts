import type { IncrementRung, LotState } from "./types";

/** The bid step that applies at a given current price. */
export function incrementFor(currentCents: number, ladder: IncrementRung[]): number {
  for (const rung of ladder) {
    if (rung.upToCents === null || currentCents < rung.upToCents) {
      return rung.stepCents;
    }
  }
  return ladder.length ? ladder[ladder.length - 1].stepCents : 0;
}

/** The minimum acceptable next bid for a lot. */
export function askingPriceCents(state: LotState, ladder: IncrementRung[]): number {
  if (state.currentPriceCents === null) return state.startPriceCents;
  return state.currentPriceCents + incrementFor(state.currentPriceCents, ladder);
}
