import { motion } from 'framer-motion';

const grid = Array.from({ length: 9 }, (_, index) => 36 + index * 46);

export function FeasibleGraph({ layers = {}, compact = false, integerPoint = false }) {
  const show = (key) => layers[key] !== false;
  return (
    <div className={`graph ${compact ? 'graph--compact' : ''}`}>
      <svg viewBox="0 0 520 390" role="img" aria-label="Região viável e solução ótima do modelo">
        <defs>
          <linearGradient id="feasibleFill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.34" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.12" />
          </linearGradient>
          <filter id="pointGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <g className="graph__grid">
          {grid.map((v) => <line key={`x${v}`} x1={v} y1="20" x2={v} y2="350" />)}
          {grid.slice(0, 7).map((v) => <line key={`y${v}`} x1="36" y1={v} x2="500" y2={v} />)}
        </g>
        <line className="graph__axis" x1="36" y1="350" x2="500" y2="350" />
        <line className="graph__axis" x1="36" y1="350" x2="36" y2="20" />
        <text className="graph__label" x="492" y="373">x₁</text>
        <text className="graph__label" x="16" y="24">x₂</text>
        {show('constraints') && (
          <g className="graph__constraints">
            <motion.line initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8 }} x1="36" y1="92" x2="500" y2="278" />
            <motion.line initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8, delay: 0.12 }} x1="86" y1="350" x2="408" y2="20" />
            <motion.line initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8, delay: 0.24 }} x1="36" y1="214" x2="500" y2="214" />
          </g>
        )}
        {show('region') && (
          <motion.polygon
            points="82,304 174,212 312,212 382,259 314,320 128,332"
            fill="url(#feasibleFill)"
            stroke="#8b5cf6"
            strokeWidth="2"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.55, delay: 0.35 }}
            style={{ transformOrigin: '240px 272px' }}
          />
        )}
        {show('levels') && (
          <g className="graph__levels">
            {[0, 1, 2].map((item) => (
              <motion.line
                key={item}
                x1={140 + item * 44}
                y1="350"
                x2={420 + item * 32}
                y2="70"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 + item * 0.08 }}
              />
            ))}
          </g>
        )}
        {show('optimum') && (
          <g filter="url(#pointGlow)">
            <motion.circle cx="314" cy="212" r="7" fill="#a78bfa" initial={{ r: 0 }} animate={{ r: [0, 10, 7] }} transition={{ duration: 0.7, delay: 0.75 }} />
            <circle cx="314" cy="212" r="15" fill="none" stroke="#a78bfa" strokeOpacity="0.38" />
          </g>
        )}
        {integerPoint && (
          <g>
            <motion.circle cx="296" cy="198" r="6" fill="#34d399" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.9 }} />
            <text className="graph__annotation graph__annotation--green" x="306" y="190">inteira (7, 5)</text>
          </g>
        )}
        <g className="graph__ticks">
          {[0, 2, 4, 6, 8, 10].map((value, index) => <text key={`xt${value}`} x={34 + index * 92} y="372">{value}</text>)}
          {[2, 4, 6, 8, 10].map((value, index) => <text key={`yt${value}`} x="15" y={351 - (index + 1) * 58}>{value}</text>)}
        </g>
        {show('optimum') && <text className="graph__annotation" x="326" y="229">ótimo (7,5; 4,5)</text>}
      </svg>
    </div>
  );
}
