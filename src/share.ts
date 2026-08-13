export function roomShareUrl(roomId: string): string {
  return `${window.location.origin}/r/${roomId}`;
}
