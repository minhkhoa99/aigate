export const TABLE_ROW_HEIGHT = 36;
export const TABLE_VIEW_HEIGHT = 432;
const HEADER_HEIGHT = 36;
const OVERSCAN = 5;

export function tableWindow(count: number, scrollTop: number): { start: number; end: number } {
  const maxScroll = Math.max(0, (count + 1) * TABLE_ROW_HEIGHT - TABLE_VIEW_HEIGHT - HEADER_HEIGHT);
  const top = Math.min(Math.max(0, scrollTop), maxScroll);
  const first = Math.floor(Math.max(0, top - HEADER_HEIGHT) / TABLE_ROW_HEIGHT);
  return {
    start: Math.max(0, first - OVERSCAN),
    end: Math.min(count, Math.ceil((top + TABLE_VIEW_HEIGHT) / TABLE_ROW_HEIGHT) + OVERSCAN),
  };
}
