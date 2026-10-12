import type { Inputs } from './fields';
import { accountingProfit, computeTax, round2 } from './tax';

export interface Statements {
  grossProfit: number;
  operatingProfit: number;
  profitBeforeTax: number;
  taxCharge: number;
  profitAfterTax: number;
  netCurrentAssets: number;
  totalAssetsLessCurrentLiabilities: number;
  netAssets: number;
  closingReserves: number;
  equity: number;
  balances: boolean;
  difference: number;
}

export function buildStatements(i: Inputs): Statements {
  const grossProfit = round2(i.turnover - i.costOfSales);
  const operatingProfit = round2(grossProfit - i.adminExpenses);
  const profitBeforeTax = accountingProfit(i);
  const taxCharge = computeTax(i).corporationTax;
  const profitAfterTax = round2(profitBeforeTax - taxCharge);
  const netCurrentAssets = round2(i.currentAssets - i.creditorsDueWithinYear);
  const totalAssetsLessCurrentLiabilities = round2(i.fixedAssets + netCurrentAssets);
  const netAssets = round2(totalAssetsLessCurrentLiabilities - i.creditorsDueAfterYear);
  const closingReserves = round2(i.openingReserves + profitAfterTax - i.dividends);
  const equity = round2(i.calledUpShareCapital + closingReserves);
  const difference = round2(netAssets - equity);
  return {
    grossProfit, operatingProfit, profitBeforeTax, taxCharge, profitAfterTax,
    netCurrentAssets, totalAssetsLessCurrentLiabilities, netAssets,
    closingReserves, equity, difference, balances: Math.abs(difference) < 0.005,
  };
}
