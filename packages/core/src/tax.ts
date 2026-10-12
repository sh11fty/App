import type { Inputs } from './fields';

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface TaxSegment {
  financialYear: number;
  days: number;
  profit: number;
  rate: number;
  marginalRelief: number;
  tax: number;
}
export interface TaxComputation {
  accountingProfit: number;
  addBacks: number;
  capitalAllowances: number;
  tradingProfit: number;
  lossesUsed: number;
  charitableDonations: number;
  taxableProfit: number;
  segments: TaxSegment[];
  corporationTax: number;
  lossesCarriedForward: number;
}

const MAIN = 0.25;
const SMALL = 0.19;
const LOWER = 50000;
const UPPER = 250000;
const MR_FRACTION = 3 / 200;

const DAY = 86400000;
const utc = (s: string) => Date.parse(s + 'T00:00:00Z');

/** Financial year is named by the year it begins: FY2023 runs 1 Apr 2023 - 31 Mar 2024. */
function financialYearOf(t: number): number {
  const d = new Date(t);
  return d.getUTCMonth() >= 3 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
}

export function inclusiveDays(start: string, end: string): number {
  return Math.round((utc(end) - utc(start)) / DAY) + 1;
}

export function accountingProfit(i: Pick<Inputs, 'turnover' | 'costOfSales' | 'adminExpenses' | 'interestPayable'>): number {
  return round2(i.turnover - i.costOfSales - i.adminExpenses - i.interestPayable);
}

/** Corporation tax on profit for one period, apportioning profit across financial years by days. */
export function computeTax(i: Inputs): TaxComputation {
  const acctProfit = accountingProfit(i);
  const addBacks = round2(i.depreciation + i.otherAddBacks);
  const tradingProfit = round2(Math.max(0, acctProfit + addBacks - i.capitalAllowances));
  const lossesUsed = round2(Math.min(tradingProfit, i.lossesBroughtForward));
  const afterLosses = tradingProfit - lossesUsed;
  const donations = round2(Math.min(afterLosses, i.charitableDonations));
  const taxableProfit = round2(afterLosses - donations);

  const totalDays = inclusiveDays(i.periodStart, i.periodEnd);
  const divisor = 1 + i.associatedCompanies;
  const segments: TaxSegment[] = [];

  let cursor = utc(i.periodStart);
  const end = utc(i.periodEnd);
  while (cursor <= end) {
    const fy = financialYearOf(cursor);
    const fyEnd = Date.UTC(fy + 1, 2, 31);
    const segEnd = Math.min(end, fyEnd);
    const days = Math.round((segEnd - cursor) / DAY) + 1;
    const profit = round2((taxableProfit * days) / totalDays);

    let rate: number;
    let mr = 0;
    let tax: number;
    if (fy < 2023) {
      rate = SMALL;
      tax = profit * SMALL;
    } else {
      const lower = (LOWER * days) / 365 / divisor;
      const upper = (UPPER * days) / 365 / divisor;
      if (profit <= lower) {
        rate = SMALL;
        tax = profit * SMALL;
      } else if (profit >= upper) {
        rate = MAIN;
        tax = profit * MAIN;
      } else {
        rate = MAIN;
        mr = (upper - profit) * MR_FRACTION;
        tax = profit * MAIN - mr;
      }
    }
    segments.push({ financialYear: fy, days, profit, rate, marginalRelief: round2(mr), tax: round2(tax) });
    cursor = segEnd + DAY;
  }

  return {
    accountingProfit: acctProfit,
    addBacks,
    capitalAllowances: i.capitalAllowances,
    tradingProfit,
    lossesUsed,
    charitableDonations: donations,
    taxableProfit,
    segments,
    corporationTax: round2(segments.reduce((s, x) => s + x.tax, 0)),
    lossesCarriedForward: round2(i.lossesBroughtForward - lossesUsed + Math.max(0, -(acctProfit + addBacks - i.capitalAllowances))),
  };
}
