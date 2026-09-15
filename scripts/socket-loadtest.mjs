#!/usr/bin/env node
/**
 * Kiểm thử tải realtime (docs 04-kien-truc/01 §5): N client mở cùng bảng, M lần kéo thẻ qua REST,
 * đo độ trễ sự kiện task:moved tới client và kiểm thứ tự cuối cùng khớp DB.
 *
 *   node scripts/socket-loadtest.mjs --api http://localhost:3000 --email lan@smarttask.local --password Demo@1234 \
 *        --project <projectId> --clients 20 --moves 200
 */
import { io } from 'socket.io-client';

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > -1 ? process.argv[i + 1] : d; };
const API = arg('api', 'http://localhost:3000');
const EMAIL = arg('email', 'lan@smarttask.local');
const PASSWORD = arg('password', 'Demo@1234');
const PROJECT = arg('project');
const CLIENTS = Number(arg('clients', 20));
const MOVES = Number(arg('moves', 200));
if (!PROJECT) { console.error('Thiếu --project'); process.exit(1); }

const json = async (path, init = {}, token) => {
  const res = await fetch(`${API}/api/v1${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers ?? {}) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} → ${res.status} ${JSON.stringify(body)}`);
  return body;
};

const login = await json('/auth/login', { method: 'POST', body: JSON.stringify({ email: EMAIL, password: PASSWORD }) });
const token = login.accessToken;
const columns = await json(`/projects/${PROJECT}/columns`, {}, token);
const list = await json(`/projects/${PROJECT}/tasks`, {}, token);
if (list.items.length < 2) throw new Error('Dự án cần ≥ 2 task');
const tasks = list.items.map((t) => ({ id: t.id, version: t.version }));

const latencies = [];
let received = 0;
const clients = await Promise.all(Array.from({ length: CLIENTS }, () => new Promise((resolve, reject) => {
  const s = io(API, { auth: { token }, transports: ['websocket'] });
  s.on('task:moved', (p) => { received += 1; const sent = sentAt.get(`${p.task.id}:${p.task.version}`); if (sent) latencies.push(Date.now() - sent); });
  s.once('connected', () => s.emit('project:join', { projectId: PROJECT }, () => resolve(s)));
  s.once('connect_error', reject);
})));
console.log(`${CLIENTS} client đã vào phòng; bắt đầu ${MOVES} lần kéo…`);

const sentAt = new Map();
const t0 = Date.now();
let conflicts = 0;
for (let i = 0; i < MOVES; i += 1) {
  const t = tasks[i % tasks.length];
  const col = columns[i % columns.length];
  const position = 1024 * (i + 1);
  try {
    const res = await json(`/tasks/${t.id}/move`, { method: 'PATCH', body: JSON.stringify({ version: t.version, columnId: col.id, position }) }, token);
    sentAt.set(`${t.id}:${res.version}`, Date.now());
    t.version = res.version;
  } catch (e) {
    if (String(e).includes('409')) { conflicts += 1; const cur = await json(`/tasks/${t.id}`, {}, token); t.version = cur.version; } else throw e;
  }
}
await new Promise((r) => setTimeout(r, 1500));
const total = Date.now() - t0;
latencies.sort((a, b) => a - b);
const p = (q) => latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * q))] ?? 0;
console.log(`Xong ${MOVES} lần kéo trong ${total} ms (${Math.round((MOVES * 1000) / total)} req/s), 409: ${conflicts}`);
console.log(`Sự kiện nhận: ${received} / ${MOVES * CLIENTS} mong đợi; độ trễ p50 ${p(0.5)} ms · p95 ${p(0.95)} ms · max ${latencies[latencies.length - 1] ?? 0} ms`);

// Thứ tự cuối: version trên client (từ sự kiện) phải khớp DB
const db = await json(`/projects/${PROJECT}/tasks`, {}, token);
const mismatch = tasks.filter((t) => db.items.find((x) => x.id === t.id)?.version !== t.version);
console.log(mismatch.length ? `LỆCH version ở ${mismatch.length} task` : 'Version client khớp DB cho mọi task');
for (const s of clients) s.disconnect();
process.exit(mismatch.length ? 1 : 0);
