interface ScoreCardProps {
  label: string;
  score: number;
  color?: string;
  size?: 'sm' | 'lg';
}

export default function ScoreCard({ label, score, color = '#6366f1', size = 'lg' }: ScoreCardProps) {
  const numScore = Number(score) || 0;

  return (
    <div className={`score-card score-card-${size}`}>
      <div className="score-card-header" style={{ marginBottom: 0 }}>
        <span className="score-card-label">{label}</span>
        <span className="score-card-value" style={{ color }}>
          {numScore.toFixed(1)}
        </span>
      </div>
    </div>
  );
}
