import type { View } from '../core/frame';

/**
 * Top-down sketch of where to put the phone: the camera's field of view and the athlete
 * standing side-on or facing it, 2–3 m away.
 */
export function PlacementDiagram({ view, floor }: { view: View; floor?: boolean }) {
  const side = view === 'side';
  return (
    <svg viewBox="0 0 120 150" role="img" aria-label={`Phone ${floor ? 'on the floor ' : ''}${side ? 'to your side' : 'in front of you'}, 2 to 3 metres away`}>
      <defs>
        <linearGradient id="fov" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#c07a33" stopOpacity="0.32" />
          <stop offset="1" stopColor="#c07a33" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d="M60 128 L10 20 L110 20 Z" fill="url(#fov)" />
      {/* athlete seen from above: shoulders + head, facing direction arrow */}
      <g transform={`translate(60 42) rotate(${side ? 90 : 0})`}>
        <ellipse cx="0" cy="0" rx="20" ry="8" fill="#9c5d22" />
        <circle cx="0" cy="0" r="7" fill="#f6efe6" stroke="#9c5d22" strokeWidth="2" />
        <path d="M0 10 L0 22 M-5 17 L0 22 L5 17" stroke="#9c5d22" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      {/* phone */}
      <rect x={floor ? 44 : 50} y={floor ? 124 : 118} width={floor ? 32 : 20} height={floor ? 18 : 30} rx="4" fill="#17120e" stroke="#17120e" strokeWidth="2" />
      <circle cx="60" cy={floor ? 127 : 121} r="2" fill="#d8a066" />
      <path d="M100 32 L100 112" stroke="#a8998b" strokeWidth="1.5" strokeDasharray="3 3" />
      <text x="104" y="76" fill="#6b5e53" fontSize="10" fontWeight="700" transform="rotate(90 104 76)" textAnchor="middle">
        2–3 m
      </text>
    </svg>
  );
}
