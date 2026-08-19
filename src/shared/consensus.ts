export function consensus(votes: Array<string | null>): number | null {
  const nums = votes
    .filter((value): value is string => value !== null && /^\d+$/.test(value))
    .map(Number);
  if (nums.length === 0) return null;

  const counts = new Map<number, number>();
  for (const value of nums) counts.set(value, (counts.get(value) ?? 0) + 1);

  let best: number | null = null;
  let bestCount = 0;
  let tied = false;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
      tied = false;
    } else if (count === bestCount) {
      tied = true;
    }
  }

  return tied ? null : best;
}
