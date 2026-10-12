import type { Inputs, Statements, TaxComputation } from '@ltd-filer/core/shared';

export interface Preview { statements: Statements; tax: TaxComputation; accountsIxbrl: string }
export interface SubmissionRecord {
  id: string; kind: 'accounts' | 'ct600'; status: string; mode: string; correlationId?: string; message: string; submittedAt: string;
}
export class ApiError extends Error {
  constructor(public errors: string[]) { super(errors.join('; ')); }
}

async function call<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
  const json = await res.json().catch(() => ({}));
  if (!res.ok && !json.status) throw new ApiError(json.errors ?? [`Request failed (${res.status})`]);
  return json as T;
}

export const preview = (inputs: unknown) => call<Preview>('/api/preview', { inputs });
export const submit = (kind: 'accounts' | 'ct600', inputs: Inputs | unknown, mode: string, confirmLive = false) =>
  call<SubmissionRecord>(`/api/submit/${kind}`, { inputs, mode, confirmLive });
export const health = () => call<{ ok: boolean; liveEnabled: boolean }>('/api/health');
