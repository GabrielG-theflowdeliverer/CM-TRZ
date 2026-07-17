/**
 * Risk quadrant plot: X = Change Characteristics, Y = Organizational
 * Attributes, both 14-70 with quadrant boundaries at 42 (mirrors the
 * Excel scatter chart on DA-Rk).
 */
export function QuadrantChart(props: {
  points: Array<{ cc: number; oa: number; label?: string; current?: boolean }>;
}) {
  const min = 14;
  const max = 70;
  const size = 280;
  const pad = 34;
  const scale = (v: number) => pad + ((v - min) / (max - min)) * (size - 2 * pad);
  const x = (cc: number) => scale(cc);
  const yPos = (oa: number) => size - pad - ((oa - min) / (max - min)) * (size - 2 * pad);
  const mid = 42;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-xs" role="img" aria-label="Risk quadrant">
      {/* quadrant fills */}
      <rect x={x(min)} y={yPos(max)} width={x(mid) - x(min)} height={yPos(mid) - yPos(max)} fill="#fef3c7" />
      <rect x={x(mid)} y={yPos(max)} width={x(max) - x(mid)} height={yPos(mid) - yPos(max)} fill="#fee2e2" />
      <rect x={x(min)} y={yPos(mid)} width={x(mid) - x(min)} height={yPos(min) - yPos(mid)} fill="#dcfce7" />
      <rect x={x(mid)} y={yPos(mid)} width={x(max) - x(mid)} height={yPos(min) - yPos(mid)} fill="#fef3c7" />
      {/* labels */}
      <text x={x(28)} y={yPos(28)} textAnchor="middle" className="fill-green-700 text-[10px] font-semibold">Low</text>
      <text x={x(56)} y={yPos(56)} textAnchor="middle" className="fill-red-700 text-[10px] font-semibold">High</text>
      <text x={x(28)} y={yPos(56)} textAnchor="middle" className="fill-amber-700 text-[10px] font-semibold">Medium</text>
      <text x={x(56)} y={yPos(28)} textAnchor="middle" className="fill-amber-700 text-[10px] font-semibold">Medium</text>
      {/* axes */}
      <line x1={x(min)} y1={yPos(min)} x2={x(max)} y2={yPos(min)} stroke="#64748b" />
      <line x1={x(min)} y1={yPos(min)} x2={x(min)} y2={yPos(max)} stroke="#64748b" />
      <line x1={x(mid)} y1={yPos(min)} x2={x(mid)} y2={yPos(max)} stroke="#94a3b8" strokeDasharray="4 3" />
      <line x1={x(min)} y1={yPos(mid)} x2={x(max)} y2={yPos(mid)} stroke="#94a3b8" strokeDasharray="4 3" />
      {/* ticks */}
      {[14, 42, 70].map((v) => (
        <g key={v}>
          <text x={x(v)} y={yPos(min) + 14} textAnchor="middle" className="fill-slate-500 text-[9px]">{v}</text>
          <text x={x(min) - 8} y={yPos(v) + 3} textAnchor="end" className="fill-slate-500 text-[9px]">{v}</text>
        </g>
      ))}
      <text x={size / 2} y={size - 2} textAnchor="middle" className="fill-slate-600 text-[10px] font-medium">
        Change Characteristics
      </text>
      <text
        x={10}
        y={size / 2}
        textAnchor="middle"
        transform={`rotate(-90 10 ${size / 2})`}
        className="fill-slate-600 text-[10px] font-medium"
      >
        Organizational Attributes
      </text>
      {/* points: history faded, current bold */}
      {props.points.map((p, i) => (
        <g key={i}>
          <circle
            cx={x(p.cc)}
            cy={yPos(p.oa)}
            r={p.current ? 7 : 4}
            fill={p.current ? '#4f46e5' : '#a5b4fc'}
            stroke="#fff"
            strokeWidth="1.5"
          >
            <title>{`${p.label ?? ''} CC: ${p.cc}, OA: ${p.oa}`}</title>
          </circle>
        </g>
      ))}
    </svg>
  );
}
