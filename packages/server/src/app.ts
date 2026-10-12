import express from 'express';
import { randomUUID } from 'node:crypto';
import {
  buildAccountsIxbrl, buildAccountsMessage, buildCt600Message, buildStatements, computeTax,
  inputsSchema, type Inputs,
} from '@ltd-filer/core';
import type { Config, Mode } from './config';
import { send, httpPost, type Post } from './gateway';
import { Store, type Submission } from './store';

const MODES: Mode[] = ['mock', 'test', 'live'];

export function createApp(config: Config, store: Store, post: Post = httpPost) {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  const parseInputs = (body: unknown): { ok: true; inputs: Inputs } | { ok: false; errors: string[] } => {
    const r = inputsSchema.safeParse((body as { inputs?: unknown })?.inputs);
    return r.success ? { ok: true, inputs: r.data } : { ok: false, errors: r.error.issues.map((x) => `${x.path.join('.')}: ${x.message}`) };
  };

  app.get('/api/health', (_req, res) => res.json({ ok: true, liveEnabled: config.allowLive }));

  app.post('/api/preview', (req, res) => {
    const p = parseInputs(req.body);
    if (!p.ok) return res.status(400).json({ errors: p.errors });
    res.json({
      statements: buildStatements(p.inputs),
      tax: computeTax(p.inputs),
      accountsIxbrl: buildAccountsIxbrl(p.inputs),
    });
  });

  app.get('/api/submissions', (_req, res) => res.json(store.all()));

  app.post('/api/submit/:kind', async (req, res) => {
    const kind = req.params.kind;
    if (kind !== 'accounts' && kind !== 'ct600') return res.status(404).json({ errors: ['Unknown filing type'] });
    const mode = (req.body?.mode ?? 'mock') as Mode;
    if (!MODES.includes(mode)) return res.status(400).json({ errors: ['Unknown mode'] });
    if (mode === 'live' && (!config.allowLive || req.body?.confirmLive !== true)) {
      return res.status(403).json({ errors: ['Live filing is disabled or not confirmed'] });
    }
    const p = parseInputs(req.body);
    if (!p.ok) return res.status(400).json({ errors: p.errors });
    const { inputs } = p;
    if (!buildStatements(inputs).balances) return res.status(422).json({ errors: ['Balance sheet does not balance'] });

    const record: Submission = {
      id: randomUUID(), kind, company: inputs.name, companyNumber: inputs.number.toUpperCase(),
      periodEnd: inputs.periodEnd, mode, status: 'pending', message: '', submittedAt: new Date().toISOString(),
    };

    try {
      if (mode === 'mock') {
        record.status = 'accepted';
        record.correlationId = 'MOCK' + record.id.slice(0, 8).toUpperCase();
        record.message = 'Accepted by mock gateway (nothing was sent to HMRC or Companies House)';
      } else {
        const creds = kind === 'ct600' ? config.hmrc : config.companiesHouse;
        if (!creds.senderId || !creds.password) {
          return res.status(400).json({ errors: ['Gateway credentials are not configured on the server'] });
        }
        const gatewayTest = mode === 'test';
        const xml = kind === 'ct600'
          ? buildCt600Message(inputs, creds, config.vendor, { test: gatewayTest })
          : buildAccountsMessage(inputs, creds, config.vendor, { test: gatewayTest });
        const url = kind === 'ct600' ? config.endpoints[mode].hmrc : config.endpoints[mode].companiesHouse;
        const r = await send(post, url, xml);
        record.correlationId = r.correlationId;
        if (r.errors.length) {
          record.status = 'rejected';
          record.message = r.errors.map((e) => `${e.number}: ${e.text}`).join('; ');
        } else {
          record.status = r.qualifier === 'response' ? 'accepted' : 'pending';
          record.message = r.qualifier === 'acknowledgement' ? 'Acknowledged, awaiting result' : 'Received';
        }
      }
    } catch (e) {
      record.status = 'error';
      record.message = e instanceof Error ? e.message : 'Unknown error';
    }
    store.add(record);
    res.status(record.status === 'error' ? 502 : 200).json(record);
  });

  return app;
}
