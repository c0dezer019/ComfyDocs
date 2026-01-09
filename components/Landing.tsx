import React from 'react';
import { Sparkles, FileJson, Share2, ScanEye, Bot, Lock, ArrowRight, Target } from 'lucide-react';

interface LandingProps {
  onGetStarted: () => void;
}

export const Landing: React.FC<LandingProps> = ({ onGetStarted }) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 md:py-20 animate-in fade-in duration-700">
      
      {/* Hero Section */}
      <div className="text-center max-w-5xl mx-auto px-4 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-600/20 rounded-full blur-[100px] -z-10 pointer-events-none"></div>
        
        <div className="inline-flex items-center justify-center p-2 mb-8 bg-slate-900/50 border border-indigo-500/30 rounded-full shadow-lg backdrop-blur-md ring-1 ring-white/10 px-4 py-1.5 animate-in slide-in-from-bottom-2 duration-700 delay-100">
          <Sparkles className="w-4 h-4 text-indigo-400 mr-2" />
          <span className="text-xs sm:text-sm font-medium text-indigo-200">New: Multi-Pass Forensic Analysis</span>
        </div>

        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-white mb-8 leading-tight animate-in slide-in-from-bottom-3 duration-700 delay-200">
          The Forensic Tool for <br className="hidden md:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-400 to-sky-400">
            ComfyUI Generations
          </span>
        </h1>
        
        <p className="text-lg md:text-xl text-slate-400 mb-10 leading-relaxed max-w-3xl mx-auto font-light animate-in slide-in-from-bottom-4 duration-700 delay-300">
          Drag and drop any ComfyUI PNG to instantly recover workflow data, visualize node graphs, 
          and perform AI-powered quality assurance with pixel-perfect precision.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-in slide-in-from-bottom-5 duration-700 delay-500">
            <button
            onClick={onGetStarted}
            className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full font-bold text-lg transition-all shadow-xl shadow-indigo-500/20 hover:shadow-indigo-500/40 hover:-translate-y-1 w-full sm:w-auto"
            >
            Analyze Image
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-24 px-4 w-full max-w-7xl animate-in fade-in duration-1000 delay-700">
        
        <FeatureCard 
          icon={<FileJson className="w-6 h-6 text-emerald-400" />}
          title="Metadata Recovery"
          desc="Extract embedded workflow JSON, prompts, seeds, and model hashes instantly. Works locally."
        />
        
        <FeatureCard 
          icon={<Share2 className="w-6 h-6 text-sky-400" />}
          title="Node Graph Visualization"
          desc="Reconstruct and explore the original ComfyUI node graph. Trace data flow and inspect parameters."
        />

        <FeatureCard 
          icon={<ScanEye className="w-6 h-6 text-rose-400" />}
          title="AI Forensic Audit"
          desc="Deep pixel-level analysis using Gemini 1.5 Pro to detect artifacts, anatomical errors, and lighting issues."
        />

        <FeatureCard 
          icon={<Bot className="w-6 h-6 text-violet-400" />}
          title="Interactive Q&A"
          desc="Chat with your image. Ask the AI to critique composition, suggest fixes, or explain technical details."
        />

        <FeatureCard 
          icon={<Target className="w-6 h-6 text-amber-400" />}
          title="Consensus Scoring"
          desc="Run multiple parallel analysis passes to generate a high-confidence quality score and reduce hallucinations."
        />

        <FeatureCard 
          icon={<Lock className="w-6 h-6 text-slate-400" />}
          title="Secure Encryption"
          desc="Your API keys are encrypted with a personal password and stored locally (BYOK). Zero server-side data retention."
        />

      </div>
    </div>
  );
};

const FeatureCard = ({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) => (
  <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 hover:border-indigo-500/30 hover:bg-slate-900/60 transition-all group hover:-translate-y-1">
    <div className="mb-4 p-3 bg-slate-950 rounded-xl inline-block border border-slate-800 group-hover:border-slate-700 transition-colors shadow-lg">
      {icon}
    </div>
    <h3 className="text-lg font-bold text-slate-200 mb-2 group-hover:text-indigo-300 transition-colors">{title}</h3>
    <p className="text-slate-400 text-sm leading-relaxed">
      {desc}
    </p>
  </div>
);