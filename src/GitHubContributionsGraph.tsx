import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';

export interface ContributionDay {
  date: string;
  contributionCount: number;
}

export interface ContributionWeek {
  contributionDays: ContributionDay[];
}

export interface ContributionData {
  totalContributions: number;
  weeks: ContributionWeek[];
}

export interface GitHubContributionsGraphProps {
  data: ContributionData;
  /** Color scale for dark mode: 5 colors from empty → most active */
  darkColors?: [string, string, string, string, string];
  /** Color scale for light mode: 5 colors from empty → most active */
  lightColors?: [string, string, string, string, string];
  /**
   * Single seed color used to auto-generate both `darkColors` and `lightColors`
   * (5-step scales). Accepts any CSS color. Explicit `darkColors`/`lightColors`
   * override this.
   */
  seedColor?: string;
  /**
   * Controls dark/light theme.
   * - "dark" | "light" — fixed
   * - "auto" — watches the `dark` class on <html> (default)
   */
  theme?: 'dark' | 'light' | 'auto';
  /** px size of each cell (default: 13) */
  cellSize?: number;
  /** px gap between cells (default: 3) */
  cellGap?: number;
  /** Shape of each cell (default: "square") */
  cellShape?: 'square' | 'rounded' | 'circle';
  /** Show the total contributions count above the graph (default: true) */
  showTotal?: boolean;
  /** Show the Less/More legend below the graph (default: true) */
  showLegend?: boolean;
  /** Animate cells on scroll into view (default: true) */
  animate?: boolean;
  /** Animate the total contributions number counting up from 0 (default: true) */
  countUp?: boolean;
  /** Show an animated ping ring on the latest day's cell (default: true) */
  todayIndicator?: boolean;
  /** Subtle breathing glow on the most-active (level 4) cells (default: true) */
  pulseHighActivity?: boolean;
  /**
   * How strong the level-4 pulse glow is. 0 = invisible, 1 = subtle (old default),
   * 2 = noticeable, 3+ = dramatic. Default: 2.
   */
  pulseIntensity?: number;
  /** Pulse cycle duration in seconds (default: 2.4) */
  pulseDuration?: number;
  /** Override the today-indicator ring color (default: darkest palette color) */
  todayIndicatorColor?: string;
  /** Override the level-4 pulse glow color (default: darkest palette color) */
  pulseColor?: string;
  className?: string;
}

const DEFAULT_DARK: [string, string, string, string, string] = [
  '#1a1025', '#2d1a4a', '#4a1fa8', '#7c3aed', '#a855f7',
];
const DEFAULT_LIGHT: [string, string, string, string, string] = [
  '#ede9fe', '#c4b5fd', '#a78bfa', '#7c3aed', '#5b21b6',
];

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

/**
 * Convert any CSS color (hex 3/4/6/8, rgb/rgba, hsl/hsla, named) to rgba(r,g,b,a).
 * Falls back to the input string if parsing fails (e.g. SSR).
 */
function toRgba(color: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha));

  // Fast path: #rgb / #rgba / #rrggbb / #rrggbbaa
  const hex = color.trim();
  if (hex.startsWith('#')) {
    const h = hex.slice(1);
    const expand = (s: string) => s.split('').map((c) => c + c).join('');
    let r = 0, g = 0, b = 0, hexA = 1;
    if (h.length === 3 || h.length === 4) {
      const e = expand(h);
      r = parseInt(e.slice(0, 2), 16);
      g = parseInt(e.slice(2, 4), 16);
      b = parseInt(e.slice(4, 6), 16);
      if (h.length === 4) hexA = parseInt(e.slice(6, 8), 16) / 255;
    } else if (h.length === 6 || h.length === 8) {
      r = parseInt(h.slice(0, 2), 16);
      g = parseInt(h.slice(2, 4), 16);
      b = parseInt(h.slice(4, 6), 16);
      if (h.length === 8) hexA = parseInt(h.slice(6, 8), 16) / 255;
    } else {
      return color;
    }
    if ([r, g, b].some(Number.isNaN)) return color;
    return `rgba(${r}, ${g}, ${b}, ${(a * hexA).toFixed(3)})`;
  }

  // rgb/rgba/hsl/hsla/named — let the browser parse via a throwaway element.
  if (typeof document === 'undefined') return color;
  const probe = document.createElement('div');
  probe.style.color = color;
  document.body.appendChild(probe);
  const computed = getComputedStyle(probe).color;
  document.body.removeChild(probe);
  const m = computed.match(/rgba?\(([^)]+)\)/);
  if (!m) return color;
  const parts = m[1].split(',').map((s) => parseFloat(s.trim()));
  const [r, g, b, parsedA = 1] = parts;
  return `rgba(${r}, ${g}, ${b}, ${(a * parsedA).toFixed(3)})`;
}

/** Parse any CSS color into {r,g,b} in 0-255. Returns null if it can't be parsed. */
function toRgb(color: string): { r: number; g: number; b: number } | null {
  const rgba = toRgba(color, 1);
  const m = rgba.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const [r, g, b] = m[1].split(',').map((s) => parseFloat(s.trim()));
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;
  return { r, g, b };
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return { h, s, l };
}

function hslToHex(h: number, s: number, l: number): string {
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Generate a 5-step contribution color scale from a single seed color.
 * Returns both dark-mode and light-mode scales (level 0 → 4).
 */
export function generateColorScales(seed: string): {
  dark: [string, string, string, string, string];
  light: [string, string, string, string, string];
} {
  const rgb = toRgb(seed);
  if (!rgb) {
    return { dark: DEFAULT_DARK, light: DEFAULT_LIGHT };
  }
  const { h, s } = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const sat = Math.max(0.35, s);
  // Light mode: pale → saturated (lightness descending).
  const lightL = [0.92, 0.78, 0.62, 0.48, 0.34];
  // Dark mode: very dark → vivid (lightness ascending, low-end stays muted).
  const darkL = [0.10, 0.18, 0.32, 0.50, 0.66];
  const darkS = [0.40, 0.55, 0.70, 0.80, 0.85].map((m) => sat * m);
  const light = lightL.map((l) => hslToHex(h, sat, l)) as [string, string, string, string, string];
  const dark = darkL.map((l, i) => hslToHex(h, darkS[i], l)) as [string, string, string, string, string];
  return { dark, light };
}

function getLevel(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count === 0) return 0;
  if (count <= 3) return 1;
  if (count <= 6) return 2;
  if (count <= 9) return 3;
  return 4;
}

function getMonthPositions(weeks: ContributionWeek[]): { label: string; col: number }[] {
  // GitHub convention (per the GraphQL `ContributionCalendarMonth.totalWeeks`
  // field — "how many weeks started in this month"): a week-column belongs to
  // the month its Sunday (top cell) falls in. Label each month at the first
  // column whose Sunday is in that month.
  const positions: { label: string; col: number }[] = [];
  let lastMonth = -1;
  weeks.forEach((week, col) => {
    const firstDay = week.contributionDays[0];
    if (!firstDay) return;
    const month = new Date(firstDay.date).getMonth();
    if (month !== lastMonth) {
      positions.push({ label: MONTH_LABELS[month], col });
      lastMonth = month;
    }
  });
  return positions;
}

interface TooltipData { date: string; count: number; x: number; y: number; elBottom: number }

export function GitHubContributionsGraph({
  data,
  darkColors,
  lightColors,
  seedColor,
  theme = 'auto',
  cellSize = 13,
  cellGap = 3,
  cellShape = 'square',
  showTotal = true,
  showLegend = true,
  animate = true,
  countUp = true,
  todayIndicator = true,
  pulseHighActivity = true,
  pulseIntensity = 2,
  pulseDuration = 2.4,
  todayIndicatorColor,
  pulseColor,
  className,
}: GitHubContributionsGraphProps) {
  const [isDark, setIsDark] = useState(() => {
    if (theme === 'dark') return true;
    if (theme === 'light') return false;
    return typeof document !== 'undefined'
      ? document.documentElement.classList.contains('dark')
      : true;
  });

  useEffect(() => {
    if (theme !== 'auto') {
      setIsDark(theme === 'dark');
      return;
    }
    const check = () => setIsDark(document.documentElement.classList.contains('dark'));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, [theme]);

  const ref = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [tooltipShift, setTooltipShift] = useState(0);

  useLayoutEffect(() => {
    if (!tooltip || !tooltipRef.current) {
      if (tooltipShift !== 0) setTooltipShift(0);
      return;
    }
    const rect = tooltipRef.current.getBoundingClientRect();
    const margin = 8;
    const vw = window.innerWidth;
    let shift = 0;
    if (rect.left < margin) shift = margin - rect.left;
    else if (rect.right > vw - margin) shift = vw - margin - rect.right;
    if (shift !== tooltipShift) setTooltipShift(shift);
  }, [tooltip, tooltipShift]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [data]);

  const seeded = seedColor ? generateColorScales(seedColor) : null;
  const resolvedDark = darkColors ?? seeded?.dark ?? DEFAULT_DARK;
  const resolvedLight = lightColors ?? seeded?.light ?? DEFAULT_LIGHT;
  const COLORS = isDark ? resolvedDark : resolvedLight;
  const DAY_COL_W = 28;
  const cellRadius = cellShape === 'circle' ? cellSize / 2 : cellShape === 'rounded' ? Math.max(2, cellSize * 0.3) : 2;
  const gridW = data.weeks.length * (cellSize + cellGap) - cellGap;
  const monthPositions = getMonthPositions(data.weeks);
  const resolvedTodayColor = todayIndicatorColor ?? COLORS[4];
  const resolvedPulseColor = pulseColor ?? COLORS[4];
  // glow extends roughly (4 + intensity*4) blur + (intensity) spread px outside the cell;
  // the today ping ring grows to ~2.4× the cell. Pad scroll containers to fit both.
  const glowPad = Math.max(
    pulseHighActivity ? 4 + pulseIntensity * 4 + Math.ceil(pulseIntensity) : 0,
    todayIndicator ? Math.ceil(cellSize * 0.8) : 0,
    6
  );

  // Latest non-empty cell — used for today indicator
  let latestDate: string | null = null;
  for (let w = data.weeks.length - 1; w >= 0 && !latestDate; w--) {
    const days = data.weeks[w].contributionDays;
    for (let d = days.length - 1; d >= 0; d--) {
      if (days[d]) { latestDate = days[d].date; break; }
    }
  }

  // Animated count-up for the total
  const [displayTotal, setDisplayTotal] = useState(countUp ? 0 : data.totalContributions);
  useEffect(() => {
    if (!countUp || !inView) {
      setDisplayTotal(data.totalContributions);
      return;
    }
    const start = performance.now();
    const duration = 1200;
    const from = 0;
    const to = data.totalContributions;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setDisplayTotal(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, countUp, data.totalContributions]);

  return (
    <div ref={ref} className={className} style={{ position: 'relative' }}>
      <style>{`.commitgrid-weeks:hover>div>div{opacity:.4;transition:opacity .15s}.commitgrid-weeks:hover>div>div:hover{opacity:1}`}</style>
      {showTotal && (
        <p style={{ fontSize: 14, marginBottom: 12, opacity: 0.7 }}>
          <span style={{ fontWeight: 600, opacity: 1, fontVariantNumeric: 'tabular-nums' }}>
            {displayTotal.toLocaleString()}
          </span>{' '}
          contributions in the last year
        </p>
      )}

      <div
        ref={scrollRef}
        style={{
          overflowX: 'auto',
          overflowY: 'visible',
          paddingTop: glowPad,
          paddingBottom: Math.max(8, glowPad),
          marginTop: -glowPad,
          position: 'relative',
        }}
      >
        <div style={{ minWidth: DAY_COL_W + gridW }}>
          {/* Month labels */}
          <div style={{ position: 'relative', height: 16, marginLeft: DAY_COL_W }}>
            {monthPositions.map(({ label, col }) => (
              <span
                key={`${label}-${col}`}
                style={{
                  position: 'absolute',
                  left: col * (cellSize + cellGap),
                  fontFamily: 'monospace',
                  fontSize: 10,
                  opacity: 0.5,
                  userSelect: 'none',
                }}
              >
                {label}
              </span>
            ))}
          </div>

          {/* Day labels + grid */}
          <div style={{ display: 'flex' }}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: cellGap,
                paddingTop: 1,
                width: DAY_COL_W,
                flexShrink: 0,
              }}
            >
              {DAY_LABELS.map((d, i) => (
                <span
                  key={i}
                  style={{
                    fontFamily: 'monospace',
                    fontSize: 10,
                    opacity: 0.5,
                    height: cellSize,
                    lineHeight: `${cellSize}px`,
                    display: 'block',
                    userSelect: 'none',
                  }}
                >
                  {d}
                </span>
              ))}
            </div>

            {/* Week columns — CSS handles neighbor dimming to avoid per-cell re-renders */}
            <div className="commitgrid-weeks" style={{ display: 'flex', gap: cellGap }}>
              {data.weeks.map((week, wIdx) => (
                <div key={wIdx} style={{ display: 'flex', flexDirection: 'column', gap: cellGap }}>
                  {week.contributionDays.map((day, dIdx) => {
                    const level = getLevel(day.contributionCount);
                    const color = COLORS[level];
                    const isToday = day.date === latestDate;
                    const entryDelay = 0.3 + wIdx * 0.006 + dIdx * 0.003;
                    const entryEnd = entryDelay + 0.5;

                    if (!animate) {
                      return (
                        <div
                          key={day.date}
                          style={{
                            width: cellSize,
                            height: cellSize,
                            background: color,
                            borderRadius: cellRadius,
                            border: '1px solid rgba(27,31,35,0.06)',
                            flexShrink: 0,
                            cursor: 'default',
                            position: 'relative',
                          }}
                        >
                          {isToday && todayIndicator && (
                            <TodayPing color={resolvedTodayColor} cellSize={cellSize} borderRadius={cellRadius} />
                          )}
                        </div>
                      );
                    }

                    const pulse = pulseHighActivity && level === 4 && inView;

                    return (
                      <motion.div
                        key={day.date}
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={
                          inView
                            ? pulse
                              ? {
                                  opacity: 1,
                                  scale: 1,
                                  boxShadow: [
                                    `0 0 0px 0px ${toRgba(resolvedPulseColor, 0)}`,
                                    `0 0 ${Math.round(4 + pulseIntensity * 4)}px ${Math.round(pulseIntensity)}px ${toRgba(resolvedPulseColor, Math.min(1, 0.35 + pulseIntensity * 0.25))}`,
                                    `0 0 0px 0px ${toRgba(resolvedPulseColor, 0)}`,
                                  ],
                                }
                              : { opacity: 1, scale: 1 }
                            : {}
                        }
                        transition={inView
                          ? {
                              opacity: { duration: 0.15 },
                              scale: {
                                type: 'spring',
                                stiffness: 300,
                                damping: 20,
                                delay: entryDelay,
                              },
                              ...(pulse && {
                                boxShadow: {
                                  duration: pulseDuration,
                                  repeat: Infinity,
                                  ease: 'easeInOut',
                                  delay: entryEnd + (wIdx + dIdx) * 0.05,
                                },
                              }),
                            }
                          : { duration: 0 }
                        }
                        whileHover={{
                          scale: 1.5,
                          boxShadow: `0 0 6px 2px ${toRgba(color, 0.8)}`,
                          zIndex: 10,
                        }}
                        onHoverStart={(e) => {
                          const el = (e.target as HTMLElement).getBoundingClientRect();
                          setTooltip({
                            date: day.date,
                            count: day.contributionCount,
                            x: el.left + cellSize / 2,
                            y: el.top,
                            elBottom: el.bottom,
                          });
                        }}
                        onHoverEnd={() => setTooltip(null)}
                        style={{
                          width: cellSize,
                          height: cellSize,
                          background: color,
                          borderRadius: cellRadius,
                          border: '1px solid rgba(27,31,35,0.06)',
                          flexShrink: 0,
                          cursor: 'default',
                          position: 'relative',
                        }}
                      >
                        {isToday && todayIndicator && (
                          <TodayPing color={resolvedTodayColor} cellSize={cellSize} borderRadius={cellRadius} />
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          {showLegend && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 8, marginLeft: DAY_COL_W }}>
              <span style={{ fontFamily: 'monospace', fontSize: 10, opacity: 0.5, marginRight: 4, userSelect: 'none' }}>
                Less
              </span>
              {COLORS.map((c, i) => (
                <div
                  key={i}
                  style={{ width: cellSize, height: cellSize, background: c, borderRadius: cellRadius }}
                />
              ))}
              <span style={{ fontFamily: 'monospace', fontSize: 10, opacity: 0.5, marginLeft: 4, userSelect: 'none' }}>
                More
              </span>
            </div>
          )}
        </div>

      </div>

      {/* Tooltip uses position:fixed to escape all overflow/clip contexts */}
      <AnimatePresence>
        {tooltip && (
          <motion.div
            ref={tooltipRef}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'fixed',
              left: tooltip.x + tooltipShift,
              top: tooltip.y < 40 ? tooltip.elBottom + 6 : tooltip.y - 34,
              transform: 'translateX(-50%)',
              pointerEvents: 'none',
              zIndex: 9999,
              background: isDark ? '#1e1e2e' : '#fff',
              border: `1px solid ${isDark ? '#3b3b5c' : '#e2e8f0'}`,
              borderRadius: 6,
              padding: '4px 8px',
              whiteSpace: 'nowrap',
              fontSize: 11,
              fontFamily: 'monospace',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              color: isDark ? '#e2e8f0' : '#1a1a2e',
            }}
          >
            <span style={{ fontWeight: 600 }}>{tooltip.count}</span>
            {' '}contribution{tooltip.count !== 1 ? 's' : ''}{' '}
            <span style={{ opacity: 0.6 }}>· {tooltip.date}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TodayPing({ color, cellSize, borderRadius }: { color: string; cellSize: number; borderRadius: number }) {
  return (
    <motion.span
      aria-hidden
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{
        opacity: [0, 0.7, 0],
        scale: [0.6, 1.8, 2.4],
      }}
      transition={{
        duration: 2.2,
        repeat: Infinity,
        repeatDelay: 0.6,
        ease: 'easeOut',
        delay: 1.5,
        times: [0, 0.4, 1],
      }}
      style={{
        position: 'absolute',
        inset: -1,
        borderRadius,
        boxShadow: `0 0 0 1.5px ${color}`,
        pointerEvents: 'none',
        width: cellSize,
        height: cellSize,
      }}
    />
  );
}
