'use client';

import React from 'react';
import {
  Sparkles,
  FileJson,
  Share2,
  ScanEye,
  Bot,
  Lock,
  ArrowRight,
  ScrollText,
  Database,
  Cpu,
} from 'lucide-react';

interface LandingProps {
  onGetStarted: () => void;
  onTryDemo: () => void;
  demoUrl?: string;
}

export const Landing: React.FC<LandingProps> = ({ onGetStarted, onTryDemo, demoUrl }) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 md:py-20 animate-in fade-in duration-700">
      {/* Hero Section */}
      <div className="text-center max-w-5xl mx-auto px-4 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-600/20 rounded-full blur-[100px] -z-10 pointer-events-none"></div>

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-widest mb-6 animate-in slide-in-from-top-2 duration-500">
          <Sparkles size={12} /> The Gold Standard for Stable Diffusion QA
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-white mb-8 leading-tight animate-in slide-in-from-bottom-3 duration-700 delay-200">
          The Forensic Tool for <br className="hidden md:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-400 to-sky-400">
            ComfyUI Generations
          </span>
        </h1>

        <p className="text-lg md:text-xl text-slate-400 mb-10 leading-relaxed max-w-3xl mx-auto font-light animate-in slide-in-from-bottom-4 duration-700 delay-300">
          Recover workflow data, visualize node graphs, and perform AI-powered forensic audits with
          pixel-perfect precision.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-in slide-in-from-bottom-5 duration-700 delay-500">
          <button
            onClick={onTryDemo}
            className="group relative inline-flex items-center justify-center gap-3 px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full font-bold text-lg transition-all shadow-xl shadow-indigo-500/20 hover:shadow-indigo-500/40 hover:-translate-y-1 w-full sm:w-auto overflow-hidden"
          >
            Try Interactive Demo
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
          <button
            onClick={onGetStarted}
            className="px-10 py-4 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-full font-bold text-lg transition-all w-full sm:w-auto"
          >
            Upload Your PNG
          </button>
        </div>
      </div>

      {/* NEW INTERACTIVE DEMO SECTION */}
      <div className="mt-32 w-full max-w-7xl px-4">
        <div className="flex flex-col items-center text-center mb-16">
          <h2 className="text-3xl font-bold text-white mb-4">Forensic Visibility</h2>
          <p className="text-slate-500 max-w-xl text-sm leading-relaxed uppercase tracking-widest font-black">
            Live sample scan: Red-headed Guitarist
          </p>
        </div>

        <div className="grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 relative">
            <div className="glass-card p-2 rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/10 relative group bg-black/40">
              <div className="aspect-[16/9] relative rounded-2xl overflow-hidden">
                <img
                  src="/demo2.png"
                  alt="Forensic Demo"
                  className="w-full h-full object-cover rounded-2xl opacity-90 group-hover:opacity-100 transition-opacity duration-700"
                />
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-6">
            <div className="p-8 bg-slate-900/50 border border-white/5 rounded-3xl backdrop-blur-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Bot size={40} />
              </div>
              <h4 className="text-xs font-black text-sky-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <Bot size={16} /> Analysis Assistant
              </h4>
              <div className="space-y-4">
                <div className="bg-indigo-600/20 p-3 rounded-xl rounded-tl-none border border-indigo-500/20 text-xs text-indigo-100">
                  &quot;What specific artifacts are in the background?&quot;
                </div>
                <div className="bg-white/5 p-4 rounded-xl rounded-tr-none border border-white/10 text-xs text-slate-300 leading-relaxed">
                  The plant in the window exhibits painterly textures with undefined leaves. The
                  side table is distorted and lacks discernible shapes.
                </div>
              </div>
              <button
                onClick={onTryDemo}
                className="w-full mt-6 py-3 bg-white/5 hover:bg-indigo-600 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all border border-white/10 uppercase tracking-widest"
              >
                Open Interactive Sample
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-6 bg-slate-900/50 border border-white/5 rounded-3xl">
                <div className="text-[10px] font-black text-slate-500 uppercase mb-1">
                  Quality Score
                </div>
                <div className="text-3xl font-black text-rose-400">
                  0.8<span className="text-xs text-slate-600">/10</span>
                </div>
              </div>
              <div className="p-6 bg-slate-900/50 border border-white/5 rounded-3xl">
                <div className="text-[10px] font-black text-slate-500 uppercase mb-1">
                  Adherence
                </div>
                <div className="text-3xl font-black text-indigo-400">
                  7.5<span className="text-xs text-slate-600">/10</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-32 px-4 w-full max-w-7xl">
        <FeatureCard
          icon={<FileJson className="w-6 h-6 text-emerald-400" />}
          title="Metadata Recovery"
          desc="Instantly extract workflow JSON, prompts, seeds, and model hashes from embedded PNG chunks."
        />
        <FeatureCard
          icon={<Share2 className="w-6 h-6 text-sky-400" />}
          title="Interactive Topology"
          desc="Visualize the original ComfyUI node graph. Trace every parameter and link with our custom engine."
        />
        <FeatureCard
          icon={<ScanEye className="w-6 h-6 text-rose-400" />}
          title="Deep Pixel Forensics"
          desc="Identify anatomical defects and artifacts with pixel-level precision using Gemini Flash & Pro."
        />
        <FeatureCard
          icon={<Bot className="w-6 h-6 text-violet-400" />}
          title="Analysis Assistant"
          desc="Directly interrogation the AI about your generation. Ask for fixes, critiques, or technical detail."
        />
        <FeatureCard
          icon={<ScrollText className="w-6 h-6 text-amber-400" />}
          title="Embedded Reports"
          desc="Generate forensic PDF reports and embed the analysis JSON back into the original PNG file."
        />
        <FeatureCard
          icon={<Lock className="w-6 h-6 text-slate-400" />}
          title="Secure BYOK"
          desc="Your API keys are AES-256 encrypted and stored locally. Privacy-first architecture."
        />
      </div>

      <div className="mt-32 w-full flex flex-col items-center gap-8 py-12 border-t border-white/5 opacity-50 grayscale hover:grayscale-0 hover:opacity-100 transition-all">
        <div className="text-[10px] font-black text-slate-600 uppercase tracking-[0.5em]">
          Forensic Stack
        </div>
        <div className="flex flex-wrap items-center justify-center gap-12">
          <div className="flex items-center gap-3">
            <Cpu size={24} className="text-slate-400" />
            <span className="font-bold text-slate-300">Gemini 3.0 Pro</span>
          </div>
          <div className="flex items-center gap-3">
            <Database size={24} className="text-slate-400" />
            <span className="font-bold text-slate-300">IndexedDB Persistence</span>
          </div>
          <div className="flex items-center gap-3">
            <Sparkles size={24} className="text-slate-400" />
            <span className="font-bold text-slate-300">ComfyUI Native</span>
          </div>
        </div>
      </div>


    </div>
  );
};

const FeatureCard = ({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) => (
  <div className="p-8 rounded-3xl bg-slate-900/40 border border-slate-800 hover:border-indigo-500/30 hover:bg-slate-900/60 transition-all group hover:-translate-y-1">
    <div className="mb-6 p-4 bg-slate-950 rounded-2xl inline-block border border-slate-800 group-hover:border-slate-700 transition-colors shadow-lg">
      {icon}
    </div>
    <h3 className="text-lg font-bold text-slate-200 mb-2 group-hover:text-indigo-300 transition-colors">
      {title}
    </h3>
    <p className="text-slate-400 text-sm leading-relaxed font-light">{desc}</p>
  </div>
);
