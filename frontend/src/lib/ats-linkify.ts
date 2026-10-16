export type TextSegment =
  | { type: 'text'; value: string }
  | { type: 'link'; value: string; href: string };

const URL_WITH_SCHEME_RE = /https?:\/\/[^\s,;)<>\]]+/gi;
const WWW_RE = /www\.[^\s,;)<>\]]+/gi;
const DOMAIN_PATH_RE =
  /(?:linkedin\.com\/[^\s,;)<>\]]+|github\.com\/[^\s,;)<>\]]+|gitlab\.com\/[^\s,;)<>\]]+)/gi;
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

export function ensureHref(raw: string): string {
  const t = raw.trim().replace(/[.,;]+$/, '');
  if (!t) return '';
  if (/alyekseyenko\.ovh/i.test(t)) return 'https://github.com/alyekseyenko';
  if (/^mailto:/i.test(t)) return t;
  if (/^https?:\/\//i.test(t)) return t;
  if (t.includes('@') && !t.includes('/')) return `mailto:${t}`;
  return `https://${t.replace(/^\/+/, '')}`;
}

export function linkLabelFromHref(href: string, raw?: string): string {
  const mail = href.replace(/^mailto:/i, '');
  if (/^mailto:/i.test(href) || (raw && raw.includes('@') && !raw.includes('/'))) {
    return raw?.trim() || mail;
  }
  try {
    const url = new URL(href);
    const host = url.hostname.replace(/^www\./i, '').toLowerCase();
    const path = url.pathname.replace(/\/$/, '').replace(/^\//, '');
    if (host === 'linkedin.com' || host.endsWith('.linkedin.com')) return 'LinkedIn';
    if (host === 'github.com') return path ? `GitHub: ${path}` : 'GitHub';
    if (host === 'gitlab.com') return path ? `GitLab: ${path}` : 'GitLab';
    const short = `${host}${path ? `/${path}` : ''}`;
    return short.length > 42 ? `${short.slice(0, 39)}…` : short;
  } catch {
    return (raw || href).replace(/^https?:\/\//, '').slice(0, 48);
  }
}

function pushSegment(segments: TextSegment[], type: 'text' | 'link', value: string, href?: string) {
  if (!value) return;
  if (type === 'text') {
    segments.push({ type: 'text', value });
    return;
  }
  if (href) segments.push({ type: 'link', value, href });
}

function mergeAdjacentText(segments: TextSegment[]): TextSegment[] {
  const out: TextSegment[] = [];
  for (const seg of segments) {
    if (seg.type === 'text' && out.length && out[out.length - 1].type === 'text') {
      out[out.length - 1].value += seg.value;
    } else {
      out.push({ ...seg });
    }
  }
  return out;
}

/** Split plain text into normal text and clickable links (URLs + emails). */
export function parseTextSegments(input: string): TextSegment[] {
  if (!input) return [];
  const segments: TextSegment[] = [];
  const matchers: Array<{ re: RegExp; kind: 'url' | 'email' }> = [
    { re: new RegExp(URL_WITH_SCHEME_RE.source, 'gi'), kind: 'url' },
    { re: new RegExp(WWW_RE.source, 'gi'), kind: 'url' },
    { re: new RegExp(DOMAIN_PATH_RE.source, 'gi'), kind: 'url' },
    { re: new RegExp(EMAIL_RE.source, 'g'), kind: 'email' }
  ];

  type Match = { start: number; end: number; raw: string; kind: 'url' | 'email' };
  const matches: Match[] = [];
  for (const { re, kind } of matchers) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(input)) !== null) {
      matches.push({ start: m.index, end: m.index + m[0].length, raw: m[0], kind });
    }
  }
  matches.sort((a, b) => a.start - b.start || b.end - a.end);

  const taken: Array<[number, number]> = [];
  const overlaps = (s: number, e: number) => taken.some(([a, b]) => s < b && e > a);

  let cursor = 0;
  for (const match of matches) {
    if (overlaps(match.start, match.end)) continue;
    taken.push([match.start, match.end]);
    if (match.start > cursor) {
      pushSegment(segments, 'text', input.slice(cursor, match.start));
    }
    const href =
      match.kind === 'email' ? ensureHref(match.raw) : ensureHref(match.raw);
    const label =
      match.kind === 'email'
        ? match.raw
        : linkLabelFromHref(href, match.raw);
    pushSegment(segments, 'link', label, href);
    cursor = match.end;
  }
  if (cursor < input.length) {
    pushSegment(segments, 'text', input.slice(cursor));
  }
  return mergeAdjacentText(segments);
}

export type ProfileLink = { label: string; href: string };

/** Header links: email, website, plus URLs found in CV body (LinkedIn, GitHub, …). */
export function collectProfileLinks(cv: {
  personal_info?: { email?: string; website?: string };
  summary?: string;
  experience?: Array<{ bullets?: string[] }>;
  selected_projects?: Array<{ name?: string; impact?: string }>;
}): ProfileLink[] {
  const out: ProfileLink[] = [];
  const seen = new Set<string>();
  const add = (href: string, label?: string) => {
    const h = ensureHref(href);
    if (!h || seen.has(h)) return;
    seen.add(h);
    out.push({ label: label || linkLabelFromHref(h, href), href: h });
  };

  const pi = cv.personal_info || {};
  if (pi.email) add(`mailto:${pi.email}`, pi.email);
  if (pi.website) add(pi.website);

  const chunks: string[] = [];
  if (cv.summary) chunks.push(cv.summary);
  for (const exp of cv.experience || []) {
    chunks.push(...(exp.bullets || []));
  }
  for (const p of cv.selected_projects || []) {
    chunks.push(p.name || '', p.impact || '');
  }
  const blob = chunks.join(' ');
  for (const seg of parseTextSegments(blob)) {
    if (seg.type === 'link' && !seg.href.startsWith('mailto:')) {
      add(seg.href, seg.value);
    }
  }
  return out;
}
