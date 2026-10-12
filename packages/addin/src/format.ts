import type { Inputs, Statements, TaxComputation } from '@ltd-filer/core/shared';

export const money = (n: number) => n.toLocaleString('en-GB', { style: 'currency', currency: 'GBP' });

export function resultRows(i: Inputs, s: Statements, t: TaxComputation): [string, string | number][] {
  return [
    ['Company', i.name],
    ['Period', `${i.periodStart} to ${i.periodEnd}`],
    ['Turnover', i.turnover],
    ['Gross profit', s.grossProfit],
    ['Profit before tax', t.accountingProfit],
    ['Add back: depreciation and disallowables', t.addBacks],
    ['Less: capital allowances', t.capitalAllowances],
    ['Trading profit', t.tradingProfit],
    ['Less: losses used', t.lossesUsed],
    ['Less: charitable donations', t.charitableDonations],
    ['Taxable profit', t.taxableProfit],
    ...t.segments.map((x): [string, number] => [`Tax FY${x.financialYear} (${x.days} days, ${(x.rate * 100).toFixed(0)}%${x.marginalRelief ? `, MR ${x.marginalRelief}` : ''})`, x.tax]),
    ['Corporation tax', t.corporationTax],
    ['Profit after tax', s.profitAfterTax],
    ['Net assets', s.netAssets],
  ];
}
