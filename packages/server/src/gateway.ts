import { parseGovTalkResponse, type GovTalkResponse } from '@ltd-filer/core';

export type Post = (url: string, xml: string) => Promise<string>;

export const httpPost: Post = async (url, xml) => {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/xml; charset=utf-8' }, body: xml });
  if (!res.ok) throw new Error(`Gateway responded ${res.status}`);
  return res.text();
};

export async function send(post: Post, url: string, xml: string): Promise<GovTalkResponse> {
  return parseGovTalkResponse(await post(url, xml));
}
