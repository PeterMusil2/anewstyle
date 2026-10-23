/**
 * Pattern fan (Products section) – geometry for the cards and the touch
 * stepper under each fan. The number of cards comes from the CMS lists in
 * src/data/products.json, so everything here must work for any count.
 */

// Six and eight cards keep their hand-tuned angles and lifts; any other count
// follows the same curve.
const FAN_TABLES: Record<number, { angles: number[]; lifts: number[] }> = {
  8: { angles: [-27, -20, -13, -6, 6, 13, 20, 27], lifts: [28, 16, 7, 0, 0, 7, 16, 28] },
  6: { angles: [-27, -16, -6, 6, 16, 27], lifts: [28, 7, 0, 0, 7, 28] },
};

export interface FanCard {
  /** Even spread 0 → 1 across the fan (effects.css narrows it to fit the screen). */
  spread: number;
  angle: number;
  lift: number;
  /** Designed outer position in % of the list width. */
  edge: number;
}

/** Rounds half away from zero, so mirrored cards get mirrored angles. */
const roundSymmetric = (value: number) => Math.sign(value) * Math.round(Math.abs(value)) || 0;

export function fanCard(index: number, count: number): FanCard {
  const spread = count > 1 ? index / (count - 1) : 0.5;
  const offset = spread * 2 - 1; // -1 (left) … 1 (right)
  return {
    spread,
    angle: FAN_TABLES[count]?.angles[index] ?? roundSymmetric(offset * 27),
    lift: FAN_TABLES[count]?.lifts[index] ?? Math.round(28 * offset * offset),
    edge: count >= 8 ? 14 : 17,
  };
}

/** Mineral pattern name: the CMS title, or "<label> <n>" when it is empty. */
export const mineralPatternTitle = (title: string | undefined, index: number, label: string): string =>
  title?.trim() || `${label} ${index + 1}`;

/** Inline custom properties for one card `<li>`. */
export function fanStyle(index: number, count: number): string {
  const card = fanCard(index, count);
  return `--fan-t:${card.spread}; --fan-edge:${card.edge}cqi; --fan-angle:${card.angle}deg; --fan-lift:${card.lift}px; z-index:${index + 1}`;
}

/**
 * Stepper label split into lines after each comma ("Posunutím vyberete
 * dekor," / "kliknutím zobrazíte v AR"); the comma stays on its line.
 */
export function stepperLabelLines(label: string): string[] {
  return label
    .split(/(?<=,)\s*/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Touch stepper (input type=range) under a fan: one step per card, starting
 * on the middle card. Not shown for a single card – nothing to browse.
 */
export function fanStepper(count: number) {
  return {
    show: count > 1,
    min: 0,
    max: Math.max(0, count - 1),
    value: Math.max(0, Math.floor((count - 1) / 2)),
  };
}
