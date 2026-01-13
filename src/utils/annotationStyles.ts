/**
 * Style calculation utilities for annotations
 */

/**
 * Determine annotation color based on state
 * Priority: selected (green) > hovered (cyan) > focused (rose) > default (indigo)
 */
export function getAnnotationColor(
  isSelected: boolean,
  isHovered: boolean,
  isFocused: boolean,
): string {
  if (isSelected) return '#10b981'; // green
  if (isHovered) return '#22d3d8'; // cyan
  if (isFocused) return '#f43f5e'; // rose
  return '#6366f1'; // indigo
}

/**
 * Determine stroke width based on state
 */
export function getStrokeWidth(isSelected: boolean, isHovered: boolean): number {
  if (isSelected) return 3;
  if (isHovered) return 2.5;
  return 2;
}
