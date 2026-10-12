const PAGE_SIZE = 25;

export function listPage(count: number, requested: number) {
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const page = Math.max(0, Math.min(requested, pages - 1));
  const start = page * PAGE_SIZE;
  return { pages, page, start, end: Math.min(count, start + PAGE_SIZE) };
}
