/**
 * Pattern fan geometry and the touch stepper – both driven by the number of
 * patterns editors keep in the CMS (src/data/products.json).
 */
import { describe, expect, test } from "bun:test";
import products from "../src/data/products.json";
import { fanCard, fanStepper, fanStyle } from "../src/lib/pattern-fan";

describe("fan geometry", () => {
  test("six and eight cards keep the hand-tuned angles", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((i) => fanCard(i, 8).angle)).toEqual([-27, -20, -13, -6, 6, 13, 20, 27]);
    expect([0, 1, 2, 3, 4, 5].map((i) => fanCard(i, 6).angle)).toEqual([-27, -16, -6, 6, 16, 27]);
  });

  test("any other count is symmetric, spread 0 → 1, within ±27°", () => {
    for (const count of [1, 2, 3, 5, 7, 9, 12]) {
      const cards = Array.from({ length: count }, (_, i) => fanCard(i, count));
      for (const [i, card] of cards.entries()) {
        const mirror = cards[count - 1 - i];
        expect(card.angle).toBe(-mirror.angle || 0);
        expect(Math.abs(card.angle)).toBeLessThanOrEqual(27);
        expect(card.spread).toBeGreaterThanOrEqual(0);
        expect(card.spread).toBeLessThanOrEqual(1);
      }
      if (count > 1) {
        expect(cards[0].spread).toBe(0);
        expect(cards.at(-1)!.spread).toBe(1);
      }
    }
  });

  test("style string carries the custom properties effects.css needs", () => {
    const style = fanStyle(2, 6);
    for (const prop of ["--fan-t:", "--fan-edge:", "--fan-angle:", "--fan-lift:", "z-index:"]) {
      expect(style).toContain(prop);
    }
  });
});

describe("touch stepper", () => {
  test("one step per card, starting on the middle card", () => {
    expect(fanStepper(8)).toEqual({ show: true, min: 0, max: 7, value: 3 });
    expect(fanStepper(6)).toEqual({ show: true, min: 0, max: 5, value: 2 });
    expect(fanStepper(5).value).toBe(2);
  });

  test("hidden for a single card or an empty list", () => {
    expect(fanStepper(1).show).toBe(false);
    expect(fanStepper(0)).toMatchObject({ show: false, max: 0, value: 0 });
  });

  test("follows the CMS lists (stone and mineral)", () => {
    for (const list of [products.items, products.mineral]) {
      const stepper = fanStepper(list.length);
      expect(stepper.max).toBe(list.length - 1);
      expect(stepper.value).toBe(Math.floor((list.length - 1) / 2));
    }
  });
});
