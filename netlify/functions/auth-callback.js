export async function handler(event) {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Content-Type': 'application/json' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  try {
    const { code, redirect_uri } = JSON.parse(event.body);
    if (!code) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing authorization code' }) };
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, client_id: process.env.VITE_GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirect_uri || process.env.VITE_APP_URL || 'http://localhost:8888',
        grant_type: 'authorization_code',
      }),
    });
    const tokens = await tokenResponse.json();
    if (tokens.error) return { statusCode: 400, headers, body: JSON.stringify({ error: tokens.error_description || tokens.error }) };
    return { statusCode: 200, headers, body: JSON.stringify(tokens) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal server error' }) };
  }
}
