#!/usr/bin/env node
/**
 * Thử AI thật một vòng (docs 05-hien-thuc/phase-7.md, phase-8.md): dựng workspace/dự án/sprint/kỹ năng tạm, gọi
 * POST /projects/:id/ai/decompose với Gemini (hoặc provider đang cấu hình), in đề xuất + validation + token/chi phí,
 * rồi POST /sprints/:id/forecast/explain; với --chat chạy thêm 3 lượt chat theo phiên (phân rã → "cái thứ hai đổi
 * 6 giờ, giao Lan" → "bỏ cái cuối") và in bản nháp sau mỗi lượt. Không áp dụng đề xuất trừ khi có --apply.
 *
 *   node scripts/ai-smoke.mjs --api http://localhost:3000 [--apply] [--chat] [--detail normal]
 *        [--requirement "Xây dựng quên mật khẩu qua email…"]
 */
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > -1 ? process.argv[i + 1] : d; };
const has = (k) => process.argv.includes(`--${k}`);
const API = arg('api', 'http://localhost:3000');
const DETAIL = arg('detail', 'normal');
const REQUIREMENT = arg(
  'requirement',
  'Xây dựng chức năng quên mật khẩu qua email: người dùng nhập email, hệ thống gửi link đặt lại có hạn 15 phút, ' +
    'trang đặt mật khẩu mới có kiểm tra độ mạnh, khoá tài khoản tạm 15 phút sau 5 lần nhập sai, ghi nhật ký bảo mật.',
);

const json = async (path, init = {}, token) => {
  const res = await fetch(`${API}/api/v1${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} → ${res.status} ${JSON.stringify(body).slice(0, 600)}`);
  return body;
};
const post = (path, body, token) => json(path, { method: 'POST', body: JSON.stringify(body) }, token);
const iso = (d) => d.toISOString().slice(0, 10);
const monday = (() => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d; })();
const plus = (d, n) => new Date(d.getTime() + n * 86_400_000);

// ── Dữ liệu tạm ──
const stamp = Date.now().toString(36);
const mk = async (name, email) => {
  const r = await post('/auth/register', { email, password: 'MatKhau@123', fullName: name });
  return { id: r.user.id, token: r.accessToken, name };
};
const pm = await mk('Phạm Quản Lý', `pm-${stamp}@smoke.local`);
const lan = await mk('Nguyễn Thị Lan', `lan-${stamp}@smoke.local`);
const minh = await mk('Trần Quang Minh', `minh-${stamp}@smoke.local`);
const ws = await post('/workspaces', { name: `Smoke ${stamp}` }, pm.token);
for (const u of [lan, minh]) {
  const inv = await post(`/workspaces/${ws.id}/invitations`, { email: `${u.name === 'Nguyễn Thị Lan' ? 'lan' : 'minh'}-${stamp}@smoke.local` }, pm.token);
  await post(`/invitations/${inv.token}/accept`, {}, u.token);
}
const project = await post(`/workspaces/${ws.id}/projects`, { key: 'SMK', name: 'Dự án thử AI', pmUserId: pm.id }, pm.token);
await json(`/projects/${project.id}/members`, { method: 'PUT', body: JSON.stringify({ members: [{ userId: pm.id, role: 'PM' }, { userId: lan.id, role: 'MEMBER' }, { userId: minh.id, role: 'MEMBER' }] }) }, pm.token);
const skills = await json(`/workspaces/${ws.id}/skills`, {}, pm.token);
const pick = (names) => skills.filter((s) => names.some((n) => s.name.toLowerCase().includes(n)));
const lanSkills = pick(['react', 'next', 'tailwind', 'html', 'css', 'typescript']).map((s) => ({ skillId: s.id, level: 4 }));
const minhSkills = pick(['nestjs', 'node', 'postgres', 'prisma', 'sql', 'docker']).map((s) => ({ skillId: s.id, level: 4 }));
await json(`/workspaces/${ws.id}/me/skills`, { method: 'PUT', body: JSON.stringify({ skills: lanSkills }) }, lan.token);
await json(`/workspaces/${ws.id}/me/skills`, { method: 'PUT', body: JSON.stringify({ skills: minhSkills }) }, minh.token);
const sprint = await post(`/projects/${project.id}/sprints`, { name: 'Sprint 1', goal: 'Đăng nhập & bảo mật', startDate: iso(plus(monday, 7)), endDate: iso(plus(monday, 18)) }, pm.token);
const active = await post(`/projects/${project.id}/sprints`, { name: 'Sprint 0', startDate: iso(plus(monday, -7)), endDate: iso(plus(monday, 4)) }, pm.token);
await post(`/projects/${project.id}/tasks`, { title: 'Việc quá hạn', estimateHours: 16, sprintId: active.id, startDate: iso(plus(monday, -7)), dueDate: iso(plus(monday, -3)), assigneeIds: [minh.id] }, pm.token);
await post(`/projects/${project.id}/tasks`, { title: 'Việc đang làm', estimateHours: 12, sprintId: active.id, startDate: iso(monday), dueDate: iso(plus(monday, 4)), assigneeIds: [lan.id] }, pm.token);
await post(`/sprints/${active.id}/start`, {}, pm.token);
console.log(`Workspace ${ws.id} · dự án ${project.id} · sprint đích ${sprint.id} · Lan ${lanSkills.length} kỹ năng, Minh ${minhSkills.length} kỹ năng`);

// ── Phân rã ──
console.log('\n▶ POST /ai/decompose …');
let t0 = Date.now();
const dec = await post(`/projects/${project.id}/ai/decompose`, { requirement: REQUIREMENT, sprintId: sprint.id, detail: DETAIL }, pm.token);
console.log(`  ${Date.now() - t0} ms · action ${dec.action.type} · proposal ${dec.proposalId} · cached ${dec.cached}`);
console.log(`  usage: ${JSON.stringify(dec.usage)}`);
console.log(`  reply: ${dec.action.reply}`);
if (dec.action.type === 'DECOMPOSE_PROPOSAL') {
  for (const t of dec.action.tasks)
    console.log(`  ${t.draftKey.padEnd(3)} ${String(t.estimateHours).padStart(4)}h  ${t.priority ?? '-'} khó ${t.difficulty ?? '-'}  ${t.suggestedAssignee ?? '—'}  [${t.requiredSkills.map((s) => `${s.skill}≥${s.minLevel}`).join(' ')}] ${t.dependsOn.length ? `← ${t.dependsOn.join(',')}` : ''}  ${t.title}`);
  if (dec.action.assumptions?.length) console.log(`  giả định: ${dec.action.assumptions.join(' | ')}`);
  console.log(`  validation: ok=${dec.validation.ok} lỗi=${dec.validation.errors.length} cảnh báo=${dec.validation.warnings.length} facts=${JSON.stringify(dec.validation.facts)}`);
  for (const e of dec.validation.errors) console.log(`    ✖ ${e.path} [${e.code}] ${e.message}`);
  for (const w of dec.validation.warnings) console.log(`    ⚠ ${w.path} [${w.code}] ${w.message}`);
  if (has('apply') && dec.validation.ok) {
    const ap = await post(`/ai/proposals/${dec.proposalId}/apply`, {}, pm.token);
    console.log(`  ✔ áp dụng: ${ap.tasks.map((t) => `${t.draftKey}=${t.key}`).join(', ')}`);
  }
} else {
  console.log(`  ${JSON.stringify(dec.action)}`);
}

// ── Giải thích rủi ro ──
console.log('\n▶ POST /sprints/:id/forecast/explain …');
t0 = Date.now();
const ex = await post(`/sprints/${active.id}/forecast/explain`, {}, pm.token);
console.log(`  ${Date.now() - t0} ms · backend ${ex.forecast.riskLevel} (ETA ${ex.forecast.eta}, còn ${ex.forecast.remainingHours} h) · AI ${ex.action.riskLevel} · validation ok=${ex.validation.ok} · cached ${ex.cached}`);
console.log(`  ${ex.action.reply}`);
for (const c of ex.action.causes ?? []) console.log(`  • ${c.code ?? ''} ${c.text}`);
for (const r of ex.action.recommendations ?? []) console.log(`  → ${r}`);
console.log(`  usage: ${JSON.stringify(ex.usage)}`);

const quota = await json(`/ai/quota?workspaceId=${ws.id}`, {}, pm.token);
console.log(`\nHạn mức: ${quota.used}/${quota.limit}, mở lại ${quota.resetsAt}`);
const usage = await json(`/workspaces/${ws.id}/ai-usage?groupBy=purpose`, {}, pm.token);
console.log(`Sổ token: ${JSON.stringify(usage.totals)}`);

// ── Chat theo phiên (Phase 8) ──
if (has('chat')) {
  let sessionId;
  const turns = [
    `Phân rã yêu cầu sau thành công việc cho sprint: ${REQUIREMENT}`,
    'Cái thứ hai đổi thành 6 giờ, giao chị Lan',
    'Bỏ cái cuối cùng đi',
  ];
  for (const text of turns) {
    console.log(`\n▶ POST /ai/chat: "${text.slice(0, 70)}…"`);
    t0 = Date.now();
    const r = await post('/ai/chat', { projectId: project.id, sessionId, text, sprintId: sprint.id }, pm.token);
    sessionId = r.sessionId;
    console.log(`  ${Date.now() - t0} ms · ${r.action.type} · validation ${r.validation ? (r.validation.ok ? 'ok' : `lỗi ${r.validation.errors.map((e) => e.code).join(',')}`) : '—'} · usage ${JSON.stringify(r.usage)}`);
    console.log(`  reply: ${r.action.reply}`);
    for (const p of r.proposals)
      console.log(`  [${p.kind} · ${p.status} · v${p.version}] ${p.items.map((i) => `${i.draftKey}${i.status === 'APPLIED' ? '✓' : i.status === 'DISCARDED' ? '✗' : ''} ${i.title} (${i.estimateHours ?? '?'}h${i.assignee ? ` → ${i.assignee}` : ''})`).join(' · ')}`);
  }
  console.log(`\nPhiên ${sessionId} — GET /ai/sessions/${sessionId} để xem lại.`);
}
