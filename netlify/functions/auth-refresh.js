export async function handler(event) {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  try {
    const { refresh_token } = JSON.parse(event.body);
    if (!refresh_token) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing refresh token' }) };
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token, client_id: process.env.VITE_GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET,
        grant_type: 'refresh_token',
      }),
    });
    const tokens = await tokenResponse.json();
    if (tokens.error) return { statusCode: 400, headers, body: JSON.stringify({ error: tokens.error_description || tokens.error }) };
    return { statusCode: 200, headers, body: JSON.stringify(tokens) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error' }) };
  }
}
