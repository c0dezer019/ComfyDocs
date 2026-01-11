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
  /** Tailwind color class for icon container (e.g., 'bg-indigo-500/10 text-indigo-400 ring-indigo-500/20') */
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
 * Reusable section card component with consistent styling.
 * Provides a glass-card appearance with icon, title, subtitle, and content area.
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
    ? iconColorClass.split(' ').find(c => c.startsWith('ring-')) 
    : '';
  const bgTextClasses = iconColorClass.split(' ').filter(c => !c.startsWith('ring-')).join(' ');

  return (
    <section className={`glass-card rounded-3xl p-8 relative group ${className}`}>
      <div className={`flex items-center justify-between ${showHeaderBorder ? 'mb-10 pb-6 border-b border-white/5' : 'mb-8'}`}>
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-2xl ring-1 ${bgTextClasses} ${ringClass}`}>
            {isLoading ? (
              <Loader2 size={24} className="animate-spin" />
            ) : (
              <Icon size={24} />
            )}
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">
              {title}
            </h2>
            {subtitle && (
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mt-1">
                {subtitle}
              </div>
            )}
          </div>
        </div>
        {headerRight}
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
  spinnerColorClass = 'text-indigo-500/50',
}) => (
  <div className="py-12 flex flex-col items-center justify-center text-slate-500 gap-3 border border-dashed border-white/5 rounded-2xl bg-white/5 animate-pulse">
    <Loader2 size={32} className={`animate-spin ${spinnerColorClass}`} />
    <p className="text-xs font-bold uppercase tracking-widest">{text}</p>
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
  <div className="bg-black/40 px-5 py-2.5 rounded-2xl border border-white/5 shadow-inner flex items-center gap-4">
    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
      {label}
    </span>
    <span className={`text-xl font-black ${colorClass}`}>
      {score}
      <span className="text-xs text-slate-600 ml-0.5">/{maxScore}</span>
    </span>
  </div>
);
