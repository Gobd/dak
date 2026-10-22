import { spawn, type ChildProcess } from 'node:child_process';
import { createInterface } from 'node:readline';
import type { StatusRecord } from './terminals.ts';

interface Frame {
  type: string;
  boot_id?: string;
  name?: string;
  workspace_id?: string;
  surface_id?: string;
  resume?: { gap?: boolean };
  replay_count?: number;
  payload?: {
    records: StatusRecord[];
    records_total: number;
    snapshot_id: string;
    snapshot_index: number;
    snapshot_count: number;
  };
}
// Both terminal adapters expose these records; cmux sends bounded snapshot chunks.
export class ProgramStatusStore {
  private boot = '';
  private records = new Map<string, StatusRecord[]>();
  private chunks = new Map<
    string,
    { id: string; count: number; total: number; parts: Map<number, StatusRecord[]> }
  >();
  clear() {
    this.records.clear();
    this.chunks.clear();
  }
  accept(frame: Frame) {
    if (frame.boot_id && frame.boot_id !== this.boot) {
      this.clear();
      this.boot = frame.boot_id;
    }
    if (frame.type === 'ack' && frame.resume?.gap) this.clear();
    if (
      frame.type !== 'event' ||
      frame.name !== 'program_status.changed' ||
      !frame.workspace_id ||
      !frame.surface_id ||
      !frame.payload
    )
      return;
    const key = frame.workspace_id + '/' + frame.surface_id;
    const payload = frame.payload;
    if (
      !Array.isArray(payload.records) ||
      !Number.isInteger(payload.snapshot_count) ||
      payload.snapshot_count < 1 ||
      payload.snapshot_count > 8 ||
      payload.records_total > 256
    )
      return;
    if (payload.snapshot_index < 0 || payload.snapshot_index >= payload.snapshot_count) return;
    let snapshot = this.chunks.get(key);
    if (!snapshot || snapshot.id !== payload.snapshot_id) {
      snapshot = {
        id: payload.snapshot_id,
        count: payload.snapshot_count,
        total: payload.records_total,
        parts: new Map(),
      };
      this.chunks.set(key, snapshot);
    }
    snapshot.parts.set(payload.snapshot_index, payload.records);
    if (snapshot.parts.size !== snapshot.count) return;
    const records = Array.from({ length: snapshot.count }, (_, index) =>
      snapshot!.parts.get(index)!,
    ).flat();
    if (records.length !== snapshot.total) return;
    this.records.set(key, records);
    this.chunks.delete(key);
    if (this.records.size > 1000) this.records.delete(this.records.keys().next().value!);
    if (this.chunks.size > 1000) this.chunks.delete(this.chunks.keys().next().value!);
  }
  get(workspace: string, surface: string) {
    return this.records.get(workspace + '/' + surface);
  }
}
export function cmuxProgramStatus(binary: string) {
  const store = new ProgramStatusStore();
  let child: ChildProcess | undefined;
  let ready: Promise<void> | undefined;
  let disposed = false;
  return {
    async read(workspace: string, surface: string): Promise<StatusRecord[] | undefined> {
      if (disposed) return undefined;
      if (!child) {
        ready = new Promise((resolve) => {
          let replay = 0;
          const timer = setTimeout(resolve, 3000);
          const finish = () => {
            clearTimeout(timer);
            resolve();
          };
          child = spawn(
            binary,
            [
              'events',
              '--after',
              '0',
              '--name',
              'program_status.changed',
              '--reconnect',
              '--no-heartbeat',
            ],
            { env: process.env, stdio: ['ignore', 'pipe', 'pipe'] },
          );
          const lines = createInterface({ input: child.stdout! });
          lines.on('line', (line) => {
            try {
              const frame = JSON.parse(line) as Frame;
              store.accept(frame);
              if (frame.type === 'ack') {
                replay = frame.replay_count || 0;
                if (!replay) finish();
              } else if (frame.type === 'event' && --replay <= 0) finish();
            } catch {
              /* Ignore non-protocol lines. */
            }
          });
          child.stderr?.on('data', () => {});
          child.on('error', () => {
            store.clear();
            finish();
          });
          child.on('exit', () => {
            store.clear();
            child = undefined;
            lines.close();
            finish();
          });
        });
      }
      await ready;
      return store.get(workspace, surface);
    },
    close() {
      disposed = true;
      child?.kill();
      store.clear();
    },
  };
}
