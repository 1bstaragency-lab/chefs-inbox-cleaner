// âââ Gmail API Service Layer ââââââââââââââââââââââââââââââââââââââââââââââââ
// All calls go directly to Gmail REST API with the user's OAuth access token.

const BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

async function api(path, token, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...opts.headers,
    },
  });
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || `Gmail API error ${res.status}`);
  return data;
}

// âââ Fetch emails âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

export async function fetchEmails(token, { maxResults = 50, query = '', pageToken } = {}) {
  const params = new URLSearchParams({
    maxResults: String(maxResults),
    q: query || 'in:inbox',
  });
  if (pageToken) params.set('pageToken', pageToken);

  const list = await api(`/messages?${params}`, token);
  if (!list.messages) return { emails: [], nextPageToken: null };

  // Batch-fetch full message metadata
  const emails = await Promise.all(
    list.messages.map((m) => api(`/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`, token))
  );

  return {
    emails: emails.map(parseMessage),
    nextPageToken: list.nextPageToken || null,
  };
}

function parseMessage(msg) {
  const headers = msg.payload?.headers || [];
  const get = (name) => headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';
  const labels = msg.labelIds || [];

  return {
    id: msg.id,
    threadId: msg.threadId,
    from: get('From'),
    subject: get('Subject'),
    date: get('Date'),
    snippet: msg.snippet || '',
    labels,
    read: !labels.includes('UNREAD'),
    starred: labels.includes('STARRED'),
    category: categorize(get('From'), get('Subject'), labels),
  };
}

// âââ Smart categorization âââââââââââââââââââââââââââââââââââââââââââââââââââ

const SPAM_PATTERNS = [
  /temu/i, /shein/i, /fashion\s*nova/i, /wish\.com/i, /aliexpress/i,
  /unsubscribe.*sale/i, /coupon/i, /clearance/i, /limited.time.offer/i,
  /act.now/i, /winner/i, /congratulations.*won/i, /crypto/i, /bitcoin/i,
  /nft/i, /weight.loss/i, /diet.pill/i, /click.here/i, /exclusive.offer/i,
  /buy.now/i, /earn.money/i, /lottery/i, /prize/i, /free.gift/i,
  /miracle/i, /cheap.*clothes/i, /designer.*\$\d/i, /90%\s*off/i,
  /50%\s*off/i, /flash\s*sale/i,
];

const CLIENT_PATTERNS = [
  /catering/i, /wedding/i, /birthday.*party/i, /event/i, /reception/i,
  /guests/i, /menu.*tasting/i, /quote.*request/i, /book.*chef/i,
  /dinner.*party/i, /corporate.*lunch/i, /team.*building/i, /gala/i,
  /fundraiser/i, /banquet/i,
];

const VENDOR_PATTERNS = [
  /sysco/i, /usfoods/i, /restaurant.*depot/i, /webstaurant/i,
  /chefworks/i, /foodservice/i, /propane/i, /produce.*deliver/i,
  /supply.*order/i, /shipping.*confirm/i,
];

const INVOICE_PATTERNS = [
  /invoice/i, /statement.*account/i, /payment.*remind/i, /billing/i,
  /receipt/i, /past.*due/i, /amount.*owed/i,
];

const ORDER_PATTERNS = [
  /order.*confirm/i, /order.*\d+.*guest/i, /permit.*approv/i,
  /booking.*confirm/i, /reservation/i,
];

function categorize(from, subject, labels) {
  const text = `${from} ${subject}`;

  if (labels.includes('SPAM') || labels.includes('CATEGORY_PROMOTIONS') || SPAM_PATTERNS.some((p) => p.test(text))) {
    return 'spam';
  }
  if (INVOICE_PATTERNS.some((p) => p.test(text))) return 'invoices';
  if (ORDER_PATTERNS.some((p) => p.test(text))) return 'orders';
  if (CLIENT_PATTERNS.some((p) => p.test(text))) return 'clients';
  if (VENDOR_PATTERNS.some((p) => p.test(text))) return 'vendors';
  return 'other';
}

// âââ Actions ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

export async function trashMessages(token, ids) {
  return Promise.all(ids.map((id) => api(`/messages/${id}/trash`, token, { method: 'POST' })));
}

export async function archiveMessages(token, ids) {
  // Archive = remove INBOX label
  return Promise.all(
    ids.map((id) =>
      api(`/messages/${id}/modify`, token, {
        method: 'POST',
        body: JSON.stringify({ removeLabelIds: ['INBOX'] }),
      })
    )
  );
}

export async function markAsRead(token, ids) {
  return Promise.all(
    ids.map((id) =>
      api(`/messages/${id}/modify`, token, {
        method: 'POST',
        body: JSON.stringify({ removeLabelIds: ['UNREAD'] }),
      })
    )
  );
}

export async function batchModify(token, ids, addLabels = [], removeLabels = []) {
  if (ids.length === 0) return;
  // Gmail batch modify (up to 1000 at a time)
  const chunks = [];
  for (let i = 0; i < ids.length; i += 1000) {
    chunks.push(ids.slice(i, i + 1000));
  }
  return Promise.all(
    chunks.map((chunk) =>
      api('/messages/batchModify', token, {
        method: 'POST',
        body: JSON.stringify({
          ids: chunk,
          addLabelIds: addLabels,
          removeLabelIds: removeLabels,
        }),
      })
    )
  );
}

export async function getProfile(token) {
  return api('/profile', token);
}
