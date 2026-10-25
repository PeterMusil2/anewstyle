export interface ConstructionDiagramMarker {
  number: number;
  x: number;
  y: number;
}

/** Keeps a marker aligned with an image scaled around its center without scaling the marker itself. */
export function scaleConstructionMarkerPosition(value: number, scale: number): number {
  return 50 + (value - 50) * scale;
}

/** Recreates all six stone-diagram numbers in the same overlay style as the mineral diagram. */
export const stoneConstructionMarkers: readonly ConstructionDiagramMarker[] = [
  { number: 1, x: 97, y: 4 },
  { number: 2, x: 97, y: 30 },
  { number: 3, x: 97, y: 47 },
  { number: 4, x: 97, y: 59 },
  { number: 5, x: 50, y: 94 }, // aluminum frame along the lower edge
  { number: 6, x: 68, y: 83 }, // LED strip inside the frame
];

/** Layer callouts for the mineral diagram; all six labels are rendered over the image. */
export const mineralConstructionMarkers: readonly ConstructionDiagramMarker[] = [
  { number: 1, x: 89.83, y: 11.02 }, // mineral sheet; aligns with the stone diagram's upper-right callout
  { number: 2, x: 89.83, y: 33.05 }, // support plexiglass
  { number: 3, x: 89.83, y: 47.46 }, // light guide
  { number: 4, x: 89.83, y: 57.63 }, // reflector
  { number: 5, x: 50, y: 87.29 }, // aluminum frame
  { number: 6, x: 65.25, y: 77.97 }, // LED strip inside the frame
];
