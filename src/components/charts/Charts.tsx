// Reusable, theme-aware chart primitives built on Recharts.
// Styled to the Zavestro/web palette; colours re-read on light/dark theme switch.
import { useEffect, useId, useState } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

// ─── Theme-aware colour tokens (read from CSS custom properties) ───────────────
const DEFAULTS = {
  primary: '#1F6B4F', primaryLight: '#2A8B5B', gold: '#D4A574',
  error: '#D75B5B', warning: '#E4952A', info: '#4B8DC8', success: '#2A9B5B',
  grid: '#F0EDE8', axis: '#9A9188', text: '#6B6560', card: '#FFFEF9',
};
export function useChartColors() {
  const read = (): typeof DEFAULTS => {
    if (typeof window === 'undefined') return DEFAULTS;
    const s = getComputedStyle(document.documentElement);
    const g = (n: string, f: string) => s.getPropertyValue(n).trim() || f;
    return {
      primary: g('--color-primary', DEFAULTS.primary),
      primaryLight: g('--color-primary-light', DEFAULTS.primaryLight),
      gold: g('--color-secondary', DEFAULTS.gold),
      error: g('--color-error', DEFAULTS.error),
      warning: g('--color-warning', DEFAULTS.warning),
      info: g('--color-info', DEFAULTS.info),
      success: g('--color-success', DEFAULTS.success),
      grid: g('--color-border-light', DEFAULTS.grid),
      axis: g('--color-text-tertiary', DEFAULTS.axis),
      text: g('--color-text-secondary', DEFAULTS.text),
      card: g('--color-bg-primary', DEFAULTS.card),
    };
  };
  const [c, setC] = useState(read);
  useEffect(() => {
    const obs = new MutationObserver(() => setC(read()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return c;
}

// Donut palette — distinct, on-brand hues for pipeline stages.
// [KA8-19] STAGE_COLORS + stageRamp moved to ./palette.ts — a plain module, so
// react-refresh is not broken by non-component exports (same pattern as
// StatusBadge/vocab.ts and EmptyState/asyncState.ts).
export { STAGE_COLORS, stageRamp } from './palette';
import { STAGE_COLORS } from './palette';


// Compact ₹ formatter for chart axes/labels (₹1.2Cr, ₹3.4L, ₹5.6K).
export function fmtINRShort(v: number): string {
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(v % 1e7 === 0 ? 0 : 1)}Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(v % 1e5 === 0 ? 0 : 1)}L`;
  if (v >= 1e3) return `₹${(v / 1e3).toFixed(v % 1e3 === 0 ? 0 : 1)}K`;
  return `₹${Math.round(v)}`;
}

// ─── Sparkline — tiny gradient area chart for KPI cards ────────────────────────
export function Sparkline({ data, up = true, height = 38, color }: { data: number[]; up?: boolean; height?: number; color?: string }) {
  const c = useChartColors();
  const id = useId().replace(/:/g, '');
  const stroke = color ?? (up ? c.primary : c.error);
  const series = data.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={series} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity={0.30} />
            <stop offset="100%" stopColor={stroke} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone" dataKey="v" stroke={stroke} strokeWidth={1.8}
          fill={`url(#spark-${id})`} isAnimationActive animationDuration={900}
          dot={false} activeDot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── Area trend chart — gradient + axes + grid + tooltip ───────────────────────
type AreaPoint = Record<string, string | number>;
export function AreaTrendChart({
  data, xKey, dataKey, height = 260, valueFormatter, color, seriesName = 'Value',
}: {
  data: AreaPoint[]; xKey: string; dataKey: string; height?: number;
  valueFormatter?: (v: number) => string; color?: string;
  /** [KA8-18] What the number IS. Passing '' left the tooltip with a blank line. */
  seriesName?: string;
}) {
  const c = useChartColors();
  const id = useId().replace(/:/g, '');
  const stroke = color ?? c.primary;
  const fmt = valueFormatter ?? ((v: number) => String(v));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`area-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity={0.22} />
            <stop offset="92%" stopColor={stroke} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={c.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey={xKey} tick={{ fill: c.axis, fontSize: 11 }} tickLine={false}
          axisLine={{ stroke: c.grid }} minTickGap={24} dy={4}
        />
        <YAxis
          tick={{ fill: c.axis, fontSize: 11 }} tickLine={false} axisLine={false}
          width={48} tickFormatter={(v) => fmt(Number(v))}
        />
        <Tooltip
          cursor={{ stroke: c.axis, strokeDasharray: '3 3' }}
          contentStyle={{ background: c.card, border: `1px solid ${c.grid}`, borderRadius: 10, fontSize: 12, boxShadow: '0 6px 20px rgba(0,0,0,0.10)' }}
          labelStyle={{ color: c.text, fontWeight: 600, marginBottom: 2 }}
          /* [KA8-18] The second element is the SERIES NAME, and passing '' made
             the tooltip render "07 Aug / (blank) / : ₹0" — on a 30-day axis the
             tooltip is the only way to read a single day, so a blank label made
             it unusable for its one job. `seriesName` names the measure. */
          formatter={(v: number | string) => [fmt(Number(v)), seriesName]}
        />
        <Area
          type="monotone" dataKey={dataKey} stroke={stroke} strokeWidth={2.4}
          fill={`url(#area-${id})`} isAnimationActive animationDuration={1100}
          dot={false} activeDot={{ r: 4, fill: stroke, stroke: c.card, strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── Donut — multi-segment ring with centre total ─────────────────────────────
export function DonutChart({
  data, height = 200, centerLabel, centerValue,
}: {
  data: { name: string; value: number; color?: string }[];
  height?: number; centerLabel?: string; centerValue?: string;
}) {
  const c = useChartColors();
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div style={{ position: 'relative', width: '100%', height }}>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data} dataKey="value" nameKey="name"
            innerRadius="62%" outerRadius="92%" paddingAngle={2.5}
            stroke="none" isAnimationActive animationDuration={900} startAngle={90} endAngle={-270}
          >
            {data.map((d, i) => <Cell key={i} fill={d.color ?? STAGE_COLORS[i % STAGE_COLORS.length]} />)}
          </Pie>
          <Tooltip
            contentStyle={{ background: c.card, border: `1px solid ${c.grid}`, borderRadius: 10, fontSize: 12 }}
            formatter={(v: number, n: string) => [`${v} (${total ? Math.round((v / total) * 100) : 0}%)`, n]}
          />
        </PieChart>
      </ResponsiveContainer>
      {(centerValue || centerLabel) && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          {centerValue && <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1 }}>{centerValue}</div>}
          {centerLabel && <div style={{ fontSize: 11, color: c.axis, marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{centerLabel}</div>}
        </div>
      )}
    </div>
  );
}

// ─── Bar chart — rounded bars with animation ──────────────────────────────────
export function BarMini({
  data, xKey, dataKey, height = 220, color, valueFormatter, colors, seriesName = 'Count',
}: {
  data: AreaPoint[]; xKey: string; dataKey: string; height?: number;
  color?: string; valueFormatter?: (v: number) => string; colors?: string[];
  /** [KA8-18] What the number IS. Passing '' left the tooltip with a blank line. */
  seriesName?: string;
}) {
  const c = useChartColors();
  const fill = color ?? c.primary;
  const fmt = valueFormatter ?? ((v: number) => String(v));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="28%">
        <CartesianGrid stroke={c.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey={xKey} tick={{ fill: c.axis, fontSize: 11 }} tickLine={false} axisLine={{ stroke: c.grid }} dy={4} interval={0} />
        <YAxis tick={{ fill: c.axis, fontSize: 11 }} tickLine={false} axisLine={false} width={36} tickFormatter={(v) => fmt(Number(v))} />
        <Tooltip
          cursor={{ fill: 'rgba(0,0,0,0.035)' }}
          contentStyle={{ background: c.card, border: `1px solid ${c.grid}`, borderRadius: 10, fontSize: 12 }}
          /* [KA8-18] The second element is the SERIES NAME, and passing '' made
             the tooltip render "07 Aug / (blank) / : ₹0" — on a 30-day axis the
             tooltip is the only way to read a single day, so a blank label made
             it unusable for its one job. `seriesName` names the measure. */
          formatter={(v: number | string) => [fmt(Number(v)), seriesName]}
        />
        <Bar dataKey={dataKey} fill={fill} radius={[5, 5, 0, 0]} isAnimationActive animationDuration={900} maxBarSize={46}>
          {colors && data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
