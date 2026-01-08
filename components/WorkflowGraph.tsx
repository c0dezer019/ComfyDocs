import React, { useRef, useEffect, useState } from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';

interface WorkflowGraphProps {
  workflow: any;
}

export const WorkflowGraph: React.FC<WorkflowGraphProps> = ({ workflow }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });

  const nodes = workflow.nodes || [];
  const links = workflow.links || [];

  // Handle Pan
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setLastPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - lastPos.x;
    const dy = e.clientY - lastPos.y;
    setTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
    setLastPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Handle Zoom: Attach non-passive listener to prevent page scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const scaleFactor = 0.1;
      
      setTransform(prev => {
         const updatedScale = e.deltaY > 0 
            ? Math.max(0.1, prev.scale - scaleFactor)
            : Math.min(5, prev.scale + scaleFactor);
         return { ...prev, scale: updatedScale };
      });
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    
    return () => {
        container.removeEventListener('wheel', onWheel);
    };
  }, []);

  // Auto-center logic
  useEffect(() => {
    if (nodes.length > 0 && containerRef.current) {
        // Calculate bounding box of nodes
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        nodes.forEach((n: any) => {
            const x = n.pos[0];
            const y = n.pos[1];
            // approximate size if not present
            const w = n.size ? (Array.isArray(n.size) ? n.size[0] : n.size.width) : 200;
            const h = n.size ? (Array.isArray(n.size) ? n.size[1] : n.size.height) : 100;
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x + w > maxX) maxX = x + w;
            if (y + h > maxY) maxY = y + h;
        });

        const containerW = containerRef.current.clientWidth;
        const containerH = containerRef.current.clientHeight;
        const contentW = maxX - minX;
        const contentH = maxY - minY;

        const scale = Math.min(containerW / (contentW + 100), containerH / (contentH + 100), 1);
        const x = (containerW - contentW * scale) / 2 - minX * scale;
        const y = (containerH - contentH * scale) / 2 - minY * scale;

        setTransform({ x, y, scale });
    }
  }, [workflow]);

  // Helper to generate Path d attribute
  const getLinkPath = (link: any) => {
     // link: [id, origin_id, origin_slot, target_id, target_slot, type]
     const originNode = nodes.find((n: any) => n.id === link[1]);
     const targetNode = nodes.find((n: any) => n.id === link[3]);
     
     if (!originNode || !targetNode) return '';

     // Basic slot calculation
     const originW = originNode.size ? (Array.isArray(originNode.size) ? originNode.size[0] : originNode.size.width) : 210;
     
     // Outputs are on the right
     const outSlotIdx = link[2];
     const outY = originNode.pos[1] + 40 + (outSlotIdx * 20); // Rough guess
     const startX = originNode.pos[0] + originW;
     const startY = outY;

     // Inputs are on the left
     const inSlotIdx = link[4];
     const inY = targetNode.pos[1] + 40 + (inSlotIdx * 20); // Rough guess
     const endX = targetNode.pos[0];
     const endY = inY;

     // Bezier
     const dist = Math.abs(endX - startX) * 0.5;
     return `M ${startX} ${startY} C ${startX + dist} ${startY} ${endX - dist} ${endY} ${endX} ${endY}`;
  };

  return (
    <div className="relative w-full h-[600px] bg-[#1a1a1a] rounded-xl overflow-hidden border border-slate-800 shadow-inner group">
      
      {/* Controls Overlay */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
        <button onClick={() => setTransform(t => ({...t, scale: t.scale + 0.1}))} className="p-2 bg-slate-800 rounded hover:bg-slate-700 text-white shadow"><ZoomIn size={16} /></button>
        <button onClick={() => setTransform(t => ({...t, scale: Math.max(0.1, t.scale - 0.1)}))} className="p-2 bg-slate-800 rounded hover:bg-slate-700 text-white shadow"><ZoomOut size={16} /></button>
      </div>

      <div 
        ref={containerRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div 
            style={{ 
                transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                transformOrigin: '0 0',
                transition: isDragging ? 'none' : 'transform 0.1s ease-out'
            }}
            className="w-full h-full"
        >
             <svg className="overflow-visible w-full h-full pointer-events-none">
                {/* Links */}
                {links.map((link: any) => (
                    <path 
                        key={link[0]} 
                        d={getLinkPath(link)} 
                        stroke="#64748b" 
                        strokeWidth="2" 
                        fill="none" 
                        opacity="0.6"
                    />
                ))}
             </svg>
             
             {/* Nodes */}
             {nodes.map((node: any) => {
                 const w = node.size ? (Array.isArray(node.size) ? node.size[0] : node.size.width) : 210;
                 const h = node.size ? (Array.isArray(node.size) ? node.size[1] : node.size.height) : 100;
                 
                 return (
                     <div 
                        key={node.id}
                        style={{
                            position: 'absolute',
                            left: node.pos[0],
                            top: node.pos[1],
                            width: w,
                            height: Math.max(h, 60), // min height to ensure header fits
                        }}
                        className="bg-[#2a2a2a] rounded shadow-lg border border-slate-700 flex flex-col pointer-events-auto hover:border-indigo-500 transition-colors"
                     >
                        <div className="px-3 py-1 bg-slate-800 rounded-t border-b border-slate-700 text-[10px] font-bold text-slate-300 flex justify-between items-center" title={node.type}>
                            <span className="truncate mr-2">{node.title || node.type}</span>
                            <span className="text-slate-600 text-[8px] whitespace-nowrap">#{node.id}</span>
                        </div>
                        
                        <div className="flex-1 p-2 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                             {/* Render All Widgets (Parameters) */}
                             {node.widgets_values && node.widgets_values.map((val: any, i: number) => (
                                <div key={`w-${i}`} className="mb-1 last:mb-0">
                                   <div className="text-[9px] text-slate-300 font-mono whitespace-pre-wrap break-words bg-black/20 rounded px-1.5 py-0.5 border border-white/5">
                                      {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                                   </div>
                                </div>
                             ))}
                             
                             {/* Fallback if no widgets */}
                             {(!node.widgets_values || node.widgets_values.length === 0) && (
                                <div className="text-[8px] text-slate-600 italic text-center mt-1">No parameters</div>
                             )}
                        </div>
                     </div>
                 );
             })}
        </div>
      </div>
      
      <div className="absolute bottom-4 left-4 text-xs text-slate-500 bg-black/50 px-2 py-1 rounded pointer-events-none">
        {nodes.length} Nodes • {links.length} Links
      </div>
    </div>
  );
};
