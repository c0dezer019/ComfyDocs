/**
 * Shared style utility functions for consistent styling across components.
 * Centralizes color logic to avoid repetition (DRY principle).
 */

export const getSeverityColor = (severity: string): string => {
  switch (severity.toLowerCase()) {
    case 'critical':
      return 'bg-red-500/10 text-red-400 border-red-500/20';
    case 'major':
      return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
    case 'minor':
      return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
    case 'note':
      return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    default:
      return 'bg-slate-800 text-slate-400';
  }
};

export const getScoreColor = (score: number): string => {
  if (score >= 8) return 'text-emerald-400';
  if (score >= 5) return 'text-yellow-400';
  return 'text-red-400';
};

export const getConfidenceColor = (conf: number | undefined): string => {
  if (!conf) return 'text-slate-400 bg-slate-800';
  if (conf >= 80) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
  if (conf >= 50) return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
  return 'text-red-400 bg-red-500/10 border-red-500/20';
};

/**
 * Calculate quality score from issues array.
 * Penalties are summed and subtracted from 10.
 */
export const calculateScore = (issues: { score: number }[]): number => {
  const penalties = issues.reduce((acc, issue) => acc + issue.score, 0);
  return Math.round(Math.max(0, Math.min(10, 10 - penalties)) * 10) / 10;
};
