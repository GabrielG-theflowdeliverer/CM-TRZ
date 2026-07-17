import { pctBand, type PctScores } from '@cmt/domain';

const FILL: Record<string, string> = {
  strength: '#16a34a',
  alert: '#d97706',
  risk: '#dc2626',
};

function box(score: number | null) {
  return {
    fill: score == null ? '#94a3b8' : FILL[pctBand(score)]!,
    text: score == null ? '—' : String(score),
  };
}

/**
 * The Prosci Change Triangle: Leadership/Sponsorship at the apex,
 * Project Management and Change Management at the base corners,
 * Success at the center.
 */
export function TriangleChart(props: { scores: PctScores }) {
  const leadership = box(props.scores.leadership);
  const pm = box(props.scores.project_management);
  const cm = box(props.scores.change_management);
  const success = box(props.scores.success);
  return (
    <svg viewBox="0 0 360 300" className="w-full max-w-sm" role="img" aria-label="PCT triangle">
      <polygon points="180,30 40,262 320,262" fill="#eef2ff" stroke="#6366f1" strokeWidth="2" />
      {/* Leadership / Sponsorship (apex) */}
      <g>
        <circle cx="180" cy="52" r="26" fill={leadership.fill} />
        <text x="180" y="57" textAnchor="middle" className="fill-white text-[15px] font-bold">
          {leadership.text}
        </text>
        <text x="180" y="14" textAnchor="middle" className="fill-slate-600 text-[12px] font-semibold">
          Leadership/Sponsorship
        </text>
      </g>
      {/* Project Management (bottom-left) */}
      <g>
        <circle cx="62" cy="240" r="26" fill={pm.fill} />
        <text x="62" y="245" textAnchor="middle" className="fill-white text-[15px] font-bold">
          {pm.text}
        </text>
        <text x="62" y="290" textAnchor="middle" className="fill-slate-600 text-[12px] font-semibold">
          Project Management
        </text>
      </g>
      {/* Change Management (bottom-right) */}
      <g>
        <circle cx="298" cy="240" r="26" fill={cm.fill} />
        <text x="298" y="245" textAnchor="middle" className="fill-white text-[15px] font-bold">
          {cm.text}
        </text>
        <text x="298" y="290" textAnchor="middle" className="fill-slate-600 text-[12px] font-semibold">
          Change Management
        </text>
      </g>
      {/* Success (center) */}
      <g>
        <circle cx="180" cy="185" r="30" fill={success.fill} />
        <text x="180" y="182" textAnchor="middle" className="fill-white text-[15px] font-bold">
          {success.text}
        </text>
        <text x="180" y="197" textAnchor="middle" className="fill-white text-[10px] font-semibold">
          Success
        </text>
      </g>
    </svg>
  );
}
