import { Keypair, VersionedTransaction } from '@solana/web3.js';
import { describe, expect, it } from 'vitest';
import { buildTransaction, signTransaction } from '../src/runtime/tx-builder.js';

describe('buildTransaction', () => {
  it('compiles a v0 versioned transaction with payer + ix', () => {
    const payer = Keypair.generate();
    const tx = buildTransaction({
      payer: payer.publicKey.toBase58(),
      recentBlockhash: 'GHsLhmJ5HhqFXJ9oJyaJW7ZGHaeXJ9oJyaJW7ZGHaeXJ',
      ixs: [
        {
          programId: 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr',
          accounts: [],
          dataBase64: Buffer.from('hi').toString('base64'),
        },
      ],
    });
    expect(tx).toBeInstanceOf(VersionedTransaction);
    expect(tx.message.staticAccountKeys[0]?.toBase58()).toBe(payer.publicKey.toBase58());
  });

  it('signs with provided keypair', () => {
    const payer = Keypair.generate();
    const tx = buildTransaction({
      payer: payer.publicKey.toBase58(),
      recentBlockhash: '11111111111111111111111111111111',
      ixs: [
        {
          programId: 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr',
          accounts: [],
          dataBase64: Buffer.from('hi').toString('base64'),
        },
      ],
    });
    signTransaction(tx, [
      { pubkey: payer.publicKey.toBase58(), secretKey: Array.from(payer.secretKey) },
    ]);
    expect(tx.signatures[0]).toBeDefined();
    expect(tx.signatures[0]?.every((b) => b === 0)).toBe(false);
  });
});
