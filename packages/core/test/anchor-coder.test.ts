import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import { describe, expect, it } from 'vitest';
import { serializeDecoded, setFieldByPath } from '../src/patcher/anchor-coder.js';

describe('setFieldByPath', () => {
  it('updates a top-level numeric field', () => {
    const obj: Record<string, unknown> = { fee: 100 };
    setFieldByPath(obj, 'fee', '250');
    expect(obj.fee).toBe(250);
  });

  it('updates a nested field via dot path', () => {
    const obj: Record<string, unknown> = { fees: { protocol: 10, lp: 20 } };
    setFieldByPath(obj, 'fees.protocol', '99');
    expect((obj.fees as { protocol: number }).protocol).toBe(99);
  });

  it('coerces strings to BN for BN fields', () => {
    const obj: Record<string, unknown> = { amount: new BN(0) };
    setFieldByPath(obj, 'amount', '"1000000"');
    expect(obj.amount).toBeInstanceOf(BN);
    expect((obj.amount as BN).toString()).toBe('1000000');
  });

  it('coerces strings to PublicKey for PublicKey fields', () => {
    const obj: Record<string, unknown> = {
      admin: new PublicKey('11111111111111111111111111111111'),
    };
    setFieldByPath(obj, 'admin', '"MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"');
    expect(obj.admin).toBeInstanceOf(PublicKey);
    expect((obj.admin as PublicKey).toBase58()).toBe('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
  });

  it('rejects empty path', () => {
    expect(() => setFieldByPath({}, '', '1')).toThrow(/empty field path/);
  });

  it('rejects traversal through non-object', () => {
    expect(() => setFieldByPath({ x: 5 }, 'x.y', '1')).toThrow(/non-object/);
  });
});

describe('serializeDecoded', () => {
  it('converts BN to string', () => {
    expect(serializeDecoded(new BN('42'))).toBe('42');
  });

  it('converts PublicKey to base58', () => {
    expect(serializeDecoded(new PublicKey('11111111111111111111111111111111'))).toBe(
      '11111111111111111111111111111111',
    );
  });

  it('recurses into nested objects', () => {
    const out = serializeDecoded({ a: new BN(1), b: { c: new BN(2) } });
    expect(out).toEqual({ a: '1', b: { c: '2' } });
  });

  it('handles arrays', () => {
    expect(serializeDecoded([new BN(1), new BN(2)])).toEqual(['1', '2']);
  });
});
