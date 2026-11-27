import { describe, expect, test } from "bun:test";
import { glassPlateVars } from "../src/lib/glass-menu";

describe("glass menu plate", () => {
  test("anchors the plate to the active item", () => {
    expect(glassPlateVars({ offsetTop: 42, offsetHeight: 32, left: 100 }, 118)).toEqual({ y: 42, h: 32, x: 6 });
  });

  test("clamps horizontal drift so the plate stays inside the item", () => {
    expect(glassPlateVars({ offsetTop: 0, offsetHeight: 30, left: 100 }, 80).x).toBe(0);
    expect(glassPlateVars({ offsetTop: 0, offsetHeight: 30, left: 100 }, 200).x).toBe(10);
  });

  test("keeps zero height until a pointer is over an item", () => {
    expect(glassPlateVars(null, 120)).toEqual({ y: 0, h: 0, x: 0 });
  });
});
