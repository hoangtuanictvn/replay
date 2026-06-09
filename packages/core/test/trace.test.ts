import { describe, expect, it } from 'vitest';
import { parseTrace } from '../src/trace/parser.js';

describe('parseTrace', () => {
  it('parses a single top-level instruction with CU', () => {
    const logs = [
      'Program MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr invoke [1]',
      'Program log: Memo (len 18): "hello from litesvm"',
      'Program MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr consumed 7929 of 200000 compute units',
      'Program MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr success',
    ];
    const roots = parseTrace(logs);
    expect(roots).toHaveLength(1);
    const root = roots[0]!;
    expect(root.programId).toBe('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
    expect(root.depth).toBe(1);
    expect(root.cuConsumed).toBe(7929n);
    expect(root.cuRemaining).toBe(200000n - 7929n);
    expect(root.error).toBeNull();
    expect(root.children).toHaveLength(0);
  });

  it('parses nested CPI as children', () => {
    const logs = [
      'Program AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA invoke [1]',
      'Program log: outer start',
      'Program BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB invoke [2]',
      'Program log: inner work',
      'Program BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB consumed 1500 of 198000 compute units',
      'Program BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB success',
      'Program log: outer continued',
      'Program AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA consumed 5000 of 200000 compute units',
      'Program AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA success',
    ];
    const roots = parseTrace(logs);
    expect(roots).toHaveLength(1);
    const outer = roots[0]!;
    expect(outer.cuConsumed).toBe(5000n);
    expect(outer.children).toHaveLength(1);
    const inner = outer.children[0]!;
    expect(inner.programId).toBe('BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB');
    expect(inner.depth).toBe(2);
    expect(inner.cuConsumed).toBe(1500n);
  });

  it('captures program failure', () => {
    const logs = [
      'Program AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA invoke [1]',
      'Program log: about to error',
      'Program AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA failed: custom program error: 0x1234',
    ];
    const roots = parseTrace(logs);
    const root = roots[0]!;
    expect(root.error).toBe('custom program error: 0x1234');
  });

  it('captures return data', () => {
    const logs = [
      'Program AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA invoke [1]',
      'Program return: AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA aGVsbG8=',
      'Program AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA consumed 100 of 200000 compute units',
      'Program AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA success',
    ];
    const root = parseTrace(logs)[0]!;
    expect(root.returnData).toBeInstanceOf(Uint8Array);
    expect(Buffer.from(root.returnData!).toString()).toBe('hello');
  });

  it('handles multiple top-level instructions', () => {
    const logs = [
      'Program AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA invoke [1]',
      'Program AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA consumed 100 of 200000 compute units',
      'Program AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA success',
      'Program BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB invoke [1]',
      'Program BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB consumed 200 of 200000 compute units',
      'Program BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB success',
    ];
    const roots = parseTrace(logs);
    expect(roots).toHaveLength(2);
    expect(roots[0]!.instructionIndex).toBe(0);
    expect(roots[1]!.instructionIndex).toBe(1);
  });
});
