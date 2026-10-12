import type { Inputs } from './fields';
import { buildAccountsIxbrl } from './ixbrl';
import { buildGovTalk, type Credentials, type Vendor } from './govtalk';
import { gzipBase64 } from './encode';
import { esc } from './xml';

/** Companies House XML Gateway "Accounts" submission carrying an iXBRL document. */
export function buildAccountsMessage(i: Inputs, creds: Credentials, vendor: Vendor, opts: { test?: boolean; submissionNumber?: string } = {}): string {
  const doc = gzipBase64(buildAccountsIxbrl(i));
  const body = `<Accounts xmlns="http://xmlgw.companieshouse.gov.uk">
<CompanyNumber>${esc(i.number.toUpperCase())}</CompanyNumber>
<PeriodEnd>${i.periodEnd}</PeriodEnd>
<SubmissionNumber>${esc(opts.submissionNumber ?? '000001')}</SubmissionNumber>
<Document><Data>${doc}</Data><Filename>accounts.html</Filename><ContentType>application/xml+xhtml</ContentType><Category>ACCOUNTS</Category></Document>
</Accounts>`;
  return buildGovTalk({
    messageClass: 'Accounts',
    qualifier: 'request',
    fn: 'submit',
    keys: [{ type: 'CompanyNumber', value: i.number.toUpperCase() }],
    credentials: creds,
    vendor,
    gatewayTest: opts.test ?? true,
    body,
  });
}
