import { webLink } from './web-links';

describe('đường dẫn trong thông báo trỏ vào route web có thật', () => {
  const pid = '33333333-3333-4333-8333-000000000001';
  it('việc, sprint, dự án — không còn tiền tố /p/ (404 trên web)', () => {
    expect(webLink.task(pid, 'ST-6')).toBe(`/projects/${pid}/tasks/ST-6`);
    expect(webLink.sprints(pid)).toBe(`/projects/${pid}/settings?tab=sprints`);
    expect(webLink.project(pid)).toBe(`/projects/${pid}/dashboard`);
    for (const l of [
      webLink.task(pid, 'ST-6'),
      webLink.sprints(pid),
      webLink.project(pid),
    ])
      expect(l.startsWith('/p/')).toBe(false);
  });
});
