import { describe, expect, it } from 'vitest';
import { buildStatements, computeTax, inputsSchema, sampleInputs } from '../src/shared';

describe('buildStatements', () => {
  it('derives profit and balance sheet figures', () => {
    const i = inputsSchema.parse(sampleInputs());
    const s = buildStatements(i);
    expect(s.grossProfit).toBe(140000);
    expect(s.operatingProfit).toBe(80000);
    expect(s.profitBeforeTax).toBe(79500);
    expect(s.taxCharge).toBe(computeTax(i).corporationTax);
    expect(s.netCurrentAssets).toBe(35000);
    expect(s.netAssets).toBe(45000);
    expect(s.equity).toBe(100 + s.closingReserves);
  });

  it('reports when the balance sheet does not balance', () => {
    const s = buildStatements(inputsSchema.parse(sampleInputs()));
    expect(s.balances).toBe(s.difference === 0);
    const balanced = buildStatements(inputsSchema.parse({ ...sampleInputs(), openingReserves: 45000 - 100 - (s.profitAfterTax - 20000) }));
    expect(balanced.balances).toBe(true);
  });
});
