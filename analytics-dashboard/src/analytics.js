// Coarse metadata only; never used as a fingerprint.
export function classifyClient(ua = '', hints = {}) {
  let browser = 'Other';
  for (const [name, pattern] of [
    ['Edge', /(?:Edg|EdgiOS|EdgA)\/([\d.]+)/], ['Opera', /(?:OPR|OPiOS)\/([\d.]+)/],
    ['Firefox', /(?:Firefox|FxiOS)\/([\d.]+)/], ['Chrome', /(?:Chrome|CriOS)\/([\d.]+)/],
    ['Safari', /Version\/([\d.]+).*Safari/],
  ]) { if (pattern.test(ua)) { browser = name; break; } }
  const ipad = /iPad/.test(ua) || (/Macintosh/.test(ua) && hints.tablet === true);
  const os = ipad || /iPhone|iPod/.test(ua) ? 'iOS'
    : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows'
      : /CrOS/.test(ua) ? 'ChromeOS' : /Mac OS X|Macintosh/.test(ua) ? 'macOS'
        : /Linux/.test(ua) ? 'Linux' : 'Other';
  const device = ipad || /Tablet|PlayBook/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua))
    ? 'Tablet' : /Mobile|iPhone|iPod/.test(ua) ? 'Mobile' : 'Desktop';
  return { browser, os, device };
}
export function safePath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return '/';
  return value.split(/[?#]/)[0].slice(0, 500) || '/';
}
export function sourceInfo(value, origin) {
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol)) throw new Error();
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    const source = url.origin === origin ? 'ภายในเว็บ'
      : /(^|\.)google\.[a-z.]+$/.test(host) ? 'Google'
        : /(^|\.)github\.com$/.test(host) ? 'GitHub'
          : /(^|\.)facebook\.com$|^fb\.com$/.test(host) ? 'Facebook'
            : /(^|\.)instagram\.com$/.test(host) ? 'Instagram' : host;
    return { source, referrer: url.origin };
  } catch { return { source: 'โดยตรง / ไม่ทราบแหล่งที่มา', referrer: null }; }
}
