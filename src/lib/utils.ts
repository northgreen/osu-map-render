/**
 * Binary search: find the rightmost index where arr[i] <= value.
 * Returns -1 if no such element exists.
 */
export function bisectRight(arr: number[], value: number): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid] <= value) lo = mid + 1;
    else hi = mid;
  }
  return lo - 1;
}
