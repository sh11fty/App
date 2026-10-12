import { describe, expect, it } from 'vitest';
import { FIELDS, inputsSchema } from '@ltd-filer/core/shared';
import { MemoryWorkbook, normaliseCell } from '../src/workbook';
import { resultRows } from '../src/format';
import { buildStatements, computeTax } from '@ltd-filer/core/shared';

const field = (k: string) => FIELDS.find((f) => f.key === k)!;

describe('normaliseCell', () => {
  it('converts Excel date serials to ISO dates', () => {
    expect(normaliseCell(field('periodStart'), 45383)).toBe('2024-04-01');
    expect(normaliseCell(field('periodEnd'), '2025-03-31')).toBe('2025-03-31');
  });
  it('treats blank numbers as zero and trims text', () => {
    expect(normaliseCell(field('turnover'), '')).toBe(0);
    expect(normaliseCell(field('name'), '  Acme  ')).toBe('Acme');
  });
});

describe('MemoryWorkbook', () => {
  it('provides sample inputs that validate and balance', async () => {
    const wb = new MemoryWorkbook();
    const i = inputsSchema.parse(await wb.readInputs());
    expect(buildStatements(i).balances).toBe(true);
  });
  it('lists every field exactly once', () => {
    expect(new Set(FIELDS.map((f) => f.key)).size).toBe(FIELDS.length);
  });
});

describe('resultRows', () => {
  it('ends with key totals', async () => {
    const i = inputsSchema.parse(await new MemoryWorkbook().readInputs());
    const rows = resultRows(i, buildStatements(i), computeTax(i));
    expect(rows.find(([k]) => k === 'Corporation tax')![1]).toBe(computeTax(i).corporationTax);
  });
});
