export const generateId = () => crypto.randomUUID();
export const nowISO = () => new Date().toISOString();
export const truncate = (text: string, max = 500) =>
  text.length <= max ? text : text.slice(0, max) + '\u2026';
