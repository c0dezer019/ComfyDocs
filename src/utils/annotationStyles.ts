/**
 * Style calculation utilities for annotations
 */

/**
 * Determine annotation color based on state
 * Priority: selected (success) > hovered (accent) > focused (error) > default (info)
 */
export function getAnnotationColor(
  isSelected: boolean,
  isHovered: boolean,
  isFocused: boolean,
): string {
  if (isSelected) return 'var(--color-status-success)';
  if (isHovered) return 'var(--color-accent)';
  if (isFocused) return 'var(--color-status-error)';
  return 'var(--color-status-info)';
}

/**
 * Determine stroke width based on state
 */
export function getStrokeWidth(isSelected: boolean, isHovered: boolean): number {
  if (isSelected) return 3;
  if (isHovered) return 2.5;
  return 2;
}
