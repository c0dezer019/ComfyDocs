'use client';

import React from 'react';
import {
  ArrowRight,
  Bot,
  Cpu,
  Database,
  FileJson,
  Lock,
  ScanEye,
  ScrollText,
  Share2,
  Sparkles,
} from 'lucide-react';
import { assetPath } from '@/lib/assetPath';

interface LandingProps {
  onGetStarted: () => void;
  onTryDemo: () => void;
  demoUrl?: string;
}

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  desc: string;
}

export const Landing: React.FC<LandingProps> = ({ onGetStarted, onTryDemo, demoUrl: _demoUrl }) => {
  return (
    <div className="mx-auto w-full max-w-[var(--page-max-width)] py-12 sm:py-16 lg:py-24">
      <section className="grid gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center lg:gap-16">
        <div className="max-w-2xl">
          <p className="mb-5 text-sm font-medium text-text-secondary">
            ComfyUI forensic documentation
          </p>
          <h1 className="max-w-xl font-heading text-4xl font-semibold leading-[1.08] tracking-tight text-text sm:text-5xl lg:text-6xl">
            The forensic tool for{' '}
            <span className="bg-accent-subtle px-1 text-text">ComfyUI generations</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-text-secondary sm:text-lg sm:leading-8">
            Recover workflow data, visualize node graphs, and perform AI-powered forensic audits
            with pixel-perfect precision.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onTryDemo}
              className="inline-flex items-center justify-center gap-2 rounded-button bg-accent px-5 py-3 text-sm font-semibold text-text transition-colors hover:bg-accent-hover"
            >
              Try interactive demo
              <ArrowRight className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onGetStarted}
              className="inline-flex items-center justify-center rounded-button border border-border bg-surface px-5 py-3 text-sm font-semibold text-text transition-colors hover:border-accent hover:text-status-info"
            >
              Upload your PNG
            </button>
          </div>
        </div>

        <div className="rounded-feature border border-border bg-surface p-2 shadow-preview">
          <div className="relative overflow-hidden rounded-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={assetPath('/demo2.png')}
              alt="Forensic sample: red-headed guitarist showing quality 0.8/10 and prompt adherence 7.5/10"
              className="aspect-[16/9] h-full w-full object-cover"
            />
          </div>
          <div className="grid gap-4 px-4 pb-4 pt-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <div>
              <p className="text-sm font-medium text-text">
                Live sample scan: Red-headed Guitarist
              </p>
              <p className="mt-1 text-sm leading-6 text-text-secondary">
                Inspect the recovered workflow, documentation, and quality findings in context.
              </p>
            </div>
            <button
              type="button"
              onClick={onTryDemo}
              className="rounded-button border border-border px-4 py-2 text-sm font-medium text-text transition-colors hover:border-accent hover:text-status-info"
            >
              Open sample
            </button>
          </div>
        </div>
      </section>

      <section className="mt-20 sm:mt-24" aria-labelledby="capabilities-heading">
        <div className="max-w-2xl">
          <h2
            id="capabilities-heading"
            className="font-heading text-3xl font-semibold tracking-tight text-text"
          >
            Built for forensic visibility
          </h2>
          <p className="mt-3 text-base leading-7 text-text-secondary">
            Bring the technical evidence behind a generation into one readable record.
          </p>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={<FileJson className="size-5" aria-hidden="true" />}
            title="Metadata Recovery"
            desc="Instantly extract workflow JSON, prompts, seeds, and model hashes from embedded PNG chunks."
          />
          <FeatureCard
            icon={<Share2 className="size-5" aria-hidden="true" />}
            title="Interactive Topology"
            desc="Visualize the original ComfyUI node graph. Trace every parameter and link with our custom engine."
          />
          <FeatureCard
            icon={<ScanEye className="size-5" aria-hidden="true" />}
            title="Deep Pixel Forensics"
            desc="Identify anatomical defects and artifacts with pixel-level precision using Gemini Flash & Pro."
          />
          <FeatureCard
            icon={<Bot className="size-5" aria-hidden="true" />}
            title="Analysis Assistant"
            desc="Directly interrogate the AI about your generation. Ask for fixes, critiques, or technical detail."
          />
          <FeatureCard
            icon={<ScrollText className="size-5" aria-hidden="true" />}
            title="Embedded Reports"
            desc="Generate forensic PDF reports and embed the analysis JSON back into the original PNG file."
          />
          <FeatureCard
            icon={<Lock className="size-5" aria-hidden="true" />}
            title="Secure BYOK"
            desc="Your API keys are AES-256 encrypted and stored locally. Privacy-first architecture."
          />
        </div>
      </section>

      <section
        className="mt-20 border-t border-border pt-8 sm:mt-24"
        aria-labelledby="stack-heading"
      >
        <h2 id="stack-heading" className="sr-only">
          Forensic stack
        </h2>
        <div className="flex flex-col gap-5 text-sm text-text-secondary sm:flex-row sm:flex-wrap sm:gap-x-10 sm:gap-y-4">
          <StackItem icon={<Cpu className="size-4" aria-hidden="true" />} label="Gemini 3.1 Pro" />
          <StackItem
            icon={<Database className="size-4" aria-hidden="true" />}
            label="IndexedDB Persistence"
          />
          <StackItem
            icon={<Sparkles className="size-4" aria-hidden="true" />}
            label="ComfyUI Native"
          />
        </div>
      </section>
    </div>
  );
};

const FeatureCard: React.FC<FeatureCardProps> = ({ icon, title, desc }) => (
  <article className="rounded-feature border border-border bg-surface p-6 shadow-subtle">
    <div className="mb-5 inline-flex rounded-icon bg-accent-subtle p-2 text-accent-hover">
      {icon}
    </div>
    <h3 className="font-heading text-xl font-semibold tracking-tight text-text">{title}</h3>
    <p className="mt-2 text-sm leading-6 text-text-secondary">{desc}</p>
  </article>
);

const StackItem: React.FC<{ icon: React.ReactNode; label: string }> = ({ icon, label }) => (
  <div className="flex items-center gap-2">
    <span className="text-accent-hover">{icon}</span>
    <span>{label}</span>
  </div>
);
