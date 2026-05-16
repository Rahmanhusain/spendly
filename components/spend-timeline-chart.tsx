"use client";

import { useMemo, useRef, useState } from "react";
import { Minus, MoveHorizontal, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

type TrendPoint = {
  date: string;
  label: string;
  amount: number;
  tax: number;
  receipts: number;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatLongDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

type SpendTimelineChartProps = {
  points: TrendPoint[];
};

const CHART_WIDTH = 920;
const CHART_HEIGHT = 280;
const CHART_PADDING = { top: 18, right: 22, bottom: 38, left: 62 };
const CHART_PLOT_WIDTH = CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right;
const CHART_PLOT_HEIGHT =
  CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;

export function SpendTimelineChart({ points }: SpendTimelineChartProps) {
  const [zoom, setZoom] = useState(1);
  const [startIndex, setStartIndex] = useState(0);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const frameRef = useRef<HTMLDivElement | null>(null);
  const dragStartXRef = useRef(0);
  const dragStartIndexRef = useRef(0);

  const maxZoom = useMemo(
    () => Math.max(1, Math.min(12, points.length / 6)),
    [points.length],
  );

  const visibleCount = useMemo(() => {
    if (points.length <= 1) {
      return points.length;
    }

    return clamp(
      Math.round(points.length / zoom),
      Math.min(8, points.length),
      points.length,
    );
  }, [points.length, zoom]);

  const maxStartIndex = Math.max(0, points.length - visibleCount);
  const safeStartIndex = clamp(startIndex, 0, maxStartIndex);
  const visiblePoints = points.slice(
    safeStartIndex,
    safeStartIndex + visibleCount,
  );

  const geometry = useMemo(() => {
    const maxAmount = Math.max(
      1,
      ...visiblePoints.map((point) => point.amount),
    );

    const coordinates = visiblePoints.map((point, index) => {
      const x =
        visiblePoints.length <= 1
          ? CHART_PADDING.left + CHART_PLOT_WIDTH / 2
          : CHART_PADDING.left +
            (index / (visiblePoints.length - 1)) * CHART_PLOT_WIDTH;
      const y =
        CHART_PADDING.top +
        (1 - Math.min(1, point.amount / maxAmount)) * CHART_PLOT_HEIGHT;

      return { ...point, x, y };
    });

    const linePath = coordinates
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
      .join(" ");

    const areaPath = coordinates.length
      ? `${linePath} L ${coordinates[coordinates.length - 1].x} ${CHART_PADDING.top + CHART_PLOT_HEIGHT} L ${coordinates[0].x} ${CHART_PADDING.top + CHART_PLOT_HEIGHT} Z`
      : "";

    return {
      width: CHART_WIDTH,
      height: CHART_HEIGHT,
      padding: CHART_PADDING,
      plotWidth: CHART_PLOT_WIDTH,
      plotHeight: CHART_PLOT_HEIGHT,
      maxAmount,
      coordinates,
      linePath,
      areaPath,
    };
  }, [visiblePoints]);

  const peakPoint = useMemo(
    () =>
      points.reduce<TrendPoint | null>((peak, point) => {
        if (!peak || point.amount > peak.amount) {
          return point;
        }
        return peak;
      }, null),
    [points],
  );

  const latestPoint = points[points.length - 1] ?? null;
  const averageAmount =
    points.length > 0
      ? points.reduce((sum, point) => sum + point.amount, 0) / points.length
      : 0;

  const fallbackHoverIndex =
    points.length === 0
      ? null
      : clamp(safeStartIndex + visibleCount - 1, 0, points.length - 1);
  const effectiveHoverIndex =
    hoverIndex !== null && hoverIndex >= 0 && hoverIndex < points.length
      ? hoverIndex
      : fallbackHoverIndex;
  const hoverPoint =
    effectiveHoverIndex !== null ? points[effectiveHoverIndex] : null;

  const yTicks = [1, 0.5, 0].map((fraction) => ({
    value: geometry.maxAmount * fraction,
    y: geometry.padding.top + (1 - fraction) * geometry.plotHeight,
  }));

  const applyZoom = (nextZoomRaw: number, anchorIndex: number) => {
    const nextZoom = clamp(Number(nextZoomRaw.toFixed(2)), 1, maxZoom);

    const nextVisibleCount = clamp(
      Math.round(points.length / nextZoom),
      Math.min(8, points.length),
      points.length,
    );
    const nextMaxStart = Math.max(0, points.length - nextVisibleCount);

    const anchorOffset = anchorIndex - safeStartIndex;
    const anchorRatio =
      visibleCount > 1 ? anchorOffset / (visibleCount - 1) : 0;
    const proposedStart = Math.round(
      anchorIndex - anchorRatio * (nextVisibleCount - 1),
    );

    setZoom(nextZoom);
    setStartIndex(clamp(proposedStart, 0, nextMaxStart));
  };

  const onWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!frameRef.current || points.length <= 1) {
      return;
    }

    event.preventDefault();
    const rect = frameRef.current.getBoundingClientRect();
    const xFromLeft = event.clientX - rect.left;
    const xSvg = (xFromLeft / rect.width) * CHART_WIDTH;
    const clampedX = clamp(
      xSvg,
      CHART_PADDING.left,
      CHART_WIDTH - CHART_PADDING.right,
    );
    const fraction =
      (clampedX - CHART_PADDING.left) / Math.max(1, CHART_PLOT_WIDTH);
    const anchorIndex = clamp(
      safeStartIndex + Math.round(fraction * Math.max(0, visibleCount - 1)),
      0,
      points.length - 1,
    );

    const step = event.deltaY < 0 ? 1.18 : 1 / 1.18;
    applyZoom(zoom * step, anchorIndex);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!frameRef.current || points.length <= 1) {
      return;
    }

    setIsDragging(true);
    dragStartXRef.current = event.clientX;
    dragStartIndexRef.current = safeStartIndex;
    frameRef.current.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!frameRef.current) {
      return;
    }

    const rect = frameRef.current.getBoundingClientRect();
    const xFromLeft = event.clientX - rect.left;
    const xSvg = (xFromLeft / rect.width) * CHART_WIDTH;
    const clampedX = clamp(
      xSvg,
      CHART_PADDING.left,
      CHART_WIDTH - CHART_PADDING.right,
    );
    const fraction =
      (clampedX - CHART_PADDING.left) / Math.max(1, CHART_PLOT_WIDTH);
    const nearestVisibleIndex = clamp(
      Math.round(fraction * Math.max(0, visibleCount - 1)),
      0,
      Math.max(0, visibleCount - 1),
    );
    setHoverIndex(safeStartIndex + nearestVisibleIndex);

    if (!isDragging || points.length <= 1) {
      return;
    }

    const delta = event.clientX - dragStartXRef.current;
    const plotWidthPx = rect.width * (CHART_PLOT_WIDTH / CHART_WIDTH);
    const indicesPerPixel = Math.max(0.001, (visibleCount - 1) / plotWidthPx);
    const shift = Math.round(delta * indicesPerPixel);
    setStartIndex(clamp(dragStartIndexRef.current - shift, 0, maxStartIndex));
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!frameRef.current) {
      return;
    }

    setIsDragging(false);
    frameRef.current.releasePointerCapture(event.pointerId);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
        <p className="text-xs text-slate-600">
          Use mouse wheel to zoom and drag the chart to pan through time.
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 px-2"
            onClick={() => {
              const anchor = clamp(
                safeStartIndex + Math.floor(visibleCount / 2),
                0,
                points.length - 1,
              );
              applyZoom(zoom / 1.18, anchor);
            }}
            disabled={zoom <= 1}
            aria-label="Zoom out"
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <span className="min-w-14 text-center text-xs font-medium text-slate-700">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 px-2"
            onClick={() => {
              const anchor = clamp(
                safeStartIndex + Math.floor(visibleCount / 2),
                0,
                points.length - 1,
              );
              applyZoom(zoom * 1.18, anchor);
            }}
            disabled={zoom >= maxZoom}
            aria-label="Zoom in"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-500">
            <MoveHorizontal className="h-3 w-3" />
            Pan
          </span>
        </div>
      </div>

      <div
        ref={frameRef}
        className={`overflow-hidden rounded-2xl border border-slate-200 bg-white select-none ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => setIsDragging(false)}
      >
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          role="img"
          aria-label="Spend timeline line graph"
          className="block h-72 w-full"
        >
          {yTicks.map((tick) => (
            <g key={tick.y}>
              <line
                x1={geometry.padding.left}
                y1={tick.y}
                x2={CHART_WIDTH - geometry.padding.right}
                y2={tick.y}
                stroke={tick.value === 0 ? "#cbd5e1" : "#e2e8f0"}
                strokeWidth={tick.value === 0 ? 1 : 0.8}
                strokeDasharray={tick.value === 0 ? "0" : "3 3"}
              />
              <text
                x={geometry.padding.left - 8}
                y={tick.y + 4}
                textAnchor="end"
                className="fill-slate-500 text-[10px]"
              >
                {formatMoney(tick.value)}
              </text>
            </g>
          ))}

          <path d={geometry.areaPath} fill="url(#spendAreaFill)" />
          <path
            d={geometry.linePath}
            fill="none"
            stroke="#0f172a"
            strokeWidth={2.2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {geometry.coordinates.map((point) => (
            <g key={point.date}>
              <circle cx={point.x} cy={point.y} r={3.2} fill="#10b981" />
            </g>
          ))}

          {geometry.coordinates.map((point, index) => {
            const shouldRender =
              index === 0 ||
              index === geometry.coordinates.length - 1 ||
              index %
                Math.max(1, Math.floor(geometry.coordinates.length / 8)) ===
                0;

            if (!shouldRender) {
              return null;
            }

            return (
              <text
                key={`${point.date}-label`}
                x={point.x}
                y={CHART_HEIGHT - 10}
                textAnchor="middle"
                className="fill-slate-500 text-[10px]"
              >
                {point.label || point.date}
              </text>
            );
          })}

          <defs>
            <linearGradient id="spendAreaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
          Details
        </p>
        {hoverPoint ? (
          <div className="mt-2 grid gap-2 sm:grid-cols-4">
            <div>
              <p className="text-xs text-slate-500">Date</p>
              <p className="text-sm font-medium text-slate-900">
                {formatLongDate(hoverPoint.date)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Bucket label</p>
              <p className="text-sm font-medium text-slate-900">
                {hoverPoint.label || hoverPoint.date}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Spend</p>
              <p className="text-sm font-medium text-slate-900">
                {formatMoney(hoverPoint.amount)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Tax / Receipts</p>
              <p className="text-sm font-medium text-slate-900">
                {formatMoney(hoverPoint.tax)} / {hoverPoint.receipts}
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-600">
            Move cursor over the chart to inspect a point.
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
          <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">
            Peak
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {peakPoint ? formatMoney(peakPoint.amount) : "-"}
          </p>
          <p className="text-xs text-slate-500">
            {peakPoint?.label || peakPoint?.date || "No data"}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
          <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">
            Latest
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {latestPoint ? formatMoney(latestPoint.amount) : "-"}
          </p>
          <p className="text-xs text-slate-500">
            {latestPoint?.label || latestPoint?.date || "No data"}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
          <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">
            Average
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {formatMoney(averageAmount)}
          </p>
          <p className="text-xs text-slate-500">
            Across {points.length} bucket(s)
          </p>
        </div>
      </div>
    </div>
  );
}
