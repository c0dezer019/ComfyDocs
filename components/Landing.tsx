import React from 'react';
import { Sparkles, FileJson, Zap, ShieldCheck, ArrowRight } from 'lucide-react';

interface LandingProps {
  onGetStarted: () => void;
}

export const Landing: React.FC<LandingProps> = ({ onGetStarted }) => {
  return (
    <div className="flex flex-col items-center justify-center py-8 md:py-12 animate-in fade-in duration-700">
      
      {/* Hero Section */}
      <div className="text-center max-w-4xl mx-auto px-4">
        <div className="inline-flex items-center justify-center p-3 mb-6 bg-slate-900/50 border border-slate-800 rounded-2xl shadow-xl backdrop-blur-sm ring-1 ring-white/5">
          <Sparkles className="w-8 h-8 text-indigo-400" />
        </div>

        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white mb-6 leading-tight">
          Your ComfyUI Workflow, <br className="hidden md:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-400">
            Decoded & Analyzed.
          </span>
        </h1>
        
        <p className="text-lg md:text-xl text-slate-400 mb-8 leading-relaxed max-w-2xl mx-auto">
          Extract hidden metadata, visualize node graphs, and use AI to audit image quality and prompt adherence—all from a single PNG.
        </p>

        <button
          onClick={onGetStarted}
          className="group relative inline-flex items-center gap-3 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full font-semibold text-lg transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-1"
        >
          Get Started
          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 px-4 w-full max-w-6xl">
        
        <FeatureCard 
          icon={<FileJson className="w-6 h-6 text-emerald-400" />}
          title="Metadata Extraction"
          desc="Instantly recover the full workflow JSON and parameters embedded in your generation. Never lose a seed again."
        />
        
        <FeatureCard 
          icon={<Zap className="w-6 h-6 text-amber-400" />}
          title="Workflow Visualization"
          desc="Interactive node graph visualization. Trace connections, inspect values, and understand the flow of data."
        />

        <FeatureCard 
          icon={<ShieldCheck className="w-6 h-6 text-rose-400" />}
          title="AI Quality Audit"
          desc="Powered by Gemini. Detect artifacts, anatomical errors, and get actionable suggestions to improve your prompts."
        />

      </div>
    </div>
  );
};

const FeatureCard = ({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) => (
  <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 hover:border-indigo-500/30 hover:bg-slate-900/60 transition-all group">
    <div className="mb-4 p-3 bg-slate-950 rounded-xl inline-block border border-slate-800 group-hover:border-slate-700 transition-colors">
      {icon}
    </div>
    <h3 className="text-lg font-bold text-slate-200 mb-2 group-hover:text-indigo-300 transition-colors">{title}</h3>
    <p className="text-slate-400 text-sm leading-relaxed">
      {desc}
    </p>
  </div>
);