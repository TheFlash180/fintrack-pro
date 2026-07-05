// Duplicate protection: a stable hash of date+amount+description means
// re-uploading the same statement never double-counts.

function normalize(description: string): string {
  return description.trim().toLowerCase().replace(/\s+/g, ' ');
}

export async function dedupeHash(
  txDate: string,
  amount: number,
  description: string,
): Promise<string> {
  const input = `${txDate}|${amount.toFixed(2)}|${normalize(description)}`;
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
