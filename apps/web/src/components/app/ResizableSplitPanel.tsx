"use client";

import { useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, GripVertical } from "lucide-react";

interface ResizableSplitPanelProps {
  leftPanel: ReactNode;
  rightPanel: ReactNode;
  defaultLeftWidth?: number; // percentage (0-100)
  minLeftWidth?: number; // percentage
  maxLeftWidth?: number; // percentage
}

export default function ResizableSplitPanel({
  leftPanel,
  rightPanel,
  defaultLeftWidth = 33.33,
  minLeftWidth = 5,
  maxLeftWidth = 60,
}: ResizableSplitPanelProps) {
  const [leftWidth, setLeftWidth] = useState(defaultLeftWidth);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const handleCollapse = useCallback(() => {
    setIsCollapsed(true);
  }, []);

  const handleExpand = useCallback(() => {
    setIsCollapsed(false);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;

      // Clamp the width
      const clampedWidth = Math.max(minLeftWidth, Math.min(maxLeftWidth, newLeftWidth));
      setLeftWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, minLeftWidth, maxLeftWidth]);

  return (
    <>
      {/* Mobile: stacked layout */}
      <div className="lg:hidden space-y-6">
        <div>{leftPanel}</div>
        <div>{rightPanel}</div>
      </div>

      {/* Desktop: resizable split */}
      <div
        ref={containerRef}
        className={`hidden lg:flex relative ${isResizing ? "select-none" : ""}`}
      >
        {/* Left Panel */}
        {!isCollapsed && (
          <div
            style={{ width: `${leftWidth}%` }}
            className="shrink-0"
          >
            {leftPanel}
          </div>
        )}

        {/* Resize Handle */}
        <div
          className={`relative shrink-0 flex items-center justify-center ${
            isCollapsed ? "w-8" : "w-6"
          }`}
        >
          {isCollapsed ? (
            <button
              onClick={handleExpand}
              className="w-8 h-14 bg-gunmetal border border-edge-steel rounded-lg flex items-center justify-center text-concrete/60 hover:text-safety-orange hover:border-safety-orange/40 transition-colors shadow-lg"
              title="Expand image panel"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <>
              {/* Drag area — wider hit target than the visible line */}
              <div
                onMouseDown={handleMouseDown}
                className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-4 cursor-col-resize z-[1] group"
              >
                {/* Visible line */}
                <div
                  className={`absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 transition-colors ${
                    isResizing
                      ? "bg-safety-orange/60"
                      : "bg-edge-steel/60 group-hover:bg-safety-orange/40"
                  }`}
                />
              </div>
              {/* Grip + collapse button */}
              <button
                onClick={handleCollapse}
                title="Collapse image panel"
                className="relative z-10 w-6 h-14 bg-gunmetal border border-edge-steel rounded-lg flex flex-col items-center justify-center gap-0.5 text-concrete/40 hover:text-safety-orange hover:border-safety-orange/40 transition-colors shadow-lg"
              >
                <GripVertical className="w-3 h-3" />
                <ChevronLeft className="w-3 h-3" />
              </button>
            </>
          )}
        </div>

        {/* Right Panel */}
        <div className="flex-1 min-w-0">
          {rightPanel}
        </div>
      </div>
    </>
  );
}

