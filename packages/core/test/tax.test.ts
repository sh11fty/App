import { describe, expect, it } from 'vitest';
import { computeTax, inclusiveDays, inputsSchema, sampleInputs, type Inputs } from '../src/shared';

const base = (o: Partial<Record<string, string | number>> = {}): Inputs =>
  inputsSchema.parse({ ...sampleInputs(), ...o });

describe('computeTax', () => {
  it('applies the small profits rate below £50k', () => {
    const t = computeTax(base({ turnover: 100000, costOfSales: 0, adminExpenses: 30000, depreciation: 0, interestPayable: 0, capitalAllowances: 0 }));
    expect(t.taxableProfit).toBe(70000 - 0);
    // 70k is in the marginal relief band; check the 40k case separately
    const small = computeTax(base({ turnover: 40000, costOfSales: 0, adminExpenses: 0, depreciation: 0, interestPayable: 0, capitalAllowances: 0 }));
    expect(small.corporationTax).toBe(7600);
  });

  it('applies the main rate at or above £250k', () => {
    const t = computeTax(base({ turnover: 300000, costOfSales: 0, adminExpenses: 0, depreciation: 0, interestPayable: 0, capitalAllowances: 0 }));
    expect(t.corporationTax).toBe(75000);
  });

  it('applies marginal relief between the limits', () => {
    // profit 100k: 25k - (250k-100k)*3/200 = 25,000 - 2,250 = 22,750
    const t = computeTax(base({ turnover: 100000, costOfSales: 0, adminExpenses: 0, depreciation: 0, interestPayable: 0, capitalAllowances: 0 }));
    expect(t.corporationTax).toBe(22750);
    expect(t.segments[0].marginalRelief).toBe(2250);
  });

  it('divides the limits by associated companies', () => {
    // 1 associate: limits 25k / 125k. profit 100k: 25,000 - (125k-100k)*0.015 = 24,625
    const t = computeTax(base({ associatedCompanies: 1, turnover: 100000, costOfSales: 0, adminExpenses: 0, depreciation: 0, interestPayable: 0, capitalAllowances: 0 }));
    expect(t.corporationTax).toBe(24625);
  });

  it('adds back depreciation, deducts allowances and uses losses', () => {
    const t = computeTax(base({ turnover: 50000, costOfSales: 0, adminExpenses: 10000, depreciation: 2000, interestPayable: 0, capitalAllowances: 5000, lossesBroughtForward: 7000, charitableDonations: 1000 }));
    expect(t.accountingProfit).toBe(40000);
    expect(t.tradingProfit).toBe(37000);
    expect(t.lossesUsed).toBe(7000);
    expect(t.charitableDonations).toBe(1000);
    expect(t.taxableProfit).toBe(29000);
    expect(t.corporationTax).toBe(5510);
  });

  it('never produces negative tax and carries forward a loss', () => {
    const t = computeTax(base({ turnover: 1000, costOfSales: 0, adminExpenses: 5000, depreciation: 0, interestPayable: 0, capitalAllowances: 0, lossesBroughtForward: 100 }));
    expect(t.corporationTax).toBe(0);
    expect(t.lossesCarriedForward).toBe(4100);
  });

  it('splits a period straddling a financial-year boundary by days', () => {
    const t = computeTax(base({ periodStart: '2024-01-01', periodEnd: '2024-12-31', turnover: 366000, costOfSales: 0, adminExpenses: 0, depreciation: 0, interestPayable: 0, capitalAllowances: 0 }));
    expect(t.segments.map((s) => s.financialYear)).toEqual([2023, 2024]);
    expect(t.segments[0].days + t.segments[1].days).toBe(366);
    expect(t.segments.reduce((a, s) => a + s.profit, 0)).toBeCloseTo(366000, 1);
  });

  it('uses 19% flat for financial years before 2023', () => {
    const t = computeTax(base({ periodStart: '2022-04-01', periodEnd: '2023-03-31', turnover: 300000, costOfSales: 0, adminExpenses: 0, depreciation: 0, interestPayable: 0, capitalAllowances: 0 }));
    expect(t.corporationTax).toBe(57000);
  });
});

describe('helpers and validation', () => {
  it('counts inclusive days', () => {
    expect(inclusiveDays('2024-04-01', '2025-03-31')).toBe(365);
  });
  it('rejects bad input', () => {
    expect(() => base({ utr: '123' })).toThrow();
    expect(() => base({ number: 'abc' })).toThrow();
    expect(() => base({ periodEnd: '2024-03-01' })).toThrow();
    expect(() => base({ periodStart: '2023-01-01', periodEnd: '2025-01-01' })).toThrow(/12 months/);
  });
});
