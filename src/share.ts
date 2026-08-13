export function roomShareUrl(roomId: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}#/r/${roomId}`;
}
