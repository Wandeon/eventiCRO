export interface Cursor {
  t: string;
  id: string;
}

export function encodeCursor(t: string, id: string): string {
  return Buffer.from(JSON.stringify({ t, id }), 'utf8').toString('base64');
}

export function decodeCursor(cursor: string): Cursor | null {
  try {
    const json = Buffer.from(cursor, 'base64').toString('utf8');
    const obj = JSON.parse(json);
    if (typeof obj.t === 'string' && typeof obj.id === 'string') return obj;
    return null;
  } catch {
    return null;
  }
}
