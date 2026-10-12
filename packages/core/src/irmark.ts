import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { createHash } from 'node:crypto';
import { C14nCanonicalization } from 'xml-crypto';

/**
 * HMRC IRmark: SHA-1 of the canonicalised (C14N 1.0) Body with the IRmark element removed, base64 encoded.
 * The Body is canonicalised in the context of the envelope so inherited namespaces are included.
 */
export function computeIrmark(envelopeXml: string): string {
  const doc = new DOMParser().parseFromString(envelopeXml, 'text/xml');
  const body = doc.getElementsByTagName('Body')[0];
  if (!body) throw new Error('Envelope has no Body');
  const marks = body.getElementsByTagName('IRmark');
  for (let n = marks.length - 1; n >= 0; n--) marks[n].parentNode!.removeChild(marks[n]);
  const canon = new C14nCanonicalization().process(body as unknown as Node, {});
  return createHash('sha1').update(canon, 'utf8').digest('base64');
}

export function insertIrmark(envelopeXml: string): string {
  const mark = computeIrmark(envelopeXml);
  return envelopeXml.replace(/<IRmark[^>]*\/>|<IRmark[^>]*>[^<]*<\/IRmark>/, `<IRmark Type="generic">${mark}</IRmark>`);
}
export { XMLSerializer };
