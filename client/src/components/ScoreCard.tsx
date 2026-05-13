interface ScoreCardProps {
  label: string;
  score: number;
  maxScore: number;
  color?: string;
  size?: 'sm' | 'lg';
}

export default function ScoreCard({ label, score, maxScore, color = '#6366f1', size = 'lg' }: ScoreCardProps) {
  const numScore = Number(score) || 0;
  const pct = maxScore > 0 ? Math.min((numScore / maxScore) * 100, 100) : 0;

  return (
    <div className={`score-card score-card-${size}`}>
      <div className="score-card-header">
        <span className="score-card-label">{label}</span>
        <span className="score-card-value" style={{ color }}>
          {numScore.toFixed(1)}<span className="score-card-max">/{maxScore}</span>
        </span>
      </div>
      <div className="score-card-bar">
        <div
          className="score-card-fill"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${color}, ${color}cc)`,
          }}
        />
      </div>
      <span className="score-card-pct">{pct.toFixed(0)}%</span>
    </div>
  );
}
