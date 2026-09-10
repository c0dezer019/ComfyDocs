/**
 * Pure geometric calculation utilities for image annotations
 */

/**
 * Convert screen coordinates to normalized image coordinates (0-1 range)
 */
export function screenToNormalized(
  clientX: number,
  clientY: number,
  imgRect: DOMRect,
): { x: number; y: number } {
  const x = (clientX - imgRect.left) / imgRect.width;
  const y = (clientY - imgRect.top) / imgRect.height;

  return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
}

/**
 * Calculate normalized bounding box from start/end points during creation
 */
export function calculateCreationBox(
  start: { x: number; y: number },
  end: { x: number; y: number },
): { ymin: number; xmin: number; ymax: number; xmax: number } {
  return {
    ymin: Math.min(start.y, end.y),
    xmin: Math.min(start.x, end.x),
    ymax: Math.max(start.y, end.y),
    xmax: Math.max(start.x, end.x),
  };
}

/**
 * Calculate viewport transform to focus on an annotation
 */
export function calculateFocusViewport(
  box: [number, number, number, number],
  layoutW: number,
  layoutH: number,
): { scale: number; position: { x: number; y: number } } {
  const [ymin, xmin, ymax, xmax] = box;

  const centerX = (xmin + xmax) / 2;
  const centerY = (ymin + ymax) / 2;
  const boxW = xmax - xmin;
  const boxH = ymax - ymin;

  let targetScale = Math.min(0.4 / boxW, 0.4 / boxH);
  targetScale = Math.max(1.5, Math.min(8, targetScale));

  const offsetX = (0.5 - centerX) * layoutW * targetScale;
  const offsetY = (0.5 - centerY) * layoutH * targetScale;

  return {
    scale: targetScale,
    position: { x: offsetX, y: offsetY },
  };
}

/**
 * Calculate leader line points for annotation label positioning
 * Returns all coordinate points needed to render the leader line and position the label
 */
export function calculateLeaderLinePoints(
  box: [number, number, number, number],
  imgDims: { w: number; h: number },
  labelRotation: number = 0,
  isRightSide: boolean,
): {
  originX: number;
  originY: number;
  destX: number;
  destY: number;
  shoulderEndX: number;
  textX: number;
  dirX: number;
  dirY: number;
} {
  const [ymin, xmin, ymax, xmax] = box;
  const width = (xmax - xmin) * imgDims.w;
  const height = (ymax - ymin) * imgDims.h;
  const x = xmin * imgDims.w;
  const y = ymin * imgDims.h;

  const leaderLength = Math.max(imgDims.w, imgDims.h) * 0.05;
  const shoulderLength = Math.max(imgDims.w, imgDims.h) * 0.02;
  const labelPadding = Math.max(imgDims.w, imgDims.h) * 0.01;

  // Box center and half-dimensions
  const cx = x + width / 2;
  const cy = y + height / 2;
  const hw = width / 2;
  const hh = height / 2;

  // Rotation angle determines where on perimeter the leader attaches
  const baseAngle = isRightSide ? 135 : 45; // degrees from up
  const angle = baseAngle + labelRotation;
  const angleRad = (angle * Math.PI) / 180;

  // Direction vector (pointing outward from center)
  const dirX = Math.sin(angleRad);
  const dirY = -Math.cos(angleRad);

  // Find intersection of ray from center with box perimeter
  let t: number;
  if (Math.abs(dirX) < 0.0001) {
    t = hh / Math.abs(dirY);
  } else if (Math.abs(dirY) < 0.0001) {
    t = hw / Math.abs(dirX);
  } else {
    const tx = hw / Math.abs(dirX);
    const ty = hh / Math.abs(dirY);
    t = Math.min(tx, ty);
  }

  // Origin is on the box perimeter
  const originX = cx + dirX * t;
  const originY = cy + dirY * t;

  // Leader extends outward in the same direction
  const destX = originX + dirX * leaderLength;
  const destY = originY + dirY * leaderLength;

  // Shoulder extends horizontally from dest (always horizontal for readability)
  const shoulderEndX = dirX < 0 ? destX - shoulderLength : destX + shoulderLength;
  const textX = dirX < 0 ? shoulderEndX - labelPadding : shoulderEndX + labelPadding;

  return {
    originX,
    originY,
    destX,
    destY,
    shoulderEndX,
    textX,
    dirX,
    dirY,
  };
}

export interface AnnotationLabelPlacement {
  isRightSide: boolean;
  rotation: number;
  originX: number;
  originY: number;
  destX: number;
  destY: number;
  shoulderEndX: number;
  textX: number;
  dirX: number;
  dirY: number;
  labelBounds: { left: number; top: number; right: number; bottom: number };
}

type LabelPlacementInput = {
  box: [number, number, number, number];
  label: string;
  labelRotation?: number;
};

type Bounds = { left: number; top: number; right: number; bottom: number };

const rectanglesOverlap = (a: Bounds, b: Bounds, padding = 0): boolean =>
  a.left < b.right + padding &&
  a.right > b.left - padding &&
  a.top < b.bottom + padding &&
  a.bottom > b.top - padding;

/**
 * Pick a label position that does not cover another annotation or a label
 * that has already been placed. SVG text has no layout box, so we use a
 * conservative monospace estimate for collision testing.
 */
export function calculateAnnotationLabelPlacements(
  annotations: LabelPlacementInput[],
  imgDims: { w: number; h: number },
): AnnotationLabelPlacement[] {
  const maxDimension = Math.max(imgDims.w, imgDims.h);
  const fontSize = maxDimension * 0.02;
  const labelHeight = fontSize * 1.5;
  const collisionPadding = maxDimension * 0.008;
  const annotationBounds: Bounds[] = annotations.map(({ box }) => {
    const [ymin, xmin, ymax, xmax] = box;
    return {
      left: xmin * imgDims.w,
      top: ymin * imgDims.h,
      right: xmax * imgDims.w,
      bottom: ymax * imgDims.h,
    };
  });

  const placedLabels: Bounds[] = [];

  return annotations.map((annotation, index) => {
    const [ymin, xmin, ymax, xmax] = annotation.box;
    const centerX = (xmin + xmax) / 2;
    const preferredRightSide = centerX > 0.5;
    const requestedRotation = annotation.labelRotation ?? 0;
    const textWidth = Math.max(fontSize * 2, annotation.label.length * fontSize * 0.63);
    const candidates = [
      { isRightSide: preferredRightSide, rotation: requestedRotation, preference: 0 },
      { isRightSide: !preferredRightSide, rotation: requestedRotation, preference: 1 },
      { isRightSide: preferredRightSide, rotation: 0, preference: 2 },
      { isRightSide: preferredRightSide, rotation: 55, preference: 3 },
      { isRightSide: preferredRightSide, rotation: -55, preference: 3 },
      { isRightSide: !preferredRightSide, rotation: 0, preference: 4 },
      { isRightSide: !preferredRightSide, rotation: 55, preference: 5 },
      { isRightSide: !preferredRightSide, rotation: -55, preference: 5 },
      { isRightSide: preferredRightSide, rotation: 110, preference: 6 },
      { isRightSide: !preferredRightSide, rotation: -110, preference: 7 },
    ];

    const annotationCandidates = annotationBounds.filter(
      (_, candidateIndex) => candidateIndex !== index,
    );
    const scored = candidates.map((candidate) => {
      const points = calculateLeaderLinePoints(
        annotation.box,
        imgDims,
        candidate.rotation,
        candidate.isRightSide,
      );
      const left = candidate.isRightSide ? points.textX - textWidth : points.textX;
      const bounds: Bounds = {
        left,
        top: points.destY - labelHeight / 2,
        right: left + textWidth,
        bottom: points.destY + labelHeight / 2,
      };
      const boundaryCollisions = annotationCandidates.filter((other) =>
        rectanglesOverlap(bounds, other, collisionPadding),
      ).length;
      const labelCollisions = placedLabels.filter((other) =>
        rectanglesOverlap(bounds, other, collisionPadding),
      ).length;
      const outsideImage =
        Math.max(0, -bounds.left) +
        Math.max(0, -bounds.top) +
        Math.max(0, bounds.right - imgDims.w) +
        Math.max(0, bounds.bottom - imgDims.h);

      return {
        ...candidate,
        points,
        bounds,
        score:
          boundaryCollisions * 10000 +
          labelCollisions * 5000 +
          outsideImage * 10 +
          candidate.preference,
      };
    });

    scored.sort((a, b) => a.score - b.score);
    const best = scored[0];
    placedLabels.push(best.bounds);

    return {
      ...best.points,
      isRightSide: best.isRightSide,
      rotation: best.rotation,
      labelBounds: best.bounds,
    };
  });
}
