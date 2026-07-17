import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

interface Point {
  readonly x: number;
  readonly y: number;
}

interface BoardCameraProps {
  readonly enabled: boolean;
  readonly label: string;
  readonly maxZoom: number;
  readonly resetKey: string;
  readonly width: number;
  readonly height: number;
  readonly children: ReactNode;
}

function clampPan(value: Point, zoom: number, width: number, height: number): Point {
  const maxX = Math.max(0, (width * (zoom - 1)) / 2);
  const maxY = Math.max(0, (height * (zoom - 1)) / 2);
  return {
    x: Math.max(-maxX, Math.min(maxX, value.x)),
    y: Math.max(-maxY, Math.min(maxY, value.y)),
  };
}

export function BoardCamera({
  enabled,
  label,
  maxZoom,
  resetKey,
  width,
  height,
  children,
}: BoardCameraProps) {
  const pointersRef = useRef(new Map<number, Point>());
  const dragRef = useRef<{ readonly pointer: number; readonly point: Point; readonly pan: Point } | null>(null);
  const pinchRef = useRef<{ readonly distance: number; readonly zoom: number } | null>(null);
  const draggedRef = useRef(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });

  useEffect(() => {
    pointersRef.current.clear();
    dragRef.current = null;
    pinchRef.current = null;
    draggedRef.current = false;
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [resetKey]);

  useEffect(() => {
    setZoom((current) => Math.min(maxZoom, current));
    setPan((current) => clampPan(current, Math.min(maxZoom, zoom), width, height));
  }, [height, maxZoom, width, zoom]);

  const updateZoom = (nextZoom: number) => {
    const bounded = enabled ? Math.max(1, Math.min(maxZoom, Math.round(nextZoom))) : 1;
    setZoom(bounded);
    setPan((current) => clampPan(current, bounded, width, height));
  };

  const contentStyle = {
    width: `${width}px`,
    height: `${height}px`,
    transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
  } satisfies CSSProperties;

  return (
    <div
      className={`board-camera${enabled ? " is-zoomable" : ""}${zoom > 1 ? " is-zoomed" : ""}`}
      style={{ width: `${width}px`, height: `${height}px` }}
      tabIndex={enabled ? 0 : -1}
      aria-label={enabled ? `${label}，当前 ${zoom} 倍缩放` : undefined}
      onClickCapture={(event) => {
        if (draggedRef.current) {
          event.preventDefault();
          event.stopPropagation();
          draggedRef.current = false;
        }
      }}
      onKeyDown={(event) => {
        if (!enabled) {
          return;
        }
        const step = Math.max(8, Math.round(Math.min(width, height) / 12));
        if (event.key === "+" || event.key === "=") {
          event.preventDefault();
          updateZoom(zoom + 1);
        } else if (event.key === "-") {
          event.preventDefault();
          updateZoom(zoom - 1);
        } else if (event.key === "0" || event.key === "Escape") {
          event.preventDefault();
          setZoom(1);
          setPan({ x: 0, y: 0 });
        } else if (zoom > 1 && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
          event.preventDefault();
          const delta = {
            x: event.key === "ArrowLeft" ? step : event.key === "ArrowRight" ? -step : 0,
            y: event.key === "ArrowUp" ? step : event.key === "ArrowDown" ? -step : 0,
          };
          setPan((current) => clampPan({ x: current.x + delta.x, y: current.y + delta.y }, zoom, width, height));
        }
      }}
      onWheel={(event) => {
        if (!enabled || (!event.ctrlKey && !event.metaKey)) {
          return;
        }
        event.preventDefault();
        updateZoom(zoom + (event.deltaY < 0 ? 1 : -1));
      }}
      onPointerDown={(event) => {
        if (!enabled) {
          return;
        }
        pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        const points = [...pointersRef.current.values()];
        if (points.length === 2) {
          for (const pointerId of pointersRef.current.keys()) {
            event.currentTarget.setPointerCapture(pointerId);
          }
          pinchRef.current = {
            distance: Math.hypot(points[1]!.x - points[0]!.x, points[1]!.y - points[0]!.y),
            zoom,
          };
          dragRef.current = null;
        } else if (zoom > 1) {
          event.currentTarget.setPointerCapture(event.pointerId);
          dragRef.current = {
            pointer: event.pointerId,
            point: { x: event.clientX, y: event.clientY },
            pan,
          };
        }
      }}
      onPointerMove={(event) => {
        if (!enabled || !pointersRef.current.has(event.pointerId)) {
          return;
        }
        pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        const points = [...pointersRef.current.values()];
        if (points.length === 2 && pinchRef.current !== null) {
          const distance = Math.hypot(points[1]!.x - points[0]!.x, points[1]!.y - points[0]!.y);
          if (Math.abs(distance - pinchRef.current.distance) > 8) {
            draggedRef.current = true;
          }
          updateZoom((pinchRef.current.zoom * distance) / Math.max(1, pinchRef.current.distance));
        } else if (points.length === 1 && dragRef.current?.pointer === event.pointerId && zoom > 1) {
          const deltaX = event.clientX - dragRef.current.point.x;
          const deltaY = event.clientY - dragRef.current.point.y;
          if (Math.hypot(deltaX, deltaY) > 5) {
            draggedRef.current = true;
          }
          setPan(
            clampPan(
              { x: dragRef.current.pan.x + deltaX, y: dragRef.current.pan.y + deltaY },
              zoom,
              width,
              height,
            ),
          );
        }
      }}
      onPointerUp={(event) => {
        pointersRef.current.delete(event.pointerId);
        if (pointersRef.current.size < 2) {
          pinchRef.current = null;
        }
        const remaining = [...pointersRef.current.entries()][0];
        dragRef.current = remaining && zoom > 1
          ? { pointer: remaining[0], point: remaining[1], pan }
          : null;
      }}
      onPointerCancel={(event) => {
        pointersRef.current.delete(event.pointerId);
        if (pointersRef.current.size === 0) {
          dragRef.current = null;
          pinchRef.current = null;
        }
      }}
    >
      <div className="board-camera-content" style={contentStyle}>
        {children}
      </div>
    </div>
  );
}
