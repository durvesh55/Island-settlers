/** "Ana" → "Ana's", "Silas" → "Silas'", and the default single-player name "You" → "Your". */
export function possessive(name: string): string {
  if (name.trim().toLowerCase() === 'you') return 'Your';
  return /s$/i.test(name) ? `${name}’` : `${name}’s`;
}
