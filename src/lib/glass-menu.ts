/** Pure geometry for the frosted context-menu highlight plate. The plate is
 *  neutral; item text keeps its own semantic colour. */

export type GlassMenuItemBox = { offsetTop: number; offsetHeight: number; left: number };
export type GlassPlateVars = { y: number; h: number; x: number };

export function glassPlateVars(item: GlassMenuItemBox | null, pointerX: number): GlassPlateVars {
  if (!item) return { y: 0, h: 0, x: 0 };
  return {
    y: item.offsetTop,
    h: item.offsetHeight,
    x: Math.max(0, Math.min(10, pointerX - item.left - 12)),
  };
}
