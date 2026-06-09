declare module 'bs58' {
  interface Bs58 {
    encode(source: Uint8Array): string;
    decode(s: string): Uint8Array;
  }
  const bs58: Bs58;
  export = bs58;
}
