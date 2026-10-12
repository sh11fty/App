import { describe, expect, it } from 'vitest';
import { DOMParser } from '@xmldom/xmldom';
import {
  buildAccountsIxbrl, buildAccountsMessage, buildCt600Message, computeIrmark, gunzipBase64,
  inputsSchema, parseGovTalkResponse, sampleInputs,
} from '../src';

const i = inputsSchema.parse(sampleInputs());
const creds = { senderId: 'SENDER', password: 'secret&<' };
const vendor = { vendorId: '9999', product: 'LtdFiler', version: '0.1.0', declarantName: 'A Director' };
const parse = (x: string) => {
  const errors: string[] = [];
  const doc = new DOMParser({ errorHandler: (_l, m) => errors.push(m) }).parseFromString(x, 'text/xml');
  return { doc, errors };
};

describe('iXBRL accounts', () => {
  const html = buildAccountsIxbrl(i);
  it('is well-formed and tags key facts', () => {
    expect(parse(html).errors).toEqual([]);
    expect(html).toContain('name="core:TurnoverRevenue"');
    expect(html).toContain('name="core:NetAssetsLiabilities"');
    expect(html).toContain('01234567');
  });
  it('escapes company names', () => {
    const x = buildAccountsIxbrl({ ...i, name: 'A & B <Ltd>' });
    expect(parse(x).errors).toEqual([]);
    expect(x).toContain('A &amp; B &lt;Ltd&gt;');
  });
});

describe('CT600 message', () => {
  const xml = buildCt600Message(i, creds, vendor);
  it('is well-formed GovTalk with escaped credentials', () => {
    expect(parse(xml).errors).toEqual([]);
    expect(xml).toContain('<Class>HMRC-CT-CT600</Class>');
    expect(xml).toContain('secret&amp;&lt;');
    expect(xml).toContain('<GatewayTest>1</GatewayTest>');
  });
  it('contains the computation and an IRmark that verifies', () => {
    expect(xml).toContain('<CorporationTax>');
    const mark = /<IRmark Type="generic">([^<]+)<\/IRmark>/.exec(xml)![1];
    expect(mark).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(computeIrmark(xml)).toBe(mark);
  });
  it('changes the IRmark when the body changes', () => {
    const other = buildCt600Message({ ...i, turnover: i.turnover + 1 }, creds, vendor);
    const m = (s: string) => /<IRmark Type="generic">([^<]+)</.exec(s)![1];
    expect(m(other)).not.toBe(m(xml));
  });
  it('attaches decodable iXBRL accounts', () => {
    const b64 = /<EncodedInlineXBRLDocument>([^<]+)</.exec(xml)![1];
    expect(gunzipBase64(b64)).toContain('ix:nonFraction');
  });
});

describe('Companies House message', () => {
  it('builds an Accounts submission', () => {
    const xml = buildAccountsMessage(i, creds, vendor);
    expect(parse(xml).errors).toEqual([]);
    expect(xml).toContain('<Class>Accounts</Class>');
    expect(gunzipBase64(/<Data>([^<]+)</.exec(xml)![1])).toContain('ix:header');
  });
});

describe('parseGovTalkResponse', () => {
  it('reads acknowledgement and errors', () => {
    const r = parseGovTalkResponse(`<GovTalkMessage><Header><MessageDetails><Qualifier>acknowledgement</Qualifier><CorrelationID>ABC123</CorrelationID><ResponseEndPoint PollInterval="10">x</ResponseEndPoint></MessageDetails></Header><GovTalkDetails><GovTalkErrors><Error><Number>1046</Number><Text>Bad credentials</Text></Error></GovTalkErrors></GovTalkDetails></GovTalkMessage>`);
    expect(r).toEqual({ qualifier: 'acknowledgement', correlationId: 'ABC123', pollIntervalSeconds: 10, errors: [{ number: '1046', text: 'Bad credentials' }] });
  });
});
