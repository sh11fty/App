import { FIELDS, sampleInputs, type FieldDef } from '@ltd-filer/core/shared';

export interface Results {
  rows: [string, string | number][];
}
export interface SubmissionRow {
  date: string; filing: string; mode: string; status: string; reference: string; message: string;
}

/** Everything the UI needs from the spreadsheet. Swapped for an in-memory version outside Excel. */
export interface WorkbookGateway {
  kind: 'excel' | 'memory';
  createTemplate(): Promise<void>;
  readInputs(): Promise<Record<string, string | number>>;
  writeResults(results: Results): Promise<void>;
  logSubmission(row: SubmissionRow): Promise<void>;
}

/** Excel hands back dates as serial numbers; convert to ISO. Blank numeric cells become 0. */
export function normaliseCell(field: FieldDef, v: unknown): string | number {
  if (field.type === 'date') {
    if (typeof v === 'number') return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10);
    return String(v ?? '').trim();
  }
  if (field.type === 'number') return v === '' || v == null ? 0 : (v as number | string);
  return String(v ?? '').trim();
}

export const INPUT_SHEET = 'Inputs';
export const FIRST_ROW = 2;

export class MemoryWorkbook implements WorkbookGateway {
  kind = 'memory' as const;
  values: Record<string, string | number> = sampleInputs();
  results: Results | null = null;
  log: SubmissionRow[] = [];
  async createTemplate() { this.values = sampleInputs(); }
  async readInputs() { return { ...this.values }; }
  async writeResults(r: Results) { this.results = r; }
  async logSubmission(row: SubmissionRow) { this.log.push(row); }
}

export class ExcelWorkbook implements WorkbookGateway {
  kind = 'excel' as const;

  async createTemplate() {
    await Excel.run(async (ctx) => {
      let sheet = ctx.workbook.worksheets.getItemOrNullObject(INPUT_SHEET);
      await ctx.sync();
      if (sheet.isNullObject) sheet = ctx.workbook.worksheets.add(INPUT_SHEET);
      sheet.getRange('A1:D1').values = [['Field', 'Value', 'Notes', 'Section']];
      sheet.getRange('A1:D1').format.font.bold = true;
      sheet.getRange('A1:D1').format.fill.color = '#106EBE';
      sheet.getRange('A1:D1').format.font.color = '#FFFFFF';
      const last = FIRST_ROW + FIELDS.length - 1;
      sheet.getRange(`A${FIRST_ROW}:D${last}`).values = FIELDS.map((f) => [f.label, f.sample, f.note ?? '', f.group]);
      // Text format for text/date cells so values are not reinterpreted (e.g. leading zeros).
      FIELDS.forEach((f, i) => {
        const cell = sheet.getRange(`B${FIRST_ROW + i}`);
        if (f.type !== 'number') { cell.numberFormat = [['@']]; cell.values = [[f.sample]]; }
        else cell.numberFormat = [['#,##0.00']];
      });
      sheet.getRange('B:B').format.fill.color = '#FFF8E1';
      sheet.getRange('A:D').format.autofitColumns();
      sheet.activate();
      await ctx.sync();
    });
  }

  async readInputs() {
    return Excel.run(async (ctx) => {
      const sheet = ctx.workbook.worksheets.getItemOrNullObject(INPUT_SHEET);
      await ctx.sync();
      if (sheet.isNullObject) throw new Error(`No "${INPUT_SHEET}" sheet found. Create the template first.`);
      const range = sheet.getRange(`B${FIRST_ROW}:B${FIRST_ROW + FIELDS.length - 1}`);
      range.load('values');
      await ctx.sync();
      return Object.fromEntries(FIELDS.map((f, i) => [f.key, normaliseCell(f, range.values[i][0])]));
    });
  }

  async writeResults(results: Results) {
    await this.writeSheet('Computation', [['Item', 'Amount'], ...results.rows]);
  }

  async logSubmission(row: SubmissionRow) {
    await Excel.run(async (ctx) => {
      let sheet = ctx.workbook.worksheets.getItemOrNullObject('Submissions');
      await ctx.sync();
      if (sheet.isNullObject) {
        sheet = ctx.workbook.worksheets.add('Submissions');
        sheet.getRange('A1:F1').values = [['Date', 'Filing', 'Mode', 'Status', 'Reference', 'Message']];
        sheet.getRange('A1:F1').format.font.bold = true;
      }
      const used = sheet.getUsedRange();
      used.load('rowCount');
      await ctx.sync();
      sheet.getRangeByIndexes(used.rowCount, 0, 1, 6).values = [[row.date, row.filing, row.mode, row.status, row.reference, row.message]];
      sheet.getRange('A:F').format.autofitColumns();
      await ctx.sync();
    });
  }

  private async writeSheet(name: string, rows: (string | number)[][]) {
    await Excel.run(async (ctx) => {
      let sheet = ctx.workbook.worksheets.getItemOrNullObject(name);
      await ctx.sync();
      if (sheet.isNullObject) sheet = ctx.workbook.worksheets.add(name);
      else sheet.getUsedRangeOrNullObject().clear();
      sheet.getRangeByIndexes(0, 0, rows.length, 2).values = rows;
      sheet.getRange('A1:B1').format.font.bold = true;
      sheet.getRange('B:B').numberFormat = [['#,##0.00']];
      sheet.getRange('A:B').format.autofitColumns();
      await ctx.sync();
    });
  }
}

export function createWorkbook(): Promise<WorkbookGateway> {
  return new Promise((resolve) => {
    const O = (globalThis as { Office?: typeof Office }).Office;
    if (!O?.onReady) return resolve(new MemoryWorkbook());
    const t = setTimeout(() => resolve(new MemoryWorkbook()), 1500);
    O.onReady((info) => {
      clearTimeout(t);
      resolve(info.host === O.HostType.Excel ? new ExcelWorkbook() : new MemoryWorkbook());
    });
  });
}
