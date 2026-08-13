export function consensus(votes: Array<string | null>): number | null {
  const nums = votes
    .filter((value): value is string => value !== null && /^\d+$/.test(value))
    .map(Number)
    .sort((a, b) => a - b);
  if (nums.length === 0) return null;
  const mid = Math.floor(nums.length / 2);
  if (nums.length % 2 === 1) return nums[mid];
  return Math.round((nums[mid - 1] + nums[mid]) / 2);
}
