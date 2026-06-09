import { useState } from 'react';

export function Pubkey({
  value,
  long,
  className,
}: {
  value: string;
  long?: boolean;
  className?: string;
}): JSX.Element {
  const [copied, setCopied] = useState(false);
  const display = long ? `${value.slice(0, 8)}…${value.slice(-8)}` : `${value.slice(0, 4)}…${value.slice(-4)}`;
  return (
    <span
      className={`pubkey ${className ?? ''}`}
      title={value}
      onClick={async (e) => {
        e.stopPropagation();
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 900);
      }}
    >
      <span className="mono">{display}</span>
      <span className="pubkey-copy">{copied ? '✓' : '⧉'}</span>
    </span>
  );
}
