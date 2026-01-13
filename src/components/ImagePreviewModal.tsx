'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Eye,
  EyeOff,
  ChevronDown,
  Edit3,
  Trash2,
  Plus,
  Move,
  RotateCw
} from 'lucide-react';
import { Annotation } from '@/lib/types';

interface AnnotationWithMeta extends Annotation {
  labelRotation?: number; // Degrees for label rotation
  issueId?: string; // Link to QualityIssue
}

interface ImagePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string | null;
  annotations?: AnnotationWithMeta[];
  initialFocus?: Annotation | null;
  // Editing callbacks
  onAnnotationUpdate?: (index: number, annotation: AnnotationWithMeta) => void;
  onAnnotationDelete?: (index: number) => void;
  onAnnotationCreate?: (annotation: AnnotationWithMeta) => void;
}

type EditMode = 'none' | 'move' | 'rotate' | 'resize' | 'create' | 'editLabel';

export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
  isOpen,
  onClose,
  imageSrc,
  annotations = [],
  initialFocus,
  onAnnotationUpdate,
  onAnnotationDelete,
  onAnnotationCreate,
}) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });

  // Track natural dimensions to prevent SVG distortion
  const [imgDims, setImgDims] = useState({ w: 0, h: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);

  // Annotation visibility controls (dev mode)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [visibleAnnotations, setVisibleAnnotations] = useState<Set<number>>(new Set());
  const [isFocusMode, setIsFocusMode] = useState(false);

  // Editing state
  const [editMode, setEditMode] = useState<EditMode>('none');
  const [selectedAnnotationIdx, setSelectedAnnotationIdx] = useState<number | null>(null);
  const [hoveredAnnotationIdx, setHoveredAnnotationIdx] = useState<number | null>(null);
  const [editingLabelIdx, setEditingLabelIdx] = useState<number | null>(null);
  const [editingLabelText, setEditingLabelText] = useState('');

  // For creating new annotations
  const [isCreating, setIsCreating] = useState(false);
  const [createStart, setCreateStart] = useState<{ x: number; y: number } | null>(null);
  const [createEnd, setCreateEnd] = useState<{ x: number; y: number } | null>(null);

  // For moving annotations
  const [moveStart, setMoveStart] = useState<{ x: number; y: number } | null>(null);
  const [originalBox, setOriginalBox] = useState<[number, number, number, number] | null>(null);

  // For rotating labels
  const [rotateStart, setRotateStart] = useState<{ x: number; y: number } | null>(null);
  const [originalRotation, setOriginalRotation] = useState<number>(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const labelInputRef = useRef<HTMLInputElement>(null);

  // Check if editing is enabled
  const canEdit = onAnnotationUpdate || onAnnotationDelete || onAnnotationCreate;

  // Track previous annotation count to detect new annotations vs updates
  const prevAnnotationCountRef = useRef(annotations.length);

  // Initialize visibility only when modal opens or new annotations are added
  useEffect(() => {
    const prevCount = prevAnnotationCountRef.current;

    // Only update visibility if annotations were added (not just updated)
    // Don't auto-add if we have initialFocus (let the focus effect handle it)
    // Also don't run on initial mount when modal opens (prevCount === 0 and modal just opened)
    if (annotations.length > prevCount && !initialFocus && prevCount > 0) {
      // Add new annotations to visible set
      setVisibleAnnotations((prev) => {
        const next = new Set(prev);
        for (let i = prevCount; i < annotations.length; i++) {
          next.add(i);
        }
        return next;
      });
    }

    prevAnnotationCountRef.current = annotations.length;
  }, [annotations.length, initialFocus]);

  // Filter annotations based on visibility toggles
  const activeAnnotations = annotations.filter((_, idx) => visibleAnnotations.has(idx));

  const toggleAnnotation = (idx: number) => {
    // Exit focus mode when manually toggling annotations
    setIsFocusMode(false);
    setVisibleAnnotations((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  const toggleAllAnnotations = () => {
    // Exit focus mode when toggling all
    setIsFocusMode(false);
    if (visibleAnnotations.size === annotations.length) {
      setVisibleAnnotations(new Set());
    } else {
      setVisibleAnnotations(new Set(annotations.map((_, idx) => idx)));
    }
  };

  // Track if modal was just opened to avoid resetting on annotation updates
  const prevIsOpenRef = useRef(false);

  // Effect to handle modal open/close
  useEffect(() => {
    const justOpened = isOpen && !prevIsOpenRef.current;
    const justClosed = !isOpen && prevIsOpenRef.current;
    prevIsOpenRef.current = isOpen;

    if (justClosed) {
      // Reset edit state when modal closes
      resetEditState();
      // Reset annotation count ref so next open initializes properly
      prevAnnotationCountRef.current = 0;
      setIsFocusMode(false);
      setVisibleAnnotations(new Set());
      return;
    }

    if (justOpened && imageLoaded) {
      // Initialize visibility on modal open
      prevAnnotationCountRef.current = annotations.length;

      if (!initialFocus) {
        // No focus - show all annotations
        resetView();
        setVisibleAnnotations(new Set(annotations.map((_, idx) => idx)));
        setIsFocusMode(false);
      }
    }
  }, [isOpen, imageLoaded, annotations.length]);

  // Separate effect to handle initialFocus changes (can happen while modal is open)
  useEffect(() => {
    if (!isOpen || !imageLoaded) return;

    if (initialFocus) {
      focusOnAnnotation(initialFocus);
      const focusedIdx = annotations.findIndex(
        (ann) =>
          ann.box_2d &&
          initialFocus.box_2d &&
          ann.box_2d.every((v, i) => Math.abs(v - initialFocus.box_2d![i]) < 0.001),
      );
      if (focusedIdx !== -1) {
        setVisibleAnnotations(new Set([focusedIdx]));
        setIsFocusMode(true);
      }
    } else if (isFocusMode) {
      // initialFocus was cleared - exit focus mode
      setVisibleAnnotations(new Set(annotations.map((_, idx) => idx)));
      setIsFocusMode(false);
    }
  }, [isOpen, imageLoaded, initialFocus, annotations, isFocusMode]);

  // Focus on label input when editing
  useEffect(() => {
    if (editingLabelIdx !== null && labelInputRef.current) {
      labelInputRef.current.focus();
      labelInputRef.current.select();
    }
  }, [editingLabelIdx]);

  // Keyboard event handling
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // If editing label, that has its own escape handler
        if (editingLabelIdx !== null) return;

        // If in any edit mode, reset it
        if (editMode !== 'none') {
          resetEditState();
          return;
        }

        // If annotation is selected, deselect it
        if (selectedAnnotationIdx !== null) {
          setSelectedAnnotationIdx(null);
          return;
        }

        // Otherwise close the modal
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, editMode, editingLabelIdx, selectedAnnotationIdx, onClose]);

  const resetView = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const resetEditState = () => {
    setEditMode('none');
    setSelectedAnnotationIdx(null);
    setEditingLabelIdx(null);
    setIsCreating(false);
    setCreateStart(null);
    setCreateEnd(null);
    setMoveStart(null);
    setOriginalBox(null);
    setRotateStart(null);
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
    const layoutW = imageRef.current.clientWidth;
    const layoutH = imageRef.current.clientHeight;

    if (layoutW === 0 || layoutH === 0) return;

    const centerX = (xmin + xmax) / 2;
    const centerY = (ymin + ymax) / 2;
    const boxW = xmax - xmin;
    const boxH = ymax - ymin;

    let targetScale = Math.min(0.4 / boxW, 0.4 / boxH);
    targetScale = Math.max(1.5, Math.min(8, targetScale));

    const offsetX = (0.5 - centerX) * layoutW * targetScale;
    const offsetY = (0.5 - centerY) * layoutH * targetScale;

    setScale(targetScale);
    setPosition({ x: offsetX, y: offsetY });
  };

  // Convert screen coordinates to normalized image coordinates
  const screenToNormalized = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      if (!imageRef.current || !containerRef.current) return null;

      const imgRect = imageRef.current.getBoundingClientRect();
      const x = (clientX - imgRect.left) / imgRect.width;
      const y = (clientY - imgRect.top) / imgRect.height;

      return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
    },
    [],
  );

  const handleWheel = (e: React.WheelEvent) => {
    if (editMode !== 'none') return;
    e.preventDefault();
    const delta = e.deltaY * -0.001;
    const newScale = Math.min(Math.max(0.5, scale + delta), 20);
    setScale(newScale);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Don't start pan if clicking on annotation controls
    if ((e.target as HTMLElement).closest('.annotation-control')) return;
    if ((e.target as HTMLElement).closest('.annotation-group')) return;

    if (editMode === 'create') {
      const normalized = screenToNormalized(e.clientX, e.clientY);
      if (normalized) {
        setIsCreating(true);
        setCreateStart(normalized);
        setCreateEnd(normalized);
      }
      return;
    }

    // Deselect annotation if clicking on empty space
    if (selectedAnnotationIdx !== null) {
      setSelectedAnnotationIdx(null);
    }

    if (editMode === 'none') {
      setIsDragging(true);
      setStartPos({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isCreating && createStart) {
      const normalized = screenToNormalized(e.clientX, e.clientY);
      if (normalized) {
        setCreateEnd(normalized);
      }
      return;
    }

    if (editMode === 'move' && moveStart && originalBox && selectedAnnotationIdx !== null) {
      const normalized = screenToNormalized(e.clientX, e.clientY);
      if (normalized && onAnnotationUpdate) {
        const dx = normalized.x - moveStart.x;
        const dy = normalized.y - moveStart.y;
        const [ymin, xmin, ymax, xmax] = originalBox;
        const newBox: [number, number, number, number] = [
          Math.max(0, Math.min(1, ymin + dy)),
          Math.max(0, Math.min(1, xmin + dx)),
          Math.max(0, Math.min(1, ymax + dy)),
          Math.max(0, Math.min(1, xmax + dx)),
        ];
        const ann = annotations[selectedAnnotationIdx];
        onAnnotationUpdate(selectedAnnotationIdx, { ...ann, box_2d: newBox });
      }
      return;
    }

    if (editMode === 'rotate' && rotateStart && selectedAnnotationIdx !== null) {
      const normalized = screenToNormalized(e.clientX, e.clientY);
      if (normalized && onAnnotationUpdate) {
        const ann = annotations[selectedAnnotationIdx];
        const [ymin, xmin, ymax, xmax] = ann.box_2d;

        // Calculate the box center (rotation is around the center)
        const cx = (xmin + xmax) / 2;
        const cy = (ymin + ymax) / 2;

        // Calculate angle from center to current mouse position
        // Using atan2 with (x, -y) to match our angle convention (0 = up)
        const currentAngle = Math.atan2(normalized.x - cx, -(normalized.y - cy));
        const startAngle = Math.atan2(rotateStart.x - cx, -(rotateStart.y - cy));
        const deltaAngle = ((currentAngle - startAngle) * 180) / Math.PI;

        const newRotation = (originalRotation + deltaAngle) % 360;
        onAnnotationUpdate(selectedAnnotationIdx, { ...ann, labelRotation: newRotation });
      }
      return;
    }

    if (isDragging) {
      setPosition({
        x: e.clientX - startPos.x,
        y: e.clientY - startPos.y,
      });
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (isCreating && createStart && createEnd && onAnnotationCreate) {
      // Create new annotation if box is large enough
      const width = Math.abs(createEnd.x - createStart.x);
      const height = Math.abs(createEnd.y - createStart.y);

      if (width > 0.02 && height > 0.02) {
        const ymin = Math.min(createStart.y, createEnd.y);
        const xmin = Math.min(createStart.x, createEnd.x);
        const ymax = Math.max(createStart.y, createEnd.y);
        const xmax = Math.max(createStart.x, createEnd.x);

        const newAnnotation: AnnotationWithMeta = {
          label: 'New Issue',
          style: 'box',
          box_2d: [ymin, xmin, ymax, xmax],
          labelRotation: 0,
        };

        onAnnotationCreate(newAnnotation);
      }

      setIsCreating(false);
      setCreateStart(null);
      setCreateEnd(null);
      setEditMode('none');
      return;
    }

    if (editMode === 'move') {
      setMoveStart(null);
      setOriginalBox(null);
      setEditMode('none');
    }

    if (editMode === 'rotate') {
      setRotateStart(null);
      setEditMode('none');
    }

    setIsDragging(false);
  };

  const handleAnnotationClick = (e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    if (editMode === 'none' && canEdit) {
      setSelectedAnnotationIdx(idx);
    }
  };

  const startMove = (e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    e.preventDefault();
    const normalized = screenToNormalized(e.clientX, e.clientY);
    if (normalized) {
      setEditMode('move');
      setSelectedAnnotationIdx(idx);
      setMoveStart(normalized);
      setOriginalBox([...annotations[idx].box_2d]);
    }
  };

  const startRotate = (e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    e.preventDefault();
    const normalized = screenToNormalized(e.clientX, e.clientY);
    if (normalized) {
      setEditMode('rotate');
      setSelectedAnnotationIdx(idx);
      setRotateStart(normalized);
      setOriginalRotation(annotations[idx].labelRotation || 0);
    }
  };

  const startEditLabel = (idx: number) => {
    setEditingLabelIdx(idx);
    setEditingLabelText(annotations[idx].label);
  };

  const saveLabel = () => {
    if (editingLabelIdx !== null && onAnnotationUpdate && editingLabelText.trim()) {
      const ann = annotations[editingLabelIdx];
      onAnnotationUpdate(editingLabelIdx, { ...ann, label: editingLabelText.trim() });
    }
    setEditingLabelIdx(null);
    setEditingLabelText('');
  };

  const handleDeleteAnnotation = (idx: number) => {
    if (onAnnotationDelete) {
      onAnnotationDelete(idx);
      setSelectedAnnotationIdx(null);
    }
  };

  if (!isOpen || !imageSrc) return null;

  // Calculate the creation preview box
  const creationBox =
    isCreating && createStart && createEnd
      ? {
          ymin: Math.min(createStart.y, createEnd.y),
          xmin: Math.min(createStart.x, createEnd.x),
          ymax: Math.max(createStart.y, createEnd.y),
          xmax: Math.max(createStart.x, createEnd.x),
        }
      : null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col animate-in fade-in duration-300 overflow-hidden">
      {/* Header / Controls */}
      <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start z-20 pointer-events-none">
        <div className="flex gap-2 items-start flex-wrap">
          {/* Zoom Controls */}
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

          {/* Edit Controls */}
          {canEdit && (
            <div className="flex gap-2 pointer-events-auto bg-slate-900/80 p-1.5 rounded-xl border border-slate-800 backdrop-blur-md">
              <button
                onClick={() => {
                  resetEditState();
                  setEditMode(editMode === 'create' ? 'none' : 'create');
                }}
                className={`p-2 rounded-lg transition-colors ${
                  editMode === 'create'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
                title="Create Annotation"
              >
                <Plus size={20} />
              </button>
            </div>
          )}

          {/* Annotations Dropdown */}
          {annotations.length > 0 && (
            <div className="pointer-events-auto relative">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-2 px-3 py-2 bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white rounded-xl transition-all backdrop-blur-md"
                title={isFocusMode ? 'Focused on single annotation' : 'Toggle annotation visibility'}
              >
                <Eye size={18} />
                <span className="text-sm font-medium">
                  {isFocusMode
                    ? 'Focused'
                    : `Annotations (${visibleAnnotations.size}/${annotations.length})`}
                </span>
                <ChevronDown
                  size={16}
                  className={`transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {isDropdownOpen && (
                <div className="absolute top-full mt-2 left-0 w-80 bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-xl shadow-2xl overflow-hidden">
                  {/* Toggle All Button */}
                  <button
                    onClick={toggleAllAnnotations}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800/50 transition-colors border-b border-slate-800"
                  >
                    {visibleAnnotations.size === annotations.length ? (
                      <>
                        <EyeOff size={16} />
                        <span>Hide All</span>
                      </>
                    ) : (
                      <>
                        <Eye size={16} />
                        <span>Show All</span>
                      </>
                    )}
                  </button>

                  {/* Individual Annotations */}
                  <div className="max-h-96 overflow-y-auto">
                    {annotations.map((ann, idx) => {
                      const isVisible = visibleAnnotations.has(idx);
                      return (
                        <div
                          key={idx}
                          className="flex items-center gap-2 px-4 py-3 text-sm text-slate-300 hover:bg-slate-800/50 transition-colors border-b border-slate-800/50 last:border-b-0"
                        >
                          <button
                            onClick={() => toggleAnnotation(idx)}
                            className="flex items-center gap-3 flex-1"
                          >
                            {isVisible ? (
                              <Eye size={16} className="text-indigo-400 flex-shrink-0" />
                            ) : (
                              <EyeOff size={16} className="text-slate-600 flex-shrink-0" />
                            )}
                            <span
                              className={`font-mono text-xs flex-1 text-left truncate ${isVisible ? 'text-white' : 'text-slate-500'}`}
                            >
                              {ann.label}
                            </span>
                            <span className="text-[10px] text-slate-500 font-medium">
                              #{idx + 1}
                            </span>
                          </button>
                          {canEdit && (
                            <button
                              onClick={() => handleDeleteAnnotation(idx)}
                              className="p-1 text-slate-500 hover:text-red-400 rounded transition-colors"
                              title="Delete Annotation"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Edit Mode Indicator - shows when annotation selected or in edit mode */}
          {(editMode !== 'none' || selectedAnnotationIdx !== null) && (
            <div className="pointer-events-auto px-4 py-2 bg-emerald-600/90 text-white rounded-xl text-sm font-medium flex items-center gap-2">
              {editMode === 'create' && (
                <>
                  <Plus size={16} /> Click and drag to create
                </>
              )}
              {editMode === 'move' && (
                <>
                  <Move size={16} /> Drag to move
                </>
              )}
              {editMode === 'rotate' && (
                <>
                  <RotateCw size={16} /> Drag to rotate label
                </>
              )}
              {editMode === 'none' && selectedAnnotationIdx !== null && (
                <>
                  <Edit3 size={16} /> Annotation selected (Esc to deselect)
                </>
              )}
              <button
                onClick={() => {
                  resetEditState();
                  setSelectedAnnotationIdx(null);
                }}
                className="ml-2 p-1 hover:bg-white/20 rounded"
                title="Cancel (Esc)"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className="pointer-events-auto p-3 bg-slate-900/80 hover:bg-rose-600 border border-slate-800 text-slate-300 hover:text-white rounded-xl transition-all"
        >
          <X size={24} />
        </button>
      </div>

      {/* Image Container */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        ref={containerRef}
        className={`flex-1 w-full h-full overflow-hidden flex items-center justify-center select-none ${
          editMode === 'create'
            ? 'cursor-crosshair'
            : editMode === 'move'
              ? 'cursor-move'
              : editMode === 'rotate'
                ? 'cursor-grabbing'
                : 'cursor-grab active:cursor-grabbing'
        }`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transition:
              isDragging || isCreating || editMode === 'rotate' || editMode === 'move'
                ? 'none'
                : 'transform 0.4s cubic-bezier(0.2, 0, 0.2, 1)',
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
              className="absolute inset-0 w-full h-full overflow-visible"
              viewBox={`0 0 ${imgDims.w} ${imgDims.h}`}
              style={{ pointerEvents: canEdit ? 'auto' : 'none' }}
            >
              {/* Creation Preview */}
              {creationBox && (
                <rect
                  x={creationBox.xmin * imgDims.w}
                  y={creationBox.ymin * imgDims.h}
                  width={(creationBox.xmax - creationBox.xmin) * imgDims.w}
                  height={(creationBox.ymax - creationBox.ymin) * imgDims.h}
                  fill="rgba(16, 185, 129, 0.2)"
                  stroke="#10b981"
                  strokeWidth="2"
                  strokeDasharray="8 4"
                  vectorEffect="non-scaling-stroke"
                />
              )}

              {activeAnnotations.map((ann, idx) => {
                if (!ann.box_2d) return null;

                // Find the real index in the full annotations array
                const realIdx = annotations.findIndex(
                  (a) => a.box_2d && ann.box_2d && a.box_2d.every((v, i) => v === ann.box_2d[i]),
                );

                const [ymin, xmin, ymax, xmax] = ann.box_2d;
                const width = (xmax - xmin) * imgDims.w;
                const height = (ymax - ymin) * imgDims.h;
                const x = xmin * imgDims.w;
                const y = ymin * imgDims.h;

                const isFocused =
                  initialFocus &&
                  initialFocus.box_2d &&
                  ann.box_2d.every((v, i) => Math.abs(v - initialFocus.box_2d![i]) < 0.001);

                const isSelected = selectedAnnotationIdx === realIdx;
                const isHovered = hoveredAnnotationIdx === realIdx && !isSelected;

                // Color priority: selected (green) > hovered (cyan) > focused (rose) > default (indigo)
                const color = isSelected
                  ? '#10b981'
                  : isHovered
                    ? '#22d3d8'
                    : isFocused
                      ? '#f43f5e'
                      : '#6366f1';

                // Label positioning with rotation - origin slides along box perimeter
                const leaderLength = Math.max(imgDims.w, imgDims.h) * 0.05;
                const shoulderLength = Math.max(imgDims.w, imgDims.h) * 0.02;
                const labelPadding = Math.max(imgDims.w, imgDims.h) * 0.01;

                // Box center and half-dimensions
                const cx = x + width / 2;
                const cy = y + height / 2;
                const hw = width / 2;
                const hh = height / 2;

                // Rotation angle determines where on perimeter the leader attaches
                const labelRotation = ann.labelRotation || 0;
                // Default angle: point up-left for right-side boxes, up-right for left-side
                const isRightSide = (xmin + xmax) / 2 > 0.5;
                const baseAngle = isRightSide ? 135 : 45; // degrees from up
                const angle = baseAngle + labelRotation;
                const angleRad = (angle * Math.PI) / 180;

                // Direction vector (pointing outward from center)
                const dirX = Math.sin(angleRad);
                const dirY = -Math.cos(angleRad);

                // Find intersection of ray from center with box perimeter
                let t: number;
                if (Math.abs(dirX) < 0.0001) {
                  t = hh / Math.abs(dirY);
                } else if (Math.abs(dirY) < 0.0001) {
                  t = hw / Math.abs(dirX);
                } else {
                  const tx = hw / Math.abs(dirX);
                  const ty = hh / Math.abs(dirY);
                  t = Math.min(tx, ty);
                }

                // Origin is on the box perimeter
                const originX = cx + dirX * t;
                const originY = cy + dirY * t;

                // Leader extends outward in the same direction
                const destX = originX + dirX * leaderLength;
                const destY = originY + dirY * leaderLength;

                // Shoulder extends horizontally from dest (always horizontal for readability)
                const shoulderEndX = dirX < 0 ? destX - shoulderLength : destX + shoulderLength;
                const textX = dirX < 0 ? shoulderEndX - labelPadding : shoulderEndX + labelPadding;

                return (
                  <g
                    key={idx}
                    className="annotation-group"
                    style={{ pointerEvents: 'auto' }}
                    onMouseEnter={() => canEdit && setHoveredAnnotationIdx(realIdx)}
                    onMouseLeave={() => setHoveredAnnotationIdx(null)}
                  >
                    {/* Bounding Box */}
                    <rect
                      x={x}
                      y={y}
                      width={width}
                      height={height}
                      fill={
                        isSelected
                          ? 'rgba(16, 185, 129, 0.1)'
                          : isHovered
                            ? 'rgba(34, 211, 216, 0.08)'
                            : 'none'
                      }
                      stroke={color}
                      strokeWidth={isSelected ? '3' : isHovered ? '2.5' : '2'}
                      vectorEffect="non-scaling-stroke"
                      style={{ cursor: canEdit ? 'pointer' : 'default' }}
                      className={`annotation-control ${isFocused ? 'animate-pulse' : ''}`}
                      onClick={(e) => handleAnnotationClick(e, realIdx)}
                    />

                    {/* Leader Line (no transform - positions are pre-calculated with rotation) */}
                    <path
                      d={`M ${originX} ${originY} L ${destX} ${destY} L ${shoulderEndX} ${destY}`}
                      stroke={color}
                      strokeWidth="1.5"
                      fill="none"
                      vectorEffect="non-scaling-stroke"
                    />

                    {/* Label Text (always horizontal for readability) */}
                    {editingLabelIdx === realIdx ? (
                      <foreignObject
                        x={isRightSide ? textX - 200 : textX}
                        y={destY - 15}
                        width="200"
                        height="30"
                      >
                        <input
                          ref={labelInputRef}
                          type="text"
                          value={editingLabelText}
                          onChange={(e) => setEditingLabelText(e.target.value)}
                          onBlur={saveLabel}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveLabel();
                            if (e.key === 'Escape') {
                              setEditingLabelIdx(null);
                              setEditingLabelText('');
                            }
                          }}
                          className="w-full h-full bg-slate-900 border border-indigo-500 rounded px-2 text-white text-xs font-mono outline-none"
                          style={{ fontSize: Math.max(imgDims.w, imgDims.h) * 0.015 }}
                        />
                      </foreignObject>
                    ) : (
                      <text
                        x={textX}
                        y={destY}
                        fill={color}
                        fontSize={Math.max(imgDims.w, imgDims.h) * 0.02}
                        fontWeight="700"
                        textAnchor={isRightSide ? 'end' : 'start'}
                        alignmentBaseline="middle"
                        style={{
                          textShadow: '0px 2px 4px rgba(0,0,0,0.9)',
                          fontFamily: 'monospace',
                          cursor: canEdit ? 'pointer' : 'default',
                        }}
                        className="annotation-control"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (canEdit) startEditLabel(realIdx);
                        }}
                      >
                        {ann.label.toUpperCase()}
                      </text>
                    )}

                    {/* Edit Controls (when selected) */}
                    {isSelected && canEdit && (
                      <g className="annotation-control">
                        {/* Move Handle */}
                        <g
                          transform={`translate(${x + width / 2}, ${y + height / 2})`}
                          style={{ cursor: 'move' }}
                          onMouseDown={(e) => startMove(e, realIdx)}
                          className="move-handle"
                        >
                          <circle
                            r={Math.max(imgDims.w, imgDims.h) * 0.018}
                            fill="#10b981"
                            className="transition-all hover:fill-emerald-400"
                            style={{ filter: 'drop-shadow(0 0 4px rgba(16, 185, 129, 0.5))' }}
                          />
                          <foreignObject
                            x={-10}
                            y={-10}
                            width="20"
                            height="20"
                            style={{ pointerEvents: 'none' }}
                          >
                            <div className="flex items-center justify-center w-full h-full">
                              <Move size={12} color="white" />
                            </div>
                          </foreignObject>
                        </g>

                        {/* Rotate Handle - positioned along the leader line */}
                        {(() => {
                          const handleRadius = Math.max(imgDims.w, imgDims.h) * 0.04;
                          // Handle is along the leader line direction, at handleRadius from origin
                          const handleX = originX + dirX * handleRadius;
                          const handleY = originY + dirY * handleRadius;

                          return (
                            <g className="rotate-handle">
                              {/* Arc around box center showing rotation path */}
                              <circle
                                cx={cx}
                                cy={cy}
                                r={Math.max(hw, hh) + handleRadius * 0.5}
                                fill="none"
                                stroke="#6366f1"
                                strokeWidth="1"
                                strokeDasharray="4 4"
                                opacity={0.3}
                                vectorEffect="non-scaling-stroke"
                                style={{ pointerEvents: 'none' }}
                              />
                              {/* Connection line from origin to handle */}
                              <line
                                x1={originX}
                                y1={originY}
                                x2={handleX}
                                y2={handleY}
                                stroke="#6366f1"
                                strokeWidth="2"
                                vectorEffect="non-scaling-stroke"
                                style={{ pointerEvents: 'none' }}
                              />
                              {/* Clickable handle circle */}
                              <circle
                                cx={handleX}
                                cy={handleY}
                                r={Math.max(imgDims.w, imgDims.h) * 0.022}
                                fill="#6366f1"
                                style={{
                                  cursor: 'grab',
                                  filter: 'drop-shadow(0 0 6px rgba(99, 102, 241, 0.7))',
                                }}
                                className="annotation-control"
                                onMouseDown={(e) => startRotate(e, realIdx)}
                              />
                              {/* Icon (visual only) */}
                              <foreignObject
                                x={handleX - 10}
                                y={handleY - 10}
                                width="20"
                                height="20"
                                style={{ pointerEvents: 'none' }}
                              >
                                <div className="flex items-center justify-center w-full h-full">
                                  <RotateCw size={12} color="white" />
                                </div>
                              </foreignObject>
                            </g>
                          );
                        })()}

                        {/* Delete Button */}
                        <g
                          transform={`translate(${x + width}, ${y})`}
                          style={{ cursor: 'pointer' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteAnnotation(realIdx);
                          }}
                        >
                          <circle r={Math.max(imgDims.w, imgDims.h) * 0.012} fill="#ef4444" />
                          <foreignObject
                            x={-8}
                            y={-8}
                            width="16"
                            height="16"
                            style={{ pointerEvents: 'none' }}
                          >
                            <div className="flex items-center justify-center w-full h-full">
                              <Trash2 size={10} color="white" />
                            </div>
                          </foreignObject>
                        </g>

                        {/* Edit Label Button */}
                        <g
                          transform={`translate(${x}, ${y})`}
                          style={{ cursor: 'pointer' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditLabel(realIdx);
                          }}
                        >
                          <circle r={Math.max(imgDims.w, imgDims.h) * 0.012} fill="#8b5cf6" />
                          <foreignObject
                            x={-8}
                            y={-8}
                            width="16"
                            height="16"
                            style={{ pointerEvents: 'none' }}
                          >
                            <div className="flex items-center justify-center w-full h-full">
                              <Edit3 size={10} color="white" />
                            </div>
                          </foreignObject>
                        </g>
                      </g>
                    )}
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
          {canEdit && (
            <div className="flex items-center gap-2 text-emerald-400 font-black">
              <Edit3 size={12} /> EDIT MODE
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
