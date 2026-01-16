'use client';

/**
 * WorkflowGraphEnhanced Component
 *
 * Enhanced workflow graph visualization with lint diagnostic integration.
 * Highlights nodes with issues, supports click-to-focus, and displays
 * diagnostic indicators directly on nodes.
 */

import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  AlertCircle,
  AlertTriangle,
  Info,
  Maximize2,
  RotateCcw,
} from 'lucide-react';
import { LintDiagnostic } from '@/lib/lintTypes';

// ============================================================================
// TYPES
// ============================================================================

type WidgetValue = string | number | boolean | null | Record<string, unknown>;

type GraphNode = {
  id: number;
  type?: string;
  title?: string;
  pos: [number, number];
  size?: number[] | { width: number; height: number };
  widgets_values?: WidgetValue[];
};

export type GraphWorkflow = {
  nodes?: GraphNode[];
  links?: (number | string)[][];
};

export interface NodeDiagnosticInfo {
  nodeId: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  diagnostics: LintDiagnostic[];
}

interface WorkflowGraphEnhancedProps {
  /** The workflow data to visualize */
  workflow: GraphWorkflow;
  /** Map of node IDs to their diagnostic info */
  nodeDiagnostics?: Map<number, NodeDiagnosticInfo>;
  /** Currently focused node ID */
  focusedNodeId?: number | null;
  /** Callback when a node is clicked */
  onNodeClick?: (nodeId: number) => void;
  /** Callback when a node is double-clicked */
  onNodeDoubleClick?: (nodeId: number) => void;
  /** Whether to show diagnostic badges on nodes */
  showDiagnosticBadges?: boolean;
  /** Whether to dim nodes without diagnostics when filtering */
  dimUnaffectedNodes?: boolean;
}

// ============================================================================
// SEVERITY HELPERS
// ============================================================================

const getSeverityColor = (
  errorCount: number,
  warningCount: number,
  infoCount: number
): string => {
  if (errorCount > 0) return 'border-red-500 ring-red-500/30';
  if (warningCount > 0) return 'border-orange-500 ring-orange-500/30';
  if (infoCount > 0) return 'border-blue-500 ring-blue-500/30';
  return 'border-slate-700';
};

const getSeverityBgColor = (
  errorCount: number,
  warningCount: number,
  infoCount: number
): string => {
  if (errorCount > 0) return 'bg-red-500/5';
  if (warningCount > 0) return 'bg-orange-500/5';
  if (infoCount > 0) return 'bg-blue-500/5';
  return 'bg-[#2a2a2a]';
};

const SeverityIcon: React.FC<{
  errorCount: number;
  warningCount: number;
  infoCount: number;
  size?: number;
}> = ({ errorCount, warningCount, infoCount, size = 12 }) => {
  if (errorCount > 0) return <AlertCircle size={size} className="text-red-400" />;
  if (warningCount > 0) return <AlertTriangle size={size} className="text-orange-400" />;
  if (infoCount > 0) return <Info size={size} className="text-blue-400" />;
  return null;
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const WorkflowGraphEnhanced: React.FC<WorkflowGraphEnhancedProps> = ({
  workflow,
  nodeDiagnostics,
  focusedNodeId,
  onNodeClick,
  onNodeDoubleClick,
  showDiagnosticBadges = true,
  dimUnaffectedNodes = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
  const [hoveredNodeId, setHoveredNodeId] = useState<number | null>(null);

  const nodes = useMemo(() => workflow.nodes || [], [workflow]);
  const links = workflow.links || [];

  // Determine which nodes have diagnostics
  const affectedNodeIds = useMemo(() => {
    if (!nodeDiagnostics) return new Set<number>();
    return new Set(nodeDiagnostics.keys());
  }, [nodeDiagnostics]);

  // Handle Pan
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-node-interactive]')) return;
    setIsDragging(true);
    setLastPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - lastPos.x;
    const dy = e.clientY - lastPos.y;
    setTransform((prev) => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
    setLastPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Handle Zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const scaleFactor = 0.1;

      setTransform((prev) => {
        const updatedScale =
          e.deltaY > 0
            ? Math.max(0.1, prev.scale - scaleFactor)
            : Math.min(5, prev.scale + scaleFactor);
        return { ...prev, scale: updatedScale };
      });
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, []);

  // Keyboard navigation
  const handleContainerKeyDown = (e: React.KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    const panAmount = 50;
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        setTransform((prev) => ({ ...prev, y: prev.y + panAmount }));
        break;
      case 'ArrowDown':
        e.preventDefault();
        setTransform((prev) => ({ ...prev, y: prev.y - panAmount }));
        break;
      case 'ArrowLeft':
        e.preventDefault();
        setTransform((prev) => ({ ...prev, x: prev.x + panAmount }));
        break;
      case 'ArrowRight':
        e.preventDefault();
        setTransform((prev) => ({ ...prev, x: prev.x - panAmount }));
        break;
      case '+':
      case '=':
        e.preventDefault();
        setTransform((prev) => ({ ...prev, scale: Math.min(5, prev.scale + 0.1) }));
        break;
      case '-':
      case '_':
        e.preventDefault();
        setTransform((prev) => ({ ...prev, scale: Math.max(0.1, prev.scale - 0.1) }));
        break;
    }
  };

  // Auto-center logic
  const centerGraph = useCallback(() => {
    if (nodes.length > 0 && containerRef.current) {
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;

      nodes.forEach((n) => {
        const x = n.pos[0];
        const y = n.pos[1];
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
  }, [nodes]);

  useEffect(() => {
    centerGraph();
  }, [centerGraph]);

  // Focus on a specific node
  const focusOnNode = useCallback(
    (nodeId: number) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node || !containerRef.current) return;

      const containerW = containerRef.current.clientWidth;
      const containerH = containerRef.current.clientHeight;
      const nodeW = node.size ? (Array.isArray(node.size) ? node.size[0] : node.size.width) : 200;
      const nodeH = node.size ? (Array.isArray(node.size) ? node.size[1] : node.size.height) : 100;

      const scale = 1.5;
      const x = containerW / 2 - (node.pos[0] + nodeW / 2) * scale;
      const y = containerH / 2 - (node.pos[1] + nodeH / 2) * scale;

      setTransform({ x, y, scale });
    },
    [nodes]
  );

  // Focus when focusedNodeId changes
  useEffect(() => {
    if (focusedNodeId !== null && focusedNodeId !== undefined) {
      focusOnNode(focusedNodeId);
    }
  }, [focusedNodeId, focusOnNode]);

  // Link path generator
  const getLinkPath = (link: (number | string)[]) => {
    const originNode = nodes.find((n) => n.id === Number(link[1]));
    const targetNode = nodes.find((n) => n.id === Number(link[3]));

    if (!originNode || !targetNode) return '';

    const originW = originNode.size
      ? Array.isArray(originNode.size)
        ? originNode.size[0]
        : originNode.size.width
      : 210;

    const outSlotIdx = Number(link[2]) || 0;
    const outY = originNode.pos[1] + 40 + outSlotIdx * 20;
    const startX = originNode.pos[0] + originW;
    const startY = outY;

    const inSlotIdx = Number(link[4]) || 0;
    const inY = targetNode.pos[1] + 40 + inSlotIdx * 20;
    const endX = targetNode.pos[0];
    const endY = inY;

    const dist = Math.abs(endX - startX) * 0.5;
    return `M ${startX} ${startY} C ${startX + dist} ${startY} ${endX - dist} ${endY} ${endX} ${endY}`;
  };

  // Get link color based on connected nodes' diagnostics
  const getLinkColor = (link: (number | string)[]): string => {
    const sourceId = Number(link[1]);
    const targetId = Number(link[3]);

    const sourceDiag = nodeDiagnostics?.get(sourceId);
    const targetDiag = nodeDiagnostics?.get(targetId);

    if (sourceDiag?.errorCount || targetDiag?.errorCount) return '#ef4444';
    if (sourceDiag?.warningCount || targetDiag?.warningCount) return '#f97316';
    return '#64748b';
  };

  // Node click handler
  const handleNodeClick = (nodeId: number) => {
    onNodeClick?.(nodeId);
  };

  // Node double-click handler
  const handleNodeDoubleClick = (nodeId: number) => {
    onNodeDoubleClick?.(nodeId);
    focusOnNode(nodeId);
  };

  return (
    <div className="relative w-full h-[600px] bg-[#1a1a1a] rounded-xl overflow-hidden border border-slate-800 shadow-inner group">
      {/* Controls Overlay */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
        <button
          onClick={() => setTransform((t) => ({ ...t, scale: Math.min(5, t.scale + 0.1) }))}
          className="p-2 bg-slate-800 rounded hover:bg-slate-700 text-white shadow"
          aria-label="Zoom in"
        >
          <ZoomIn size={16} />
        </button>
        <button
          onClick={() => setTransform((t) => ({ ...t, scale: Math.max(0.1, t.scale - 0.1) }))}
          className="p-2 bg-slate-800 rounded hover:bg-slate-700 text-white shadow"
          aria-label="Zoom out"
        >
          <ZoomOut size={16} />
        </button>
        <button
          onClick={centerGraph}
          className="p-2 bg-slate-800 rounded hover:bg-slate-700 text-white shadow"
          aria-label="Fit to view"
        >
          <Maximize2 size={16} />
        </button>
        <button
          onClick={() => setTransform({ x: 0, y: 0, scale: 1 })}
          className="p-2 bg-slate-800 rounded hover:bg-slate-700 text-white shadow"
          aria-label="Reset view"
        >
          <RotateCcw size={16} />
        </button>
      </div>

      {/* Legend */}
      {nodeDiagnostics && nodeDiagnostics.size > 0 && (
        <div className="absolute top-4 left-4 flex items-center gap-4 text-[10px] text-slate-400 bg-black/50 px-3 py-2 rounded-lg z-10">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            Errors
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-orange-500" />
            Warnings
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            Info
          </span>
        </div>
      )}

      {/* Graph Container */}
      <div
        ref={containerRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        role="application"
        aria-label="Workflow graph viewer. Use arrow keys to pan, +/- keys to zoom, or drag with mouse."
        tabIndex={0}
        onKeyDown={handleContainerKeyDown}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            transformOrigin: '0 0',
            transition: isDragging ? 'none' : 'transform 0.2s ease-out',
          }}
          className="w-full h-full"
        >
          {/* Links SVG */}
          <svg className="overflow-visible w-full h-full pointer-events-none absolute top-0 left-0">
            {links.map((link) => (
              <path
                key={String(link[0])}
                d={getLinkPath(link)}
                stroke={getLinkColor(link)}
                strokeWidth="2"
                fill="none"
                opacity="0.6"
              />
            ))}
          </svg>

          {/* Nodes */}
          {nodes.map((node) => {
            const w = node.size ? (Array.isArray(node.size) ? node.size[0] : node.size.width) : 210;
            const h = node.size ? (Array.isArray(node.size) ? node.size[1] : node.size.height) : 100;

            const diagInfo = nodeDiagnostics?.get(node.id);
            const hasIssues = diagInfo && (diagInfo.errorCount > 0 || diagInfo.warningCount > 0 || diagInfo.infoCount > 0);
            const isFocused = focusedNodeId === node.id;
            const isHovered = hoveredNodeId === node.id;
            const shouldDim = dimUnaffectedNodes && affectedNodeIds.size > 0 && !affectedNodeIds.has(node.id);

            return (
              <div
                key={node.id}
                data-node-interactive
                style={{
                  position: 'absolute',
                  left: node.pos[0],
                  top: node.pos[1],
                  width: w,
                  height: Math.max(h, 60),
                }}
                className={`
                  rounded shadow-lg flex flex-col pointer-events-auto transition-all duration-200
                  ${getSeverityBgColor(
                    diagInfo?.errorCount || 0,
                    diagInfo?.warningCount || 0,
                    diagInfo?.infoCount || 0
                  )}
                  ${
                    isFocused
                      ? 'border-2 border-indigo-500 ring-4 ring-indigo-500/30 scale-105 z-20'
                      : hasIssues
                      ? `border-2 ring-2 ${getSeverityColor(
                          diagInfo?.errorCount || 0,
                          diagInfo?.warningCount || 0,
                          diagInfo?.infoCount || 0
                        )}`
                      : 'border border-slate-700 hover:border-indigo-500'
                  }
                  ${shouldDim ? 'opacity-30' : ''}
                  ${isHovered && !isFocused ? 'scale-[1.02] z-10' : ''}
                `}
                onClick={() => handleNodeClick(node.id)}
                onDoubleClick={() => handleNodeDoubleClick(node.id)}
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
              >
                {/* Header */}
                <div
                  className={`
                    px-3 py-1 rounded-t border-b text-[10px] font-bold flex justify-between items-center
                    ${
                      hasIssues
                        ? diagInfo?.errorCount
                          ? 'bg-red-500/20 border-red-500/30 text-red-300'
                          : diagInfo?.warningCount
                          ? 'bg-orange-500/20 border-orange-500/30 text-orange-300'
                          : 'bg-blue-500/20 border-blue-500/30 text-blue-300'
                        : 'bg-slate-800 border-slate-700 text-slate-300'
                    }
                  `}
                  title={node.type}
                >
                  <span className="truncate mr-2 flex items-center gap-1.5">
                    {showDiagnosticBadges && hasIssues && (
                      <SeverityIcon
                        errorCount={diagInfo?.errorCount || 0}
                        warningCount={diagInfo?.warningCount || 0}
                        infoCount={diagInfo?.infoCount || 0}
                      />
                    )}
                    {node.title || node.type}
                  </span>
                  <span className="text-slate-600 text-[8px] whitespace-nowrap">#{node.id}</span>
                </div>

                {/* Body */}
                <div className="flex-1 p-2 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                  {node.widgets_values &&
                    node.widgets_values.map((val, i) => (
                      <div key={`w-${i}`} className="mb-1 last:mb-0">
                        <div className="text-[9px] text-slate-300 font-mono whitespace-pre-wrap break-words bg-black/20 rounded px-1.5 py-0.5 border border-white/5">
                          {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                        </div>
                      </div>
                    ))}

                  {(!node.widgets_values || node.widgets_values.length === 0) && (
                    <div className="text-[8px] text-slate-600 italic text-center mt-1">
                      No parameters
                    </div>
                  )}
                </div>

                {/* Diagnostic Badge */}
                {showDiagnosticBadges && hasIssues && (
                  <div className="absolute -top-2 -right-2 flex gap-1">
                    {diagInfo?.errorCount > 0 && (
                      <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center shadow-lg">
                        {diagInfo.errorCount}
                      </span>
                    )}
                    {diagInfo?.warningCount > 0 && (
                      <span className="w-5 h-5 rounded-full bg-orange-500 text-white text-[9px] font-bold flex items-center justify-center shadow-lg">
                        {diagInfo.warningCount}
                      </span>
                    )}
                    {diagInfo?.infoCount > 0 && !diagInfo?.errorCount && !diagInfo?.warningCount && (
                      <span className="w-5 h-5 rounded-full bg-blue-500 text-white text-[9px] font-bold flex items-center justify-center shadow-lg">
                        {diagInfo.infoCount}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Status Bar */}
      <div className="absolute bottom-4 left-4 flex items-center gap-4 text-xs text-slate-500 bg-black/50 px-3 py-1.5 rounded pointer-events-none">
        <span>{nodes.length} Nodes</span>
        <span>{links.length} Links</span>
        {nodeDiagnostics && nodeDiagnostics.size > 0 && (
          <span className="text-amber-400">{nodeDiagnostics.size} with issues</span>
        )}
        <span className="text-slate-600">Zoom: {Math.round(transform.scale * 100)}%</span>
      </div>

      {/* Focused Node Info */}
      {focusedNodeId !== null && focusedNodeId !== undefined && (
        <div className="absolute bottom-4 right-4 bg-indigo-500/20 border border-indigo-500/30 rounded-lg px-3 py-2 text-xs text-indigo-300">
          Focused: Node #{focusedNodeId}
        </div>
      )}
    </div>
  );
};

export default WorkflowGraphEnhanced;
