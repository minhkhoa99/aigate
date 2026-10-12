export const REQUEST_ROW_HEIGHT = 36;
export const REQUEST_VIEW_HEIGHT = 432;
const HEADER_HEIGHT = 36;
const OVERSCAN = 5;

export function requestWindow(count: number, scrollTop: number): { start: number; end: number } {
  const maxScroll = Math.max(0, (count + 1) * REQUEST_ROW_HEIGHT - REQUEST_VIEW_HEIGHT - HEADER_HEIGHT);
  const top = Math.min(Math.max(0, scrollTop), maxScroll);
  const first = Math.floor(Math.max(0, top - HEADER_HEIGHT) / REQUEST_ROW_HEIGHT);
  return {
    start: Math.max(0, first - OVERSCAN),
    end: Math.min(count, Math.ceil((top + REQUEST_VIEW_HEIGHT) / REQUEST_ROW_HEIGHT) + OVERSCAN),
  };
}
