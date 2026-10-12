import { useEffect, useState } from 'react';
import {
  Badge, Body1, Button, Card, CardHeader, Dropdown, Option, MessageBar, MessageBarBody, Spinner,
  Subtitle1, Switch, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, Text, Title3, makeStyles, tokens,
} from '@fluentui/react-components';
import { inputsSchema, type Inputs } from '@ltd-filer/core/shared';
import type { WorkbookGateway } from './workbook';
import * as api from './api';
import { money, resultRows } from './format';

const useStyles = makeStyles({
  root: { padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '480px', margin: '0 auto' },
  steps: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  row: { display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${tokens.colorNeutralStroke2}` },
  actions: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
});

const STEPS = ['Load', 'Review', 'Submit', 'History'] as const;
type Step = (typeof STEPS)[number];

export function App({ workbook }: { workbook: WorkbookGateway }) {
  const s = useStyles();
  const [step, setStep] = useState<Step>('Load');
  const [inputs, setInputs] = useState<Inputs | null>(null);
  const [data, setData] = useState<api.Preview | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'mock' | 'test' | 'live'>('mock');
  const [confirmLive, setConfirmLive] = useState(false);
  const [liveEnabled, setLiveEnabled] = useState(false);
  const [history, setHistory] = useState<api.SubmissionRecord[]>([]);
  const [last, setLast] = useState<api.SubmissionRecord | null>(null);

  useEffect(() => { api.health().then((h) => setLiveEnabled(h.liveEnabled)).catch(() => {}); }, []);

  const guard = async (fn: () => Promise<void>) => {
    setBusy(true); setErrors([]);
    try { await fn(); } catch (e) { setErrors(e instanceof api.ApiError ? e.errors : [e instanceof Error ? e.message : String(e)]); }
    finally { setBusy(false); }
  };

  const load = () => guard(async () => {
    const raw = await workbook.readInputs();
    const parsed = inputsSchema.safeParse(raw);
    if (!parsed.success) {
      setErrors(parsed.error.issues.map((x) => `${x.path.join('.')}: ${x.message}`));
      return;
    }
    const p = await api.preview(parsed.data);
    setInputs(parsed.data); setData(p); setStep('Review');
  });

  const createTemplate = () => guard(async () => { await workbook.createTemplate(); });

  const saveToSheet = () => guard(async () => {
    if (inputs && data) await workbook.writeResults({ rows: resultRows(inputs, data.statements, data.tax) });
  });

  const doSubmit = (kind: 'accounts' | 'ct600') => guard(async () => {
    if (!inputs) return;
    const r = await api.submit(kind, inputs, mode, confirmLive);
    setLast(r);
    await workbook.logSubmission({
      date: r.submittedAt, filing: kind === 'ct600' ? 'CT600' : 'Accounts', mode: r.mode, status: r.status,
      reference: r.correlationId ?? '', message: r.message,
    });
  });

  const openHistory = () => guard(async () => { setHistory(await api.health().then(() => fetch('/api/submissions').then((r) => r.json()))); setStep('History'); });

  const Line = ({ k, v, strong }: { k: string; v: string; strong?: boolean }) => (
    <div className={s.row}><Text weight={strong ? 'bold' : 'regular'}>{k}</Text><Text weight={strong ? 'bold' : 'regular'}>{v}</Text></div>
  );

  return (
    <main className={s.root}>
      <Title3>Ltd Filer</Title3>
      <div className={s.steps}>
        {STEPS.map((x) => (
          <Badge key={x} appearance={x === step ? 'filled' : 'outline'} color={x === step ? 'brand' : 'informative'}>{x}</Badge>
        ))}
      </div>

      {errors.length > 0 && (
        <MessageBar intent="error"><MessageBarBody>{errors.map((e) => <div key={e}>{e}</div>)}</MessageBarBody></MessageBar>
      )}
      {busy && <Spinner size="tiny" label="Working…" />}
      {workbook.kind === 'memory' && <MessageBar intent="info"><MessageBarBody>Not running inside Excel: using sample data.</MessageBarBody></MessageBar>}

      {step === 'Load' && (
        <Card>
          <CardHeader header={<Subtitle1>Your figures</Subtitle1>} description={<Body1>Fill in the Inputs sheet, then load it.</Body1>} />
          <div className={s.actions}>
            <Button onClick={createTemplate} disabled={busy}>Create template sheet</Button>
            <Button appearance="primary" onClick={load} disabled={busy}>Load from sheet</Button>
            <Button onClick={openHistory} disabled={busy}>History</Button>
          </div>
        </Card>
      )}

      {step === 'Review' && inputs && data && (
        <>
          <Card>
            <CardHeader header={<Subtitle1>{inputs.name}</Subtitle1>} description={<Body1>{inputs.periodStart} to {inputs.periodEnd}</Body1>} />
            <Line k="Turnover" v={money(inputs.turnover)} />
            <Line k="Profit before tax" v={money(data.statements.profitBeforeTax)} />
            <Line k="Taxable profit" v={money(data.tax.taxableProfit)} />
            <Line k="Corporation tax" v={money(data.tax.corporationTax)} strong />
            <Line k="Profit after tax" v={money(data.statements.profitAfterTax)} />
            <Line k="Net assets" v={money(data.statements.netAssets)} />
          </Card>
          {data.statements.balances
            ? <MessageBar intent="success"><MessageBarBody>Balance sheet balances.</MessageBarBody></MessageBar>
            : <MessageBar intent="error"><MessageBarBody>Balance sheet is out by {money(data.statements.difference)}. Check opening reserves, dividends and creditors.</MessageBarBody></MessageBar>}
          <div className={s.actions}>
            <Button onClick={() => setStep('Load')}>Back</Button>
            <Button onClick={saveToSheet} disabled={busy}>Write computation to sheet</Button>
            <Button appearance="primary" onClick={() => setStep('Submit')} disabled={!data.statements.balances}>Continue</Button>
          </div>
        </>
      )}

      {step === 'Submit' && inputs && (
        <>
          <Card>
            <CardHeader header={<Subtitle1>Where to send</Subtitle1>} />
            <Dropdown aria-label="Mode" value={mode} selectedOptions={[mode]} onOptionSelect={(_, d) => { setMode(d.optionValue as typeof mode); setConfirmLive(false); }}>
              <Option value="mock" text="mock">mock (nothing is sent)</Option>
              <Option value="test" text="test">test (HMRC / Companies House test service)</Option>
              <Option value="live" text="live" disabled={!liveEnabled}>live{liveEnabled ? '' : ' (disabled on server)'}</Option>
            </Dropdown>
            {mode === 'live' && <Switch label="I confirm this is a real, final filing" checked={confirmLive} onChange={(_, d) => setConfirmLive(d.checked)} />}
            <div className={s.actions}>
              <Button appearance="primary" disabled={busy || (mode === 'live' && !confirmLive)} onClick={() => doSubmit('accounts')}>Submit accounts</Button>
              <Button appearance="primary" disabled={busy || (mode === 'live' && !confirmLive)} onClick={() => doSubmit('ct600')}>Submit CT600</Button>
            </div>
          </Card>
          {last && (
            <MessageBar intent={last.status === 'accepted' ? 'success' : last.status === 'pending' ? 'info' : 'error'}>
              <MessageBarBody>{last.kind === 'ct600' ? 'CT600' : 'Accounts'}: {last.status}. {last.message} {last.correlationId && `Ref ${last.correlationId}`}</MessageBarBody>
            </MessageBar>
          )}
          <div className={s.actions}>
            <Button onClick={() => setStep('Review')}>Back</Button>
            <Button onClick={openHistory}>History</Button>
          </div>
        </>
      )}

      {step === 'History' && (
        <>
          <Table size="small" aria-label="Submission history">
            <TableHeader><TableRow><TableHeaderCell>Filing</TableHeaderCell><TableHeaderCell>Status</TableHeaderCell><TableHeaderCell>Mode</TableHeaderCell></TableRow></TableHeader>
            <TableBody>
              {history.length === 0 && <TableRow><TableCell colSpan={3}>No submissions yet</TableCell></TableRow>}
              {history.map((h) => (
                <TableRow key={h.id}><TableCell>{h.kind === 'ct600' ? 'CT600' : 'Accounts'}</TableCell><TableCell>{h.status}</TableCell><TableCell>{h.mode}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
          <Button onClick={() => setStep('Load')}>Back</Button>
        </>
      )}
    </main>
  );
}
