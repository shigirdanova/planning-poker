export function roomShareUrl(roomId: string, panel = false): string {
  const url = new URL(`/r/${roomId}`, window.location.origin);
  if (panel) url.searchParams.set("panel", "1");
  return url.toString();
}
