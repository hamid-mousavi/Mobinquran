/**
 * هستهٔ خالص «تشخیص صفحه‌های مطالعه‌شده» برای پیشنهاد ثبت در ختم (مرحلهٔ ۲).
 *
 * اصل: ورق‌زدن سریع یعنی خواندن نیست. صفحه‌ای «نامزد ثبت» می‌شود که کاربر
 * دست‌کم `dwellMs` روی آن مانده باشد و بعد صفحه عوض شود (یا برنامه به پس‌زمینه برود).
 * خود ثبت در ختم همیشه با تأیید صریح کاربر انجام می‌شود، نه خودکار.
 */

export const DEFAULT_DWELL_MS = 25_000;
export const MAX_PAGE = 604;

export interface PageViewState {
  current: number | null;
  enteredAt: number;
  /** صفحه‌های نامزد، مرتب و بدون تکرار */
  candidates: number[];
}

export function initialPageViewState(candidates: number[] = []): PageViewState {
  return { current: null, enteredAt: 0, candidates };
}

function isValidPage(page: unknown): page is number {
  return typeof page === 'number' && Number.isInteger(page) && page >= 1 && page <= MAX_PAGE;
}

function addPage(candidates: number[], page: number): number[] {
  if (candidates.includes(page)) return candidates;
  return [...candidates, page].sort((a, b) => a - b);
}

/** کاربر اکنون روی این صفحه است */
export function viewPage(
  state: PageViewState,
  page: number,
  now: number,
  dwellMs: number = DEFAULT_DWELL_MS
): PageViewState {
  if (!isValidPage(page)) return state;
  if (state.current === page) return state;
  const credited =
    state.current !== null && now - state.enteredAt >= dwellMs
      ? addPage(state.candidates, state.current)
      : state.candidates;
  return { current: page, enteredAt: now, candidates: credited };
}

/** خروج از مطالعه (پس‌زمینه رفتن یا بستن): صفحهٔ جاری در صورت توقف کافی ثبت می‌شود */
export function leavePage(
  state: PageViewState,
  now: number,
  dwellMs: number = DEFAULT_DWELL_MS
): PageViewState {
  if (state.current === null) return state;
  const credited =
    now - state.enteredAt >= dwellMs ? addPage(state.candidates, state.current) : state.candidates;
  return { current: null, enteredAt: 0, candidates: credited };
}

/** صفحه‌های نامزدی که هنوز در ختم ثبت نشده‌اند */
export function pendingCandidates(candidates: readonly number[], completed: readonly number[]): number[] {
  const done = new Set(completed);
  return candidates.filter((p) => isValidPage(p) && !done.has(p));
}

/** فشرده‌سازی صفحه‌ها به بازه‌های پیوسته: [12,13,14,20] ← [[12,14],[20,20]] */
export function toRanges(pages: readonly number[]): Array<[number, number]> {
  const sorted = Array.from(new Set(pages)).sort((a, b) => a - b);
  const out: Array<[number, number]> = [];
  for (const p of sorted) {
    const last = out[out.length - 1];
    if (last && p === last[1] + 1) last[1] = p;
    else out.push([p, p]);
  }
  return out;
}
