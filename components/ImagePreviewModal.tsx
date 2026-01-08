
import React, { useEffect, useRef, useState } from 'react';
import { X, ZoomIn, ZoomOut, Maximize, RotateCcw } from 'lucide-react';
import { Annotation } from '../types';

interface ImagePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string | null;
  annotations?: Annotation[]; // Annotations to overlay
  initialFocus?: Annotation | null; // Trigger to zoom to a specific spot
}

export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({ 
    isOpen, 
    onClose, 
    imageSrc, 
    annotations = [],
    initialFocus 
}) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Reset or Focus when opening
  useEffect(() => {
    if (isOpen) {
        if (initialFocus && containerRef.current) {
            focusOnAnnotation(initialFocus);
        } else {
            resetView();
        }
    }
  }, [isOpen, initialFocus]);

  const resetView = () => {
      setScale(1);
      setPosition({ x: 0, y: 0 });
  };

  const focusOnAnnotation = (ann: Annotation) => {
      if (!containerRef.current || !imageRef.current) return;
      
      const [ymin, xmin, ymax, xmax] = ann.box_2d;
      const containerW = containerRef.current.clientWidth;
      const containerH = containerRef.current.clientHeight;

      // Calculate center of box in normalized coords (0-1)
      const centerX = (xmin + xmax) / 2;
      const centerY = (ymin + ymax) / 2;

      // Calculate width/height of box relative to image
      const boxW = xmax - xmin;
      const boxH = ymax - ymin;

      // Determine Zoom Level: try to fit the box into 50% of the screen, clamped 1x-4x
      let targetScale = Math.min(1 / boxW, 1 / boxH) * 0.6;
      targetScale = Math.max(1, Math.min(4, targetScale));

      // Calculate displacement to center the point
      // Standard center is (0,0) at scale 1.
      // To shift center: -1 * (nodeCenterRelative - 0.5) * imageSize * scale
      // Note: We need actual rendered image dimensions if aspect ratio differs, 
      // but assuming object-contain matches container usually or is centered.
      // Simplification: Shift based on container dimensions.
      
      const offsetX = (0.5 - centerX) * containerW * targetScale;
      const offsetY = (0.5 - centerY) * containerH * targetScale;

      setScale(targetScale);
      setPosition({ x: offsetX, y: offsetY });
  };

  const handleWheel = (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY * -0.001;
      const newScale = Math.min(Math.max(1, scale + delta), 8);
      setScale(newScale);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
      setIsDragging(true);
      setStartPos({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if (!isDragging) return;
      setPosition({
          x: e.clientX - startPos.x,
          y: e.clientY - startPos.y
      });
  };

  const handleMouseUp = () => setIsDragging(false);

  if (!isOpen || !imageSrc) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex flex-col animate-in fade-in duration-200">
      
      {/* Header / Controls */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-20 pointer-events-none">
          <div className="flex gap-2 pointer-events-auto bg-black/50 p-1 rounded-lg backdrop-blur-sm">
             <button onClick={() => setScale(s => Math.min(s + 0.5, 8))} className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded"><ZoomIn size={20}/></button>
             <button onClick={() => setScale(s => Math.max(s - 0.5, 1))} className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded"><ZoomOut size={20}/></button>
             <button onClick={resetView} className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded" title="Reset View"><RotateCcw size={20}/></button>
          </div>
          <button onClick={onClose} className="pointer-events-auto p-2 bg-black/50 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg transition-colors">
              <X size={24} />
          </button>
      </div>

      {/* Image Container */}
      <div 
        ref={containerRef}
        className="flex-1 w-full h-full overflow-hidden flex items-center justify-center cursor-move select-none"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
          <div 
             style={{ 
                 transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                 transition: isDragging ? 'none' : 'transform 0.2s ease-out'
             }}
             className="relative max-w-full max-h-full"
          >
              <img 
                ref={imageRef}
                src={imageSrc} 
                alt="Preview" 
                className="max-w-full max-h-[90vh] object-contain shadow-2xl" 
                draggable={false}
              />
              
              {/* Overlay Annotations */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                  {annotations.map((ann, idx) => {
                      const [ymin, xmin, ymax, xmax] = ann.box_2d;
                      const width = (xmax - xmin) * 100;
                      const height = (ymax - ymin) * 100;
                      const x = xmin * 100;
                      const y = ymin * 100;

                      if (ann.style === 'box') {
                          return (
                              <g key={idx}>
                                <rect 
                                    x={`${x}%`} y={`${y}%`} width={`${width}%`} height={`${height}%`} 
                                    fill="none" 
                                    stroke="#ef4444" // red-500
                                    strokeWidth="0.5" // Scaled by viewBox
                                    vectorEffect="non-scaling-stroke"
                                    className="animate-pulse"
                                />
                                <text x={`${x}%`} y={`${y - 1}%`} fill="#ef4444" fontSize="3" fontWeight="bold">{ann.label}</text>
                              </g>
                          );
                      } else {
                          // Paint style: translucent fill
                          return (
                              <g key={idx}>
                                  <rect 
                                      x={`${x}%`} y={`${y}%`} width={`${width}%`} height={`${height}%`} 
                                      fill="rgba(244, 63, 94, 0.3)" // rose-500 low opacity
                                      stroke="rgba(244, 63, 94, 0.6)"
                                      strokeWidth="0.2"
                                      vectorEffect="non-scaling-stroke"
                                  />
                              </g>
                          );
                      }
                  })}
              </svg>
          </div>
      </div>
      
      {/* Legend / Info */}
      <div className="absolute bottom-6 left-0 right-0 flex justify-center pointer-events-none">
          <div className="bg-black/60 backdrop-blur px-4 py-2 rounded-full text-xs text-slate-300 border border-white/10">
              Scroll to Zoom • Drag to Pan
          </div>
      </div>

    </div>
  );
};
