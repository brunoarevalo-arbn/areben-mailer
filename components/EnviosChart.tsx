"use client";

import { useState } from "react";

export interface PuntoSerie {
  dia: string; // YYYY-MM-DD (UTC)
  env: number;
  abr: number;
  clk: number;
}

const SERIES = [
  { key: "env", label: "Envíos", color: "var(--chart-env)" },
  { key: "abr", label: "Aperturas", color: "var(--chart-abr)" },
  { key: "clk", label: "Clicks", color: "var(--chart-clk)" },
] as const;

// Geometría del viewBox (el SVG escala al ancho del contenedor).
const W = 720;
const H = 200;
const PAD = { t: 12, r: 10, b: 22, l: 34 };
const innerW = W - PAD.l - PAD.r;
const innerH = H - PAD.t - PAD.b;

const fmtDia = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
};
const nf = (n: number) => n.toLocaleString("es-AR");

export function EnviosChart({ data }: { data: PuntoSerie[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const n = data.length;
  const max = Math.max(1, ...data.flatMap((p) => [p.env, p.abr, p.clk]));
  const x = (i: number) => PAD.l + (n <= 1 ? 0 : (i * innerW) / (n - 1));
  const y = (v: number) => PAD.t + innerH * (1 - v / max);

  const linePath = (key: (typeof SERIES)[number]["key"]) =>
    data.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ");

  const areaPath =
    `M${x(0).toFixed(1)},${y(data[0].env).toFixed(1)} ` +
    data.map((p, i) => `L${x(i).toFixed(1)},${y(p.env).toFixed(1)}`).join(" ") +
    ` L${x(n - 1).toFixed(1)},${(PAD.t + innerH).toFixed(1)} L${x(0).toFixed(1)},${(PAD.t + innerH).toFixed(1)} Z`;

  // Ticks del eje Y (0, mitad, máximo).
  const yTicks = [0, Math.round(max / 2), max];
  // Etiquetas de eje X (primero, mitad, último).
  const xTicksIdx = n <= 1 ? [0] : [0, Math.floor((n - 1) / 2), n - 1];

  const totals = SERIES.map((s) => ({
    ...s,
    total: data.reduce((acc, p) => acc + p[s.key], 0),
  }));

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    const i = Math.max(0, Math.min(n - 1, Math.round(frac * (n - 1))));
    setHover(i);
  };

  const hp = hover != null ? data[hover] : null;
  const hoverLeftPct = hover != null && n > 1 ? (x(hover) / W) * 100 : 0;

  return (
    <div>
      {/* Leyenda = etiquetado directo (identidad no sólo por color) */}
      <div className="mb-3 flex flex-wrap items-center gap-4">
        {totals.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} aria-hidden />
            <span className="text-xs text-muted">{s.label}</span>
            <span className="text-xs font-semibold tabular-nums text-foreground">{nf(s.total)}</span>
          </div>
        ))}
        <span className="ml-auto text-xs text-subtle">Últimos 30 días</span>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ height: "auto" }}
          preserveAspectRatio="none"
          role="img"
          aria-label="Envíos, aperturas y clicks por día en los últimos 30 días"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          {/* Grilla horizontal recesiva + etiquetas Y */}
          {yTicks.map((v) => (
            <g key={v}>
              <line
                x1={PAD.l}
                x2={W - PAD.r}
                y1={y(v)}
                y2={y(v)}
                stroke="var(--border)"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
              <text x={PAD.l - 6} y={y(v) + 3} textAnchor="end" fontSize={10} fill="var(--subtle)">
                {nf(v)}
              </text>
            </g>
          ))}

          {/* Etiquetas X */}
          {xTicksIdx.map((i) => (
            <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize={10} fill="var(--subtle)">
              {fmtDia(data[i].dia)}
            </text>
          ))}

          {/* Área bajo Envíos (serie enfatizada) */}
          <path d={areaPath} fill="var(--chart-env)" fillOpacity={0.1} stroke="none" />

          {/* Líneas de cada serie */}
          {SERIES.map((s) => (
            <path
              key={s.key}
              d={linePath(s.key)}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {/* Crosshair + marcadores en hover */}
          {hover != null && (
            <>
              <line
                x1={x(hover)}
                x2={x(hover)}
                y1={PAD.t}
                y2={PAD.t + innerH}
                stroke="var(--border-strong)"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
              {SERIES.map((s) => (
                <circle
                  key={s.key}
                  cx={x(hover)}
                  cy={y(data[hover][s.key])}
                  r={4}
                  fill="var(--surface)"
                  stroke={s.color}
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </>
          )}
        </svg>

        {/* Tooltip */}
        {hp && (
          <div
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-border bg-surface px-3 py-2 shadow-md"
            style={{ left: `${hoverLeftPct}%` }}
          >
            <div className="mb-1 text-xs font-medium text-foreground">{fmtDia(hp.dia)}</div>
            {SERIES.map((s) => (
              <div key={s.key} className="flex items-center gap-2 text-xs">
                <span className="h-2 w-2 rounded-full" style={{ background: s.color }} aria-hidden />
                <span className="text-muted">{s.label}</span>
                <span className="ml-auto font-semibold tabular-nums text-foreground">{nf(hp[s.key])}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
