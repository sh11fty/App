import type { Inputs } from './fields';
import { buildStatements } from './statements';
import { esc } from './xml';

/**
 * Micro-entity style iXBRL accounts. Concept names follow the FRC UK GAAP "core" taxonomy.
 * Must be validated against the current FRC taxonomy and Companies House rules before live filing.
 */
export const FRC_TAXONOMY = 'http://xbrl.frc.org.uk/fr/2023-01-01/core';
const BUS = 'http://xbrl.frc.org.uk/cd/2023-01-01/business';

export function buildAccountsIxbrl(i: Inputs): string {
  const s = buildStatements(i);
  const ctxD = 'D';
  const ctxI = 'I';
  const num = (concept: string, v: number, ctx: string, sign = false) =>
    `<ix:nonFraction name="core:${concept}" contextRef="${ctx}" unitRef="GBP" decimals="0" format="ixt2:numdotdecimal"${sign && v < 0 ? ' sign="-"' : ''}>${Math.abs(Math.round(v)).toLocaleString('en-GB')}</ix:nonFraction>`;
  const row = (label: string, concept: string, v: number, ctx: string) =>
    `<tr><td>${esc(label)}</td><td class="n">${num(concept, v, ctx, true)}</td></tr>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:ix="http://www.xbrl.org/2013/inlineXBRL" xmlns:ixt2="http://www.xbrl.org/inlineXBRL/transformation/2011-07-31" xmlns:xbrli="http://www.xbrl.org/2003/instance" xmlns:link="http://www.xbrl.org/2003/linkbase" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:iso4217="http://www.xbrl.org/2003/iso4217" xmlns:core="${FRC_TAXONOMY}" xmlns:bus="${BUS}">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>
<title>${esc(i.name)} - Accounts for the period ended ${esc(i.periodEnd)}</title>
<style>body{font-family:Arial,sans-serif;max-width:700px;margin:2em auto}td.n{text-align:right}table{width:100%}</style>
</head>
<body>
<div style="display:none"><ix:header>
<ix:references><link:schemaRef xlink:type="simple" xlink:href="${FRC_TAXONOMY}-2023-01-01.xsd"/></ix:references>
<ix:resources>
<xbrli:context id="${ctxD}"><xbrli:entity><xbrli:identifier scheme="http://www.companieshouse.gov.uk/">${esc(i.number.toUpperCase())}</xbrli:identifier></xbrli:entity><xbrli:period><xbrli:startDate>${i.periodStart}</xbrli:startDate><xbrli:endDate>${i.periodEnd}</xbrli:endDate></xbrli:period></xbrli:context>
<xbrli:context id="${ctxI}"><xbrli:entity><xbrli:identifier scheme="http://www.companieshouse.gov.uk/">${esc(i.number.toUpperCase())}</xbrli:identifier></xbrli:entity><xbrli:period><xbrli:instant>${i.periodEnd}</xbrli:instant></xbrli:period></xbrli:context>
<xbrli:unit id="GBP"><xbrli:measure>iso4217:GBP</xbrli:measure></xbrli:unit>
</ix:resources>
</ix:header></div>
<h1><ix:nonNumeric name="bus:EntityCurrentLegalOrRegisteredName" contextRef="${ctxD}">${esc(i.name)}</ix:nonNumeric></h1>
<p>Registered number <ix:nonNumeric name="bus:UKCompaniesHouseRegisteredNumber" contextRef="${ctxD}">${esc(i.number.toUpperCase())}</ix:nonNumeric></p>
<p>Period ended <ix:nonNumeric name="bus:BalanceSheetDate" contextRef="${ctxI}">${i.periodEnd}</ix:nonNumeric></p>
<h2>Profit and loss account</h2>
<table>
${row('Turnover', 'TurnoverRevenue', i.turnover, ctxD)}
${row('Gross profit', 'GrossProfitLoss', s.grossProfit, ctxD)}
${row('Operating profit', 'OperatingProfitLoss', s.operatingProfit, ctxD)}
${row('Profit before tax', 'ProfitLossOnOrdinaryActivitiesBeforeTax', s.profitBeforeTax, ctxD)}
${row('Tax on profit', 'TaxTaxCreditOnProfitOrLossOnOrdinaryActivities', s.taxCharge, ctxD)}
${row('Profit for the financial year', 'ProfitLoss', s.profitAfterTax, ctxD)}
</table>
<h2>Balance sheet</h2>
<table>
${row('Fixed assets', 'FixedAssets', i.fixedAssets, ctxI)}
${row('Current assets', 'CurrentAssets', i.currentAssets, ctxI)}
${row('Creditors: amounts falling due within one year', 'Creditors', i.creditorsDueWithinYear, ctxI)}
${row('Net current assets', 'NetCurrentAssetsLiabilities', s.netCurrentAssets, ctxI)}
${row('Total assets less current liabilities', 'TotalAssetsLessCurrentLiabilities', s.totalAssetsLessCurrentLiabilities, ctxI)}
${row('Net assets', 'NetAssetsLiabilities', s.netAssets, ctxI)}
${row('Called up share capital', 'CalledUpShareCapital', i.calledUpShareCapital, ctxI)}
${row('Profit and loss account', 'RetainedEarningsAccumulatedLosses', s.closingReserves, ctxI)}
${row('Shareholders\' funds', 'Equity', s.equity, ctxI)}
</table>
<p>These accounts have been prepared in accordance with the micro-entity provisions and delivered in accordance with the provisions applicable to companies subject to the small companies regime.</p>
</body>
</html>`;
}
