import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

export interface Submission {
  id: string;
  kind: 'accounts' | 'ct600';
  company: string;
  companyNumber: string;
  periodEnd: string;
  mode: string;
  status: 'accepted' | 'rejected' | 'pending' | 'error';
  correlationId?: string;
  message: string;
  submittedAt: string;
}

export class Store {
  constructor(private file: string | null) {}
  private items: Submission[] | null = null;

  private load(): Submission[] {
    if (this.items) return this.items;
    this.items = this.file && existsSync(this.file) ? JSON.parse(readFileSync(this.file, 'utf8')) : [];
    return this.items!;
  }
  all(): Submission[] {
    return [...this.load()].reverse();
  }
  get(id: string) {
    return this.load().find((s) => s.id === id);
  }
  add(s: Submission) {
    this.load().push(s);
    this.save();
  }
  update(id: string, patch: Partial<Submission>) {
    const s = this.get(id);
    if (s) Object.assign(s, patch);
    this.save();
  }
  private save() {
    if (!this.file) return;
    mkdirSync(dirname(this.file), { recursive: true });
    writeFileSync(this.file, JSON.stringify(this.items, null, 2));
  }
}
