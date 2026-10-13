export function safeNextPath(value: string | null, fallback = '/cliente') {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')
    || /[\u0000-\u001f]/.test(value)) return fallback;
  try {
    const url = new URL(value, 'https://cosmaker.local');
    return url.origin === 'https://cosmaker.local' ? `${url.pathname}${url.search}` : fallback;
  } catch {
    return fallback;
  }
}
