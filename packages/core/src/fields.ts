import { z } from 'zod';

/** Spreadsheet input fields: the template sheet is generated from, and read back using, this list. */
export interface FieldDef {
  key: string;
  label: string;
  group: 'Company' | 'Profit and loss' | 'Balance sheet' | 'Tax adjustments';
  type: 'text' | 'date' | 'number';
  sample: string | number;
  note?: string;
}

export const FIELDS: FieldDef[] = [
  { key: 'name', label: 'Company name', group: 'Company', type: 'text', sample: 'Example Trading Ltd' },
  { key: 'number', label: 'Company number', group: 'Company', type: 'text', sample: '01234567', note: '8 characters' },
  { key: 'utr', label: 'Corporation Tax UTR', group: 'Company', type: 'text', sample: '1234567890', note: '10 digits' },
  { key: 'periodStart', label: 'Period start', group: 'Company', type: 'date', sample: '2024-04-01', note: 'YYYY-MM-DD' },
  { key: 'periodEnd', label: 'Period end', group: 'Company', type: 'date', sample: '2025-03-31', note: 'YYYY-MM-DD' },
  { key: 'associatedCompanies', label: 'Associated companies', group: 'Company', type: 'number', sample: 0 },
  { key: 'turnover', label: 'Turnover', group: 'Profit and loss', type: 'number', sample: 180000 },
  { key: 'costOfSales', label: 'Cost of sales', group: 'Profit and loss', type: 'number', sample: 40000, note: 'Enter as positive' },
  { key: 'adminExpenses', label: 'Administrative expenses', group: 'Profit and loss', type: 'number', sample: 60000, note: 'Enter as positive' },
  { key: 'depreciation', label: 'of which depreciation', group: 'Profit and loss', type: 'number', sample: 2000, note: 'Included in the line above' },
  { key: 'interestPayable', label: 'Interest payable', group: 'Profit and loss', type: 'number', sample: 500 },
  { key: 'fixedAssets', label: 'Fixed assets', group: 'Balance sheet', type: 'number', sample: 10000 },
  { key: 'currentAssets', label: 'Current assets', group: 'Balance sheet', type: 'number', sample: 50000 },
  { key: 'creditorsDueWithinYear', label: 'Creditors due within one year', group: 'Balance sheet', type: 'number', sample: 15000 },
  { key: 'creditorsDueAfterYear', label: 'Creditors due after one year', group: 'Balance sheet', type: 'number', sample: 0 },
  { key: 'calledUpShareCapital', label: 'Called up share capital', group: 'Balance sheet', type: 'number', sample: 100 },
  { key: 'openingReserves', label: 'Opening reserves', group: 'Balance sheet', type: 'number', sample: 2452.5, note: 'Retained earnings at period start (after dividends of earlier periods)' },
  { key: 'dividends', label: 'Dividends paid', group: 'Balance sheet', type: 'number', sample: 20000 },
  { key: 'capitalAllowances', label: 'Capital allowances', group: 'Tax adjustments', type: 'number', sample: 3000 },
  { key: 'otherAddBacks', label: 'Other disallowable expenses', group: 'Tax adjustments', type: 'number', sample: 0 },
  { key: 'lossesBroughtForward', label: 'Trading losses brought forward', group: 'Tax adjustments', type: 'number', sample: 0 },
  { key: 'charitableDonations', label: 'Qualifying charitable donations', group: 'Tax adjustments', type: 'number', sample: 0 },
];

const money = z.coerce.number().finite();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

export const inputsSchema = z
  .object({
    name: z.string().trim().min(1, 'Company name is required'),
    number: z.string().trim().regex(/^[A-Z0-9]{8}$/i, 'Company number must be 8 characters'),
    utr: z.string().trim().regex(/^\d{10}$/, 'UTR must be 10 digits'),
    periodStart: date,
    periodEnd: date,
    associatedCompanies: z.coerce.number().int().min(0),
    turnover: money.min(0),
    costOfSales: money.min(0),
    adminExpenses: money.min(0),
    depreciation: money.min(0),
    interestPayable: money.min(0),
    fixedAssets: money.min(0),
    currentAssets: money.min(0),
    creditorsDueWithinYear: money.min(0),
    creditorsDueAfterYear: money.min(0),
    calledUpShareCapital: money.min(0),
    openingReserves: money,
    dividends: money.min(0),
    capitalAllowances: money.min(0),
    otherAddBacks: money.min(0),
    lossesBroughtForward: money.min(0),
    charitableDonations: money.min(0),
  })
  .superRefine((v, ctx) => {
    const s = Date.parse(v.periodStart);
    const e = Date.parse(v.periodEnd);
    if (Number.isNaN(s) || Number.isNaN(e)) return;
    if (e <= s) ctx.addIssue({ code: 'custom', path: ['periodEnd'], message: 'Period end must be after period start' });
    else if ((e - s) / 86400000 > 366) ctx.addIssue({ code: 'custom', path: ['periodEnd'], message: 'A CT600 period cannot exceed 12 months; split the period' });
  });

export type Inputs = z.infer<typeof inputsSchema>;

export function sampleInputs(): Record<string, string | number> {
  return Object.fromEntries(FIELDS.map((f) => [f.key, f.sample]));
}
