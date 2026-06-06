const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT:              { label: 'Draft',             color: '#94a3b8', bg: '#94a3b815' },
  REVERTED:           { label: 'Reverted',          color: '#eab308', bg: '#eab30815' },
  SUBMITTED:          { label: 'Submitted',         color: '#3b82f6', bg: '#3b82f615' },
  HOD_REVIEWED:       { label: 'HOD Reviewed',      color: '#8b5cf6', bg: '#8b5cf615' },
  REVIEWER_ASSIGNED:  { label: 'Reviewer Assigned', color: '#f59e0b', bg: '#f59e0b15' },
  REVIEWER_REVIEWED:  { label: 'Reviewer Done',     color: '#06b6d4', bg: '#06b6d415' },
  PRINCIPAL_REVIEWED: { label: 'Principal Done',    color: '#a855f7', bg: '#a855f715' },
  FROZEN:             { label: 'Frozen',            color: '#10b981', bg: '#10b98115' },
  SENT_TO_ACCOUNTS:   { label: 'Sent to Accounts',  color: '#6366f1', bg: '#6366f115' },
  RECOMMENDED:        { label: 'Recommended',       color: '#10b981', bg: '#10b98115' },
  NOT_RECOMMENDED:    { label: 'Not Recommended',   color: '#ef4444', bg: '#ef444415' },
  APPROVED:           { label: 'Approved',          color: '#10b981', bg: '#10b98115' },
  REJECTED:           { label: 'Rejected',          color: '#ef4444', bg: '#ef444415' },
  active:             { label: 'Active',            color: '#10b981', bg: '#10b98115' },
  inactive:           { label: 'Inactive',          color: '#ef4444', bg: '#ef444415' },
};

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = statusConfig[status] || { label: status, color: '#94a3b8', bg: '#94a3b815' };

  return (
    <span
      className={`status-badge status-badge-${size}`}
      style={{
        color: config.color,
        background: config.bg,
        border: `1px solid ${config.color}30`,
      }}
    >
      <span className="status-dot" style={{ background: config.color }} />
      {config.label}
    </span>
  );
}
