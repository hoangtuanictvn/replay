export function Spinner({ size = 14 }: { size?: number }): JSX.Element {
  return (
    <span
      className="spinner"
      style={{
        width: size,
        height: size,
        display: 'inline-block',
        verticalAlign: 'middle',
      }}
    />
  );
}
