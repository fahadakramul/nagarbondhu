import { Router } from 'express';

const router = Router();
const ORIGIN = 'https://erajshahi.portal.gov.bd';
type Notice = { title: string; url: string; date: string | null };
let cached: { notices: Notice[]; fetchedAt: string; available: boolean; until: number } | null = null;

function plain(value: string) {
  return value.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 220);
}

router.get('/city-notices', async (_req, res) => {
  if (cached && cached.until > Date.now()) return res.json({ success: true, ...cached, source: ORIGIN });
  try {
    const response = await fetch(ORIGIN + '/', { signal: AbortSignal.timeout(8000), headers: { Accept: 'text/html', 'User-Agent': 'NagarBondhu/1.0 public notices' } });
    if (!response.ok) throw new Error('Official notice source unavailable');
    const html = await response.text();
    const section = html.match(/<div class="notice-card">([\s\S]*?)<\/ul>/)?.[1] || '';
    const notices: Notice[] = [];
    for (const match of section.matchAll(/<a class="notice-link" href="([^"]+)">([\s\S]*?)<\/a>/g)) {
      const url = new URL(match[1], ORIGIN);
      if (url.origin !== ORIGIN || !url.pathname.startsWith('/pages/notices/')) continue;
      const title = plain(match[2].match(/<p title="([^"]+)" class="notice-text">/)?.[1] || '');
      if (!title) continue;
      const date = plain(match[2].match(/<span class="notice-tag">([\s\S]*?)<\/span>/)?.[1] || '') || null;
      notices.push({ title, url: url.href, date });
      if (notices.length === 5) break;
    }
    if (!notices.length) throw new Error('No notices parsed');
    cached = { notices, fetchedAt: new Date().toISOString(), available: true, until: Date.now() + 30 * 60_000 };
  } catch {
    cached = { notices: [], fetchedAt: new Date().toISOString(), available: false, until: Date.now() + 5 * 60_000 };
  }
  res.json({ success: true, ...cached, source: ORIGIN });
});

export default router;
