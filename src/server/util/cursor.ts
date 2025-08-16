export interface Cursor {
  start_time: string;
  id: string;
}

export function encodeCursor(start_time: string, id: string): string {
  const payload: Cursor = { start_time, id };
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

export function decodeCursor(cursor: string): Cursor {
  const json = Buffer.from(cursor, 'base64url').toString('utf8');
  const obj = JSON.parse(json);
  return { start_time: obj.start_time, id: obj.id };
}
