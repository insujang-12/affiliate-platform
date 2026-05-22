// 8 rounds ≈ 50-80ms — sufficient security for a web app, 4× faster than 10 rounds
export const BCRYPT_ROUNDS = 8;

export function formatKRW(amount: number): string {
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(amount);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('ko-KR').format(n);
}

export function generateCode(length = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
