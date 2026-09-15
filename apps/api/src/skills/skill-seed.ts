/** Bộ kỹ năng mẫu nạp khi tạo workspace (UC-06). Alias để ánh xạ tên do AI hoặc người gõ về danh mục. */
export const DEFAULT_SKILLS: ReadonlyArray<{
  name: string;
  category: string;
  aliases?: string[];
}> = [
  // Frontend
  { name: 'React', category: 'Frontend', aliases: ['ReactJS', 'React.js'] },
  { name: 'Next.js', category: 'Frontend', aliases: ['NextJS', 'Next'] },
  { name: 'TypeScript', category: 'Frontend', aliases: ['TS'] },
  { name: 'Tailwind CSS', category: 'Frontend', aliases: ['Tailwind'] },
  { name: 'HTML/CSS', category: 'Frontend', aliases: ['HTML', 'CSS'] },
  {
    name: 'UI Testing',
    category: 'Frontend',
    aliases: ['Vitest', 'Playwright', 'Testing Library'],
  },
  // Backend
  { name: 'Node.js', category: 'Backend', aliases: ['NodeJS', 'Node'] },
  { name: 'NestJS', category: 'Backend', aliases: ['Nest'] },
  { name: 'REST API', category: 'Backend', aliases: ['API', 'Thiết kế API'] },
  {
    name: 'PostgreSQL',
    category: 'Backend',
    aliases: ['Postgres', 'SQL', 'CSDL'],
  },
  { name: 'Prisma', category: 'Backend', aliases: ['ORM'] },
  {
    name: 'Socket.io',
    category: 'Backend',
    aliases: ['WebSocket', 'Realtime'],
  },
  {
    name: 'Xác thực & bảo mật',
    category: 'Backend',
    aliases: ['JWT', 'Auth', 'Security', 'Phân quyền'],
  },
  { name: 'Redis / Cache', category: 'Backend', aliases: ['Redis', 'Caching'] },
  // Dữ liệu & AI
  { name: 'Python', category: 'Dữ liệu & AI' },
  {
    name: 'Prompt Engineering',
    category: 'Dữ liệu & AI',
    aliases: ['Prompt', 'Viết prompt'],
  },
  {
    name: 'Tích hợp LLM',
    category: 'Dữ liệu & AI',
    aliases: ['LLM', 'Gemini', 'OpenAI', 'AI Integration'],
  },
  {
    name: 'Phân tích dữ liệu',
    category: 'Dữ liệu & AI',
    aliases: ['Data Analysis', 'Thống kê'],
  },
  // DevOps
  { name: 'Docker', category: 'DevOps', aliases: ['Container'] },
  {
    name: 'CI/CD',
    category: 'DevOps',
    aliases: ['GitHub Actions', 'Pipeline'],
  },
  { name: 'Linux', category: 'DevOps', aliases: ['Shell', 'Bash'] },
  {
    name: 'Triển khai Cloud',
    category: 'DevOps',
    aliases: ['Vercel', 'Render', 'Supabase', 'Deploy', 'Cloud'],
  },
  {
    name: 'Giám sát & log',
    category: 'DevOps',
    aliases: ['Monitoring', 'Logging'],
  },
  // Thiết kế
  {
    name: 'UI/UX',
    category: 'Thiết kế',
    aliases: ['UX', 'UI', 'Thiết kế giao diện'],
  },
  { name: 'Figma', category: 'Thiết kế', aliases: ['Mockup', 'Wireframe'] },
  // Quản lý & chất lượng
  {
    name: 'Scrum / Agile',
    category: 'Quản lý',
    aliases: ['Scrum', 'Agile', 'Kanban'],
  },
  {
    name: 'Phân tích nghiệp vụ',
    category: 'Quản lý',
    aliases: ['BA', 'Business Analysis', 'Khảo sát yêu cầu'],
  },
  {
    name: 'Viết tài liệu',
    category: 'Quản lý',
    aliases: ['Documentation', 'Báo cáo'],
  },
  {
    name: 'Kiểm thử',
    category: 'Chất lượng',
    aliases: ['QA', 'Testing', 'Test case'],
  },
  { name: 'Code review', category: 'Chất lượng', aliases: ['Review'] },
];
