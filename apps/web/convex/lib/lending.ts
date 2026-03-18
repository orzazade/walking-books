export function getDefaultLendingDays(pageCount: number): number {
  if (pageCount < 200) return 14;
  if (pageCount > 500) return 30;
  return 21;
}

export function getEffectiveLendingDays(
  pageCount: number,
  sharerMaxDays: number | undefined,
): number {
  const systemDefault = getDefaultLendingDays(pageCount);
  if (sharerMaxDays === undefined) return systemDefault;
  return Math.min(systemDefault, sharerMaxDays);
}
