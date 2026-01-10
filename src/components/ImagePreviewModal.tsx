'use client';

import React, { useEffect, useRef, useState } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Annotation } from '@/lib/types';

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
  initialFocus,
}) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });

  // Track natural dimensions to prevent SVG distortion
  const [imgDims, setImgDims] = useState({ w: 0, h: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Combine annotations with the focus target
  const activeAnnotations =
    initialFocus &&
    !annotations.some(
      (a) =>
        a.box_2d &&
        initialFocus.box_2d &&
        a.box_2d.every((val, i) => val === initialFocus.box_2d[i])
    )
      ? [...annotations, initialFocus]
      : annotations;

  // Effect to handle initial focus after image is confirmed loaded
  useEffect(() => {
    if (isOpen && imageLoaded && initialFocus) {
      focusOnAnnotation(initialFocus);
    } else if (isOpen && !initialFocus) {
      resetView();
    }
  }, [isOpen, imageLoaded, initialFocus]);

  const resetView = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleImageLoad = () => {
    if (imageRef.current) {
      setImgDims({
        w: imageRef.current.naturalWidth,
        h: imageRef.current.naturalHeight,
      });
      setImageLoaded(true);
    }
  };

  const focusOnAnnotation = (ann: Annotation) => {
    if (!containerRef.current || !imageRef.current || !ann.box_2d || imgDims.w === 0) return;

    const [ymin, xmin, ymax, xmax] = ann.box_2d;

    // Get the rendered size of the image (layout size)
    const layoutW = imageRef.current.clientWidth;
    const layoutH = imageRef.current.clientHeight;

    if (layoutW === 0 || layoutH === 0) return;

    // Calculate center of box in normalized coords (0-1)
    const centerX = (xmin + xmax) / 2;
    const centerY = (ymin + ymax) / 2;

    // Calculate box size relative to image
    const boxW = xmax - xmin;
    const boxH = ymax - ymin;

    // Determine Zoom Level
    let targetScale = Math.min(0.4 / boxW, 0.4 / boxH);
    targetScale = Math.max(1.5, Math.min(8, targetScale));

    // Centering math
    const offsetX = (0.5 - centerX) * layoutW * targetScale;
    const offsetY = (0.5 - centerY) * layoutH * targetScale;

    setScale(targetScale);
    setPosition({ x: offsetX, y: offsetY });
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY * -0.001;
    const newScale = Math.min(Math.max(0.5, scale + delta), 20);
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
      y: e.clientY - startPos.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  if (!isOpen || !imageSrc) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col animate-in fade-in duration-300 overflow-hidden">
      {/* Header / Controls */}
      <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-20 pointer-events-none">
        <div className="flex gap-2 pointer-events-auto bg-slate-900/80 p-1.5 rounded-xl border border-slate-800 backdrop-blur-md">
          <button
            onClick={() => setScale((s) => Math.min(s + 1, 20))}
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ZoomIn size={20} />
          </button>
          <button
            onClick={() => setScale((s) => Math.max(s - 1, 0.5))}
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ZoomOut size={20} />
          </button>
          <button
            onClick={resetView}
            className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            title="Reset View"
          >
            <RotateCcw size={20} />
          </button>
        </div>
        <button
          onClick={onClose}
          className="pointer-events-auto p-3 bg-slate-900/80 hover:bg-rose-600 border border-slate-800 text-slate-300 hover:text-white rounded-xl transition-all"
        >
          <X size={24} />
        </button>
      </div>

      {/* Image Container */}
      <div
        ref={containerRef}
        className="flex-1 w-full h-full overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing select-none"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transition: isDragging ? 'none' : 'transform 0.4s cubic-bezier(0.2, 0, 0.2, 1)',
            transformOrigin: 'center center',
          }}
          className="relative flex items-center justify-center transition-transform"
        >
          <img
            ref={imageRef}
            src={imageSrc}
            onLoad={handleImageLoad}
            alt="Forensic View"
            className="max-w-none max-h-[85vh] shadow-2xl rounded-sm border border-white/5"
            draggable={false}
          />

          {/* Overlay Annotations */}
          {imageLoaded && imgDims.w > 0 && (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
              viewBox={`0 0 ${imgDims.w} ${imgDims.h}`}
            >
              {activeAnnotations.map((ann, idx) => {
                if (!ann.box_2d) return null;
                const [ymin, xmin, ymax, xmax] = ann.box_2d;

                // Map normalized 0-1 to pixel coordinates
                const width = (xmax - xmin) * imgDims.w;
                const height = (ymax - ymin) * imgDims.h;
                const x = xmin * imgDims.w;
                const y = ymin * imgDims.h;

                const isFocused =
                  initialFocus &&
                  initialFocus.box_2d &&
                  ann.box_2d &&
                  initialFocus.box_2d.every((v, i) => Math.abs(v - ann.box_2d[i]) < 0.001);

                // Use distinct colors
                const color = isFocused ? '#f43f5e' : '#6366f1'; // Rose for focus, Indigo for others

                // Dynamic label positioning to avoid edge clipping
                // If box is on the right half, draw label to the left.
                const isRightSide = (xmin + xmax) / 2 > 0.5;
                const isTopSide = ymin < 0.1;

                // Leader line configuration
                const leaderLength = Math.max(imgDims.w, imgDims.h) * 0.05; // 5% leader line
                const elbowOffset = leaderLength * 0.5;
                const shoulderLength = Math.max(imgDims.w, imgDims.h) * 0.02; // Horizontal line length
                const labelPadding = Math.max(imgDims.w, imgDims.h) * 0.01; // Padding between line and text

                // Origin on the box (corner)
                const originX = isRightSide ? x : x + width;
                const originY = y; // Top corner

                // Destination for diagonal
                const destX = isRightSide ? originX - leaderLength : originX + leaderLength;
                const destY = isTopSide ? originY + height + elbowOffset : originY - elbowOffset;

                // Shoulder End Point
                const shoulderEndX = isRightSide ? destX - shoulderLength : destX + shoulderLength;

                // Text Anchor Point
                const textX = isRightSide ? shoulderEndX - labelPadding : shoulderEndX + labelPadding;

                return (
                  <g key={idx}>
                    {/* Bounding Box - Always use box style for clarity as requested */}
                    <rect
                      x={x}
                      y={y}
                      width={width}
                      height={height}
                      fill="none"
                      stroke={color}
                      strokeWidth="2" // Base stroke, scaled down by vector-effect
                      vectorEffect="non-scaling-stroke"
                      className={isFocused ? 'animate-pulse' : ''}
                    />

                    {/* Leader Line: Box -> Elbow -> Shoulder */}
                    <path
                      d={`M ${originX} ${originY} L ${destX} ${destY} L ${shoulderEndX} ${destY}`}
                      stroke={color}
                      strokeWidth="1.5"
                      fill="none"
                      vectorEffect="non-scaling-stroke"
                    />

                    {/* Label Text */}
                    <text
                      x={textX}
                      y={destY}
                      fill={color}
                      fontSize={Math.max(imgDims.w, imgDims.h) * 0.02} // Responsive font size
                      fontWeight="700"
                      textAnchor={isRightSide ? 'end' : 'start'}
                      alignmentBaseline="middle"
                      style={{
                        textShadow: '0px 2px 4px rgba(0,0,0,0.9)',
                        fontFamily: 'monospace',
                        pointerEvents: 'none',
                      }}
                    >
                      {ann.label.toUpperCase()}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="absolute bottom-10 left-0 right-0 flex justify-center pointer-events-none">
        <div className="bg-slate-900/90 backdrop-blur-md px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border border-slate-800 shadow-2xl flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-white">Scroll</span> Zoom
          </div>
          <div className="flex items-center gap-2">
            <span className="text-white">Drag</span> Pan
          </div>
          <div className="flex items-center gap-2 text-indigo-400 font-black">
            {scale.toFixed(1)}x MAGNIFICATION
          </div>
        </div>
      </div>
    </div>
  );
};
