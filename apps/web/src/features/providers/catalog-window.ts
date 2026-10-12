export const CATALOG_CARD_STEP = 82;
export const CATALOG_VIEW_HEIGHT = 484;
const OVERSCAN = 2;

export function catalogWindow(count: number, columns: number, scrollTop: number): { start: number; end: number; rows: number } {
  const rows = Math.ceil(count / columns);
  const top = Math.min(Math.max(0, scrollTop), Math.max(0, rows * CATALOG_CARD_STEP - 8 - CATALOG_VIEW_HEIGHT));
  return {
    start: Math.max(0, Math.floor(top / CATALOG_CARD_STEP) - OVERSCAN),
    end: Math.min(rows, Math.ceil((top + CATALOG_VIEW_HEIGHT) / CATALOG_CARD_STEP) + OVERSCAN),
    rows,
  };
}
