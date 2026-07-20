// patient.photo_base64 is stored/transmitted as raw base64 with no
// data-URI prefix — the prefix must be added client-side to render it.
export function toDataUri(raw?: string | null): string | null {
  if (!raw) return null;
  return `data:image/jpeg;base64,${raw}`;
}

export function stripDataUri(uri: string): string {
  return uri.replace(/^data:image\/\w+;base64,/, "");
}
