/**
 * Shared style utility functions for consistent styling across components.
 * Centralizes color logic to avoid repetition (DRY principle).
 */

export const getSeverityColor = (severity: string): string => {
  switch (severity.toLowerCase()) {
    case 'critical':
      return 'border-status-error/20 bg-status-error/10 text-status-error';
    case 'major':
      return 'border-status-error/20 bg-status-error/10 text-status-error';
    case 'minor':
      return 'border-status-warning/20 bg-status-warning/10 text-status-warning';
    case 'note':
      return 'border-status-info/20 bg-status-info/10 text-status-info';
    default:
      return 'border-border bg-surface-muted text-text-secondary';
  }
};

export const getScoreColor = (score: number): string => {
  if (score >= 8) return 'text-status-success';
  if (score >= 5) return 'text-status-warning';
  return 'text-status-error';
};

export const getConfidenceColor = (conf: number | undefined): string => {
  if (!conf) return 'border-border bg-surface-muted text-text-secondary';
  if (conf >= 80) return 'border-status-success/20 bg-status-success/10 text-status-success';
  if (conf >= 50) return 'border-status-warning/20 bg-status-warning/10 text-status-warning';
  return 'border-status-error/20 bg-status-error/10 text-status-error';
};

/**
 * Calculate quality score from issues array.
 * Penalties are summed and subtracted from 10.
 */
export const calculateScore = (issues: { score: number }[]): number => {
  const penalties = issues.reduce((acc, issue) => acc + issue.score, 0);
  return Math.round(Math.max(0, Math.min(10, 10 - penalties)) * 10) / 10;
};
