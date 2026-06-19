export function lbdApiBase() {
  const wsProto = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = window.TALK2ME_WS_URL || `${wsProto}://${location.host}/ws`;
  return ws.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:').replace(/\/ws$/, '');
}

export async function fetchLbdCredits(getToken) {
  const token = await getToken(true);
  if (!token) return null;
  const res = await fetch(`${lbdApiBase()}/api/lbd/credits`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return res.json();
}

export function creditsLabel(credits) {
  if (!credits) return '';
  const n = Number(credits.remaining) || 0;
  const limit = Number(credits.limit) || 5;
  return `${n}/${limit} free today`;
}