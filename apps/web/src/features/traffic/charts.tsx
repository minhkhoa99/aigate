import { useEffect, useRef, useState, type RefObject } from "react";
import type { UsageChart } from "./api";
import { bucketLabel, formatCost, formatTokens, OTHER } from "./usage-format";

// docs/contracts/usage.md "UI": tokens stacked by provider, and cost on its own chart (one axis each). SVG marks follow
// the dataviz spec: thin bars, 2px surface gaps, a 4px rounded data end, recessive grid, hover per bucket, a legend
// with values (the light-mode relief for the three low-contrast slots), and the breakdown table as the table view.

// Drawn at the container's real pixel width with a fixed height, so axis text keeps its size on any screen.
const H = 180;
const PAD = { top: 10, right: 10, bottom: 22, left: 48 };
const PLOT_H = H - PAD.top - PAD.bottom;
const GAP = 2;

function useWidth(): [RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

export interface Series { key: string; label: string; slot: number | null }
export const seriesColor = (series: Series) => (series.slot === null ? "var(--series-other)" : `var(--series-${series.slot + 1})`);

// Three to five round gridlines from zero.
function ticks(max: number): number[] {
  if (max <= 0) return [0];
  const raw = max / 4;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((unit) => unit * power).find((candidate) => candidate >= raw) ?? raw;
  return Array.from({ length: Math.ceil(max / step) + 1 }, (_, index) => index * step);
}

// A bar whose top two corners are rounded; the base stays square on the baseline.
function topRounded(x: number, y: number, width: number, height: number): string {
  const r = Math.min(4, width / 2, height);
  return `M${x},${y + height}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${y + height}Z`;
}

function Frame({ width, top, format, labels, children, onLeave }: { width: number; top: number; format: (value: number) => string; labels: string[]; children: React.ReactNode; onLeave: () => void }) {
  const W = width;
  const grid = ticks(top);
  const band = (W - PAD.left - PAD.right) / Math.max(1, labels.length);
  // One label per ~64px, so they never collide.
  const every = Math.max(1, Math.ceil(labels.length / Math.max(1, Math.floor((W - PAD.left) / 64))));
  return <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="usage-chart" role="presentation" onMouseLeave={onLeave}>
    {grid.map((value) => {
      const y = PAD.top + PLOT_H - (value / (top || 1)) * PLOT_H;
      return <g key={value}><line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} className="usage-grid" /><text x={PAD.left - 6} y={y + 3} textAnchor="end" className="usage-axis">{format(value)}</text></g>;
    })}
    {labels.map((label, index) => (index % every === 0 ? <text key={index} x={PAD.left + band * index + band / 2} y={H - 6} textAnchor="middle" className="usage-axis">{label}</text> : null))}
    {children}
  </svg>;
}

function Tooltip({ left, title, rows }: { left: number; title: string; rows: { label: string; value: string; color?: string }[] }) {
  return <div className="usage-tooltip" style={{ left: `${Math.min(88, Math.max(12, left))}%` }} role="status">
    <strong>{title}</strong>
    {rows.map((row) => <div key={row.label} className="usage-tooltip-row">{row.color && <i style={{ background: row.color }} />}<span>{row.label}</span><b>{row.value}</b></div>)}
  </div>;
}

const scaleTop = (values: readonly number[]) => ticks(Math.max(0, ...values)).at(-1) || 1;

export function TokenChart({ chart, series }: { chart: UsageChart; series: Series[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [ref, W] = useWidth();
  const PLOT_W = Math.max(0, W - PAD.left - PAD.right);
  const named = new Set(series.filter((item) => item.key !== OTHER).map((item) => item.key));
  const stacks = chart.buckets.map((bucket) => series.map((item) => (item.key === OTHER
    ? Object.entries(bucket.tokens).filter(([provider]) => !named.has(provider)).reduce((sum, [, tokens]) => sum + tokens, 0)
    : bucket.tokens[item.key] ?? 0)));
  const totals = stacks.map((stack) => stack.reduce((sum, value) => sum + value, 0));
  const top = scaleTop(totals);
  const labels = chart.buckets.map((bucket) => bucketLabel(bucket.start, chart.bucket, chart.timezone));
  const band = PLOT_W / Math.max(1, chart.buckets.length);
  const barWidth = Math.max(2, Math.min(28, band * 0.6));
  return <div className="usage-chart-wrap" ref={ref}>
    {W > 0 && <Frame width={W} top={top} format={formatTokens} labels={labels} onLeave={() => setHover(null)}>
      {stacks.map((stack, index) => {
        const x = PAD.left + band * index + (band - barWidth) / 2;
        let base = PAD.top + PLOT_H;
        const topIndex = stack.reduce((last, value, seriesIndex) => (value > 0 ? seriesIndex : last), -1);
        return <g key={index}>
          {stack.map((value, seriesIndex) => {
            if (value <= 0) return null;
            const height = Math.max(1, (value / top) * PLOT_H - (seriesIndex === topIndex ? 0 : GAP));
            const y = base - height;
            base = y - GAP;
            const fill = seriesColor(series[seriesIndex]);
            return seriesIndex === topIndex ? <path key={seriesIndex} d={topRounded(x, y, barWidth, height)} fill={fill} /> : <rect key={seriesIndex} x={x} y={y} width={barWidth} height={height} fill={fill} />;
          })}
          <rect x={PAD.left + band * index} y={PAD.top} width={band} height={PLOT_H} fill="transparent" onMouseEnter={() => setHover(index)} />
        </g>;
      })}
    </Frame>}
    {hover !== null && W > 0 && <Tooltip left={((PAD.left + band * hover + band / 2) / W) * 100} title={`${labels[hover]} · ${formatTokens(totals[hover])} tokens`}
      rows={series.map((item, index) => ({ label: item.label, value: formatTokens(stacks[hover][index]), color: seriesColor(item) })).filter((_, index) => stacks[hover][index] > 0)} />}
  </div>;
}

export function CostChart({ chart }: { chart: UsageChart }) {
  const [hover, setHover] = useState<number | null>(null);
  const [ref, W] = useWidth();
  const PLOT_W = Math.max(0, W - PAD.left - PAD.right);
  const values = chart.buckets.map((bucket) => bucket.cost);
  const top = scaleTop(values);
  const labels = chart.buckets.map((bucket) => bucketLabel(bucket.start, chart.bucket, chart.timezone));
  const band = PLOT_W / Math.max(1, values.length);
  const point = (value: number, index: number) => ({ x: PAD.left + band * index + band / 2, y: PAD.top + PLOT_H - (value / top) * PLOT_H });
  const line = values.map((value, index) => { const p = point(value, index); return `${index === 0 ? "M" : "L"}${p.x},${p.y}`; }).join("");
  const active = hover === null ? null : point(values[hover], hover);
  return <div className="usage-chart-wrap" ref={ref}>
    {W > 0 && <Frame width={W} top={top} format={formatCost} labels={labels} onLeave={() => setHover(null)}>
      <path d={line} className="usage-line" />
      {active && <><line x1={active.x} x2={active.x} y1={PAD.top} y2={PAD.top + PLOT_H} className="usage-crosshair" /><circle cx={active.x} cy={active.y} r={4.5} className="usage-marker" /></>}
      {values.map((_, index) => <rect key={index} x={PAD.left + band * index} y={PAD.top} width={band} height={PLOT_H} fill="transparent" onMouseEnter={() => setHover(index)} />)}
    </Frame>}
    {hover !== null && W > 0 && <Tooltip left={((PAD.left + band * hover + band / 2) / W) * 100} title={labels[hover]}
      rows={[{ label: "Cost", value: formatCost(values[hover]) }, { label: "Requests", value: String(chart.buckets[hover].requests) }]} />}
  </div>;
}

export function Legend({ series, totals }: { series: Series[]; totals: Readonly<Record<string, number>> }) {
  return <ul className="usage-legend" aria-label="Providers">
    {series.map((item) => <li key={item.key}><i style={{ background: seriesColor(item) }} /><span>{item.label}</span><b>{formatTokens(totals[item.key] ?? 0)}</b></li>)}
  </ul>;
}
