'use client';

import React from 'react';
import { LucideIcon, Loader2 } from 'lucide-react';

export interface SectionCardProps {
  /** Icon component from lucide-react */
  icon: LucideIcon;
  /** Main title text */
  title: string;
  /** Small subtitle/description */
  subtitle?: string;
  /** Tailwind color class for icon container (e.g., 'bg-accent-subtle text-status-info ring-accent/30') */
  iconColorClass: string;
  /** Show loading spinner instead of icon */
  isLoading?: boolean;
  /** Optional right-side header content */
  headerRight?: React.ReactNode;
  /** Show bottom border on header */
  showHeaderBorder?: boolean;
  /** Additional className for the section */
  className?: string;
  /** Children content */
  children: React.ReactNode;
}

/**
 * Reusable semantic panel with consistent heading and content spacing.
 */
export const SectionCard: React.FC<SectionCardProps> = ({
  icon: Icon,
  title,
  subtitle,
  iconColorClass,
  isLoading = false,
  headerRight,
  showHeaderBorder = false,
  className = '',
  children,
}) => {
  // Parse color classes for ring
  const ringClass = iconColorClass.includes('ring-')
    ? iconColorClass.split(' ').find((c) => c.startsWith('ring-'))
    : '';
  const bgTextClasses = iconColorClass
    .split(' ')
    .filter((c) => !c.startsWith('ring-'))
    .join(' ');

  return (
    <section
      className={`rounded-card border border-border bg-surface p-6 shadow-card sm:p-8 ${className}`}
    >
      <div
        className={`flex flex-wrap items-start gap-4 ${showHeaderBorder ? 'mb-8 border-b border-border pb-6' : 'mb-6'}`}
      >
        <div className="flex items-center gap-4">
          <div className={`rounded-icon p-3 ring-1 ${bgTextClasses} ${ringClass}`}>
            {isLoading ? <Loader2 size={24} className="animate-spin" /> : <Icon size={24} />}
          </div>
          <div>
            <h2 className="font-heading text-2xl font-semibold tracking-tight text-text">
              {title}
            </h2>
            {subtitle && <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>}
          </div>
        </div>
        {headerRight && (
          <div className="ml-auto max-w-full basis-full sm:basis-auto sm:shrink-0">
            {headerRight}
          </div>
        )}
      </div>
      {children}
    </section>
  );
};

export interface LoadingPlaceholderProps {
  /** Text to display while loading */
  text: string;
  /** Color class for the spinner */
  spinnerColorClass?: string;
}

/**
 * Reusable loading placeholder for sections.
 */
export const LoadingPlaceholder: React.FC<LoadingPlaceholderProps> = ({
  text,
  spinnerColorClass = 'text-status-info',
}) => (
  <div className="flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-border bg-surface-muted py-12 text-text-secondary">
    <Loader2 size={32} className={`animate-spin ${spinnerColorClass}`} />
    <p className="text-sm font-medium">{text}</p>
  </div>
);

export interface ScoreDisplayProps {
  /** Label text (e.g., 'Score', 'Adherence') */
  label: string;
  /** The score value */
  score: number;
  /** Max score (shown as /max) */
  maxScore?: number;
  /** Color class function result */
  colorClass: string;
}

/**
 * Reusable score display badge.
 */
export const ScoreDisplay: React.FC<ScoreDisplayProps> = ({
  label,
  score,
  maxScore = 10,
  colorClass,
}) => (
  <div className="flex items-center gap-4 rounded-card border border-border bg-surface-muted px-4 py-2.5">
    <span className="text-sm font-medium text-text-secondary">{label}</span>
    <span className={`text-xl font-semibold ${colorClass}`}>
      {score}
      <span className="ml-0.5 text-xs text-text-secondary">/{maxScore}</span>
    </span>
  </div>
);
