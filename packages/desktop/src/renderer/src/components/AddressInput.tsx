import { useId } from 'react';
import type { AddressSuggestion } from './useAddressSuggestions';

export function AddressInput({
  value,
  onChange,
  suggestions,
  placeholder = 'base58 pubkey',
  className,
  style,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  suggestions: AddressSuggestion[];
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  autoFocus?: boolean;
}): JSX.Element {
  const id = useId();
  return (
    <>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`mono ${className ?? ''}`}
        list={id}
        style={style}
        autoFocus={autoFocus}
      />
      <datalist id={id}>
        {suggestions.map((s) => (
          <option key={s.pubkey} value={s.pubkey}>
            {s.label}
          </option>
        ))}
      </datalist>
    </>
  );
}
