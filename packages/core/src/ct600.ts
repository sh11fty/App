import type { Inputs } from './fields';
import { computeTax } from './tax';
import { buildStatements } from './statements';
import { esc, gbp } from './xml';
import { buildAccountsIxbrl } from './ixbrl';
import { gzipBase64 } from './encode';
import { buildGovTalk, type Credentials, type Vendor } from './govtalk';
import { insertIrmark } from './irmark';

const CT_NS = 'http://www.govtalk.gov.uk/taxation/CT/5';

/** Body of a CT600 return (IRenvelope). Simplified box set; validate against HMRC's current CT schema before live use. */
export function buildCt600Body(i: Inputs, vendor: Vendor, withAttachments = true): string {
  const t = computeTax(i);
  const st = buildStatements(i);
  const accounts = withAttachments ? gzipBase64(buildAccountsIxbrl(i)) : '';
  return `<IRenvelope xmlns="${CT_NS}">
<IRheader>
<Keys><Key Type="UTR">${esc(i.utr)}</Key></Keys>
<PeriodEnd>${i.periodEnd}</PeriodEnd>
<DefaultCurrency>GBP</DefaultCurrency>
<IRmark Type="generic"></IRmark>
<Sender>Company</Sender>
</IRheader>
<CompanyTaxReturn ReturnType="new">
<CompanyInformation>
<CompanyName>${esc(i.name)}</CompanyName>
<RegistrationNumber>${esc(i.number.toUpperCase())}</RegistrationNumber>
<Reference>${esc(i.utr)}</Reference>
<CompType>6</CompType>
<PeriodCovered><From>${i.periodStart}</From><To>${i.periodEnd}</To></PeriodCovered>
</CompanyInformation>
<ReturnInfoSummary>
<Accounts><ThisPeriodAccounts>yes</ThisPeriodAccounts></Accounts>
<Computations><ThisPeriodComputations>yes</ThisPeriodComputations></Computations>
</ReturnInfoSummary>
<Turnover><Total>${gbp(i.turnover)}</Total></Turnover>
<CompanyTaxCalculation>
<Income><Trading><Profits>${gbp(t.tradingProfit)}</Profits><LossesBroughtForward>${gbp(t.lossesUsed)}</LossesBroughtForward><NetProfits>${gbp(t.tradingProfit - t.lossesUsed)}</NetProfits></Trading></Income>
<ChargesAndReliefs><QualifyingDonations>${gbp(t.charitableDonations)}</QualifyingDonations></ChargesAndReliefs>
<ChargeableProfits>${gbp(t.taxableProfit)}</ChargeableProfits>
<CorporationTaxChargeable>
${t.segments.map((s) => `<FinancialYear><Year>${s.financialYear}</Year><Details><Profit>${gbp(s.profit)}</Profit><TaxRate>${(s.rate * 100).toFixed(2)}</TaxRate><Tax>${gbp(s.tax)}</Tax></Details>${s.marginalRelief ? `<MarginalRate><Relief>${gbp(s.marginalRelief)}</Relief></MarginalRate>` : ''}</FinancialYear>`).join('\n')}
</CorporationTaxChargeable>
<CorporationTax>${gbp(t.corporationTax)}</CorporationTax>
<NetCorporationTaxChargeable>${gbp(t.corporationTax)}</NetCorporationTaxChargeable>
<TaxChargeable>${gbp(t.corporationTax)}</TaxChargeable>
</CompanyTaxCalculation>
<CalculationOfTaxOutstandingOrOverpaid><NetCorporationTaxLiability>${gbp(t.corporationTax)}</NetCorporationTaxLiability><TaxPayable>${gbp(t.corporationTax)}</TaxPayable></CalculationOfTaxOutstandingOrOverpaid>
<AssociatedCompanies><ThisPeriod><Companies>${i.associatedCompanies}</Companies></ThisPeriod></AssociatedCompanies>
<Declaration><AcceptDeclaration>yes</AcceptDeclaration><Name>${esc(vendor.declarantName)}</Name><Status>Director</Status></Declaration>
</CompanyTaxReturn>
${withAttachments ? `<AttachedFiles><XBRLsubmission><Accounts><Instance><EncodedInlineXBRLDocument>${accounts}</EncodedInlineXBRLDocument></Instance></Accounts></XBRLsubmission></AttachedFiles>` : ''}
<!-- profit after tax ${gbp(st.profitAfterTax)} -->
</IRenvelope>`;
}

export function buildCt600Message(i: Inputs, creds: Credentials, vendor: Vendor, opts: { test?: boolean } = {}): string {
  const body = buildCt600Body(i, vendor);
  const xml = buildGovTalk({
    messageClass: 'HMRC-CT-CT600',
    qualifier: 'request',
    fn: 'submit',
    keys: [{ type: 'UTR', value: i.utr }],
    credentials: creds,
    vendor,
    gatewayTest: opts.test ?? true,
    body,
  });
  return insertIrmark(xml);
}
