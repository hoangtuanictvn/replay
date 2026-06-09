export function printJson(value: unknown): void {
  console.log(
    JSON.stringify(
      value,
      (_key, v) => {
        if (typeof v === 'bigint') return v.toString();
        if (v instanceof Uint8Array) return `<bytes:${v.length}>`;
        return v;
      },
      2,
    ),
  );
}
