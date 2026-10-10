import { webLink } from './web-links';

describe('đường dẫn trong thông báo trỏ vào route web có thật', () => {
  const pid = '33333333-3333-4333-8333-000000000001';
  it('việc, sprint, dự án — không còn tiền tố /p/ (404 trên web)', () => {
    expect(webLink.task(pid, 'ST-6')).toBe(`/projects/${pid}/tasks/ST-6`);
    expect(webLink.sprint(pid, 's1')).toBe(
      `/projects/${pid}/sprints?sprint=s1`,
    );
    expect(webLink.project(pid)).toBe(`/projects/${pid}/dashboard`);
    for (const l of [
      webLink.task(pid, 'ST-6'),
      webLink.sprint(pid, 's1'),
      webLink.project(pid),
    ])
      expect(l.startsWith('/p/')).toBe(false);
  });
});
