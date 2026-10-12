import { esc } from './xml';

export interface Credentials { senderId: string; password: string }
export interface Vendor { vendorId: string; product: string; version: string; declarantName: string }

export interface GovTalkOptions {
  messageClass: string;
  qualifier: 'request' | 'poll' | 'acknowledgement' | 'response';
  fn: 'submit' | 'list' | 'delete';
  keys: { type: string; value: string }[];
  credentials: Credentials;
  vendor: Vendor;
  gatewayTest: boolean;
  correlationId?: string;
  body: string;
}

export function buildGovTalk(o: GovTalkOptions): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<GovTalkMessage xmlns="http://www.govtalk.gov.uk/CM/envelope">
<EnvelopeVersion>2.0</EnvelopeVersion>
<Header>
<MessageDetails>
<Class>${esc(o.messageClass)}</Class>
<Qualifier>${o.qualifier}</Qualifier>
<Function>${o.fn}</Function>
<CorrelationID>${esc(o.correlationId ?? '')}</CorrelationID>
<Transformation>XML</Transformation>
<GatewayTest>${o.gatewayTest ? '1' : '0'}</GatewayTest>
</MessageDetails>
<SenderDetails>
<IDAuthentication>
<SenderID>${esc(o.credentials.senderId)}</SenderID>
<Authentication><Method>clear</Method><Role>principal</Role><Value>${esc(o.credentials.password)}</Value></Authentication>
</IDAuthentication>
</SenderDetails>
</Header>
<GovTalkDetails>
<Keys>${o.keys.map((k) => `<Key Type="${esc(k.type)}">${esc(k.value)}</Key>`).join('')}</Keys>
<ChannelRouting><Channel><URI>${esc(o.vendor.vendorId)}</URI><Product>${esc(o.vendor.product)}</Product><Version>${esc(o.vendor.version)}</Version></Channel></ChannelRouting>
</GovTalkDetails>
<Body>${o.body}</Body>
</GovTalkMessage>`;
}

export interface GovTalkResponse {
  qualifier: string;
  correlationId: string;
  pollIntervalSeconds?: number;
  errors: { number: string; text: string }[];
}

const tag = (xml: string, name: string) => new RegExp(`<(?:\\w+:)?${name}[^>]*>([\\s\\S]*?)</(?:\\w+:)?${name}>`).exec(xml)?.[1]?.trim();

export function parseGovTalkResponse(xml: string): GovTalkResponse {
  const errors = [...xml.matchAll(/<Error[^>]*>([\s\S]*?)<\/Error>/g)].map((m) => ({
    number: tag(m[1], 'Number') ?? '',
    text: tag(m[1], 'Text') ?? '',
  }));
  const poll = /<ResponseEndPoint[^>]*PollInterval="(\d+)"/.exec(xml)?.[1];
  return {
    qualifier: tag(xml, 'Qualifier') ?? '',
    correlationId: tag(xml, 'CorrelationID') ?? '',
    pollIntervalSeconds: poll ? Number(poll) : undefined,
    errors,
  };
}
