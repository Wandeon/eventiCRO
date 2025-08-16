export async function verifyFriendlyCaptcha(token: string): Promise<boolean> {
  if (!token) return false;
  const secret = process.env.FRIENDLY_CAPTCHA_SECRET;
  if (!secret) {
    // In test/dev environments without secret, accept a magic token
    return token === 'test';
  }
  try {
    const res = await fetch('https://api.friendlycaptcha.com/api/v1/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ solution: token, secret }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return !!data.success;
  } catch {
    return false;
  }
}
