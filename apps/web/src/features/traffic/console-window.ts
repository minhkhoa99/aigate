export const CONSOLE_ROW_HEIGHT = 26;
export const CONSOLE_VIEW_HEIGHT = 372;
const OVERSCAN = 5;

export function consoleWindow(count: number, scrollTop: number): { start: number; end: number } {
  const top = Math.min(Math.max(0, scrollTop), Math.max(0, count * CONSOLE_ROW_HEIGHT - CONSOLE_VIEW_HEIGHT));
  return {
    start: Math.max(0, Math.floor(top / CONSOLE_ROW_HEIGHT) - OVERSCAN),
    end: Math.min(count, Math.ceil((top + CONSOLE_VIEW_HEIGHT) / CONSOLE_ROW_HEIGHT) + OVERSCAN),
  };
}
