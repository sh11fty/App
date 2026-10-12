import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { sampleInputs } from '@ltd-filer/core';
import { createApp } from '../src/app';
import { loadConfig } from '../src/config';
import { Store } from '../src/store';

const inputs = sampleInputs();
// Balance the sample sheet via preview, then reuse.
async function balancedInputs() {
  const app = createApp(loadConfig({}), new Store(null));
  const r = await request(app).post('/api/preview').send({ inputs });
  const reserves = Number(inputs.openingReserves) + r.body.statements.difference;
  return { ...inputs, openingReserves: reserves };
}

const ack = (q = 'acknowledgement', err = '') =>
  `<GovTalkMessage><Header><MessageDetails><Qualifier>${q}</Qualifier><CorrelationID>CID1</CorrelationID></MessageDetails></Header><GovTalkDetails>${err}</GovTalkDetails></GovTalkMessage>`;

describe('API', () => {
  it('rejects invalid inputs', async () => {
    const app = createApp(loadConfig({}), new Store(null));
    const r = await request(app).post('/api/preview').send({ inputs: { ...inputs, utr: '1' } });
    expect(r.status).toBe(400);
    expect(r.body.errors[0]).toMatch(/utr/);
  });

  it('previews statements, tax and iXBRL', async () => {
    const app = createApp(loadConfig({}), new Store(null));
    const r = await request(app).post('/api/preview').send({ inputs });
    expect(r.status).toBe(200);
    expect(r.body.tax.corporationTax).toBeGreaterThan(0);
    expect(r.body.accountsIxbrl).toContain('ix:header');
  });

  it('records a mock submission and lists history', async () => {
    const store = new Store(null);
    const app = createApp(loadConfig({}), store);
    const r = await request(app).post('/api/submit/ct600').send({ inputs: await balancedInputs(), mode: 'mock' });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('accepted');
    const list = await request(app).get('/api/submissions');
    expect(list.body).toHaveLength(1);
  });

  it('refuses unbalanced accounts', async () => {
    const app = createApp(loadConfig({}), new Store(null));
    const r = await request(app).post('/api/submit/accounts').send({ inputs: { ...inputs, openingReserves: 1 }, mode: 'mock' });
    expect(r.status).toBe(422);
  });

  it('blocks live filing unless enabled and confirmed', async () => {
    const body = { inputs: await balancedInputs(), mode: 'live' };
    const off = createApp(loadConfig({}), new Store(null));
    expect((await request(off).post('/api/submit/ct600').send({ ...body, confirmLive: true })).status).toBe(403);
    const on = createApp(loadConfig({ ENABLE_LIVE: 'true' }), new Store(null));
    expect((await request(on).post('/api/submit/ct600').send(body)).status).toBe(403);
  });

  it('requires credentials for test mode', async () => {
    const app = createApp(loadConfig({}), new Store(null));
    const r = await request(app).post('/api/submit/ct600').send({ inputs: await balancedInputs(), mode: 'test' });
    expect(r.status).toBe(400);
  });

  it('sends a signed CT600 to the test gateway and stores the acknowledgement', async () => {
    const post = vi.fn().mockResolvedValue(ack());
    const app = createApp(loadConfig({ HMRC_SENDER_ID: 'S', HMRC_PASSWORD: 'P' }), new Store(null), post);
    const r = await request(app).post('/api/submit/ct600').send({ inputs: await balancedInputs(), mode: 'test' });
    expect(r.body.status).toBe('pending');
    expect(r.body.correlationId).toBe('CID1');
    const [url, xml] = post.mock.calls[0];
    expect(url).toContain('test-transaction-engine');
    expect(xml).toContain('<IRmark Type="generic">');
  });

  it('surfaces gateway rejections and network errors', async () => {
    const env = { CH_PRESENTER_ID: 'S', CH_AUTH_CODE: 'P' };
    const rej = createApp(loadConfig(env), new Store(null), vi.fn().mockResolvedValue(ack('error', '<GovTalkErrors><Error><Number>1</Number><Text>Nope</Text></Error></GovTalkErrors>')));
    const r1 = await request(rej).post('/api/submit/accounts').send({ inputs: await balancedInputs(), mode: 'test' });
    expect(r1.body.status).toBe('rejected');
    expect(r1.body.message).toContain('Nope');
    const down = createApp(loadConfig(env), new Store(null), vi.fn().mockRejectedValue(new Error('boom')));
    const r2 = await request(down).post('/api/submit/accounts').send({ inputs: await balancedInputs(), mode: 'test' });
    expect(r2.status).toBe(502);
    expect(r2.body.status).toBe('error');
  });
});
