export const config = { runtime: 'nodejs' };

function json(res: any, status: number, data: any) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

export default async function handler(_req: any, res: any) {
  json(res, 200, { ok: true, service: 'api', ts: new Date().toISOString() });
}
