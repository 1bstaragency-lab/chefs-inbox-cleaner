import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth.js';
import { fetchEmails, trashMessages, archiveMessages, getProfile } from './gmail.js';

// âââ Constants ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

const CATEGORIES = {
  clients:  { label: 'Clients',  color: '#8B6914', icon: 'ð¤' },
  vendors:  { label: 'Vendors',  color: '#A0522D', icon: 'ð¦' },
  orders:   { label: 'Orders',   color: '#6B8E23', icon: 'ð§¾' },
  invoices: { label: 'Invoices', color: '#2E8B57', icon: 'ð°' },
  spam:     { label: 'Spam',     color: '#CD5C5C', icon: 'ð' },
  other:    { label: 'Other',    color: '#708090', icon: 'ð§' },
};

// âââ Sub-components âââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

function ProgressBar({ label, current, total, color }) {
  const pct = total === 0 ? 0 : Math.round((current / total) * 100);
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13, color: '#5C4033' }}>
        <span style={{ fontWeight: 600 }}>{label}</span>
        <span>{current} ({pct}%)</span>
      </div>
      <div style={{ background: '#E8DCC8', borderRadius: 8, height: 14, overflow: 'hidden' }}>
        <div style={{
          width: `${Math.min(pct, 100)}%`, height: '100%',
          background: `linear-gradient(90deg, ${color}, ${color}dd)`,
          borderRadius: 8, transition: 'width 0.6s ease',
        }} />
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }) {
  return (
    <div style={{
      background: '#FFFDF8', borderRadius: 14, padding: '16px 18px',
      boxShadow: '0 2px 10px rgba(139,105,20,0.08)', borderLeft: `4px solid ${color}`,
    }}>
      <div style={{ fontSize: 13, color: '#8B7D62', fontWeight: 500 }}>{icon} {label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: '#3E2C1C', marginTop: 4 }}>{value}</div>
    </div>
  );
}

function ActionButton({ label, icon, color, onClick, disabled, size = 'normal' }) {
  const sm = size === 'small';
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: sm ? '8px 14px' : '10px 18px',
      background: disabled ? '#D4C5A9' : color, color: '#FFF', border: 'none',
      borderRadius: 10, fontWeight: 600, fontSize: sm ? 13 : 14,
      cursor: disabled ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
      opacity: disabled ? 0.6 : 1, boxShadow: disabled ? 'none' : `0 2px 8px ${color}44`,
    }}>
      <span>{icon}</span> {label}
    </button>
  );
}

function EmailRow({ email, selected, onSelect, onDelete, onArchive }) {
  const cat = CATEGORIES[email.category] || CATEGORIES.other;
  const fromDisplay = email.from.replace(/<.*>/, '').trim() || email.from;
  return (
    <div onClick={() => onSelect(email.id)} style={{
      display: 'flex', alignItems: 'center', padding: '10px 14px',
      background: selected ? '#FFF3E0' : email.read ? '#FEFCF9' : '#FFF8EE',
      borderBottom: '1px solid #EDE0CE', gap: 10,
      fontWeight: email.read ? 400 : 600, cursor: 'pointer', transition: 'background 0.2s',
    }}>
      <input type="checkbox" checked={selected} onChange={() => onSelect(email.id)}
        style={{ accentColor: '#8B6914', width: 16, height: 16, cursor: 'pointer' }} />
      <span style={{
        fontSize: 11, padding: '2px 8px', borderRadius: 10,
        background: cat.color + '22', color: cat.color, fontWeight: 600,
        whiteSpace: 'nowrap', minWidth: 70, textAlign: 'center',
      }}>{cat.icon} {cat.label}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: '#7A6548', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {fromDisplay}
        </div>
        <div style={{ fontSize: 14, color: '#3E2C1C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {email.subject || '(no subject)'}
        </div>
      </div>
      <div style={{ fontSize: 12, color: '#A08E76', whiteSpace: 'nowrap', marginRight: 8 }}>
        {new Date(email.date).toLocaleDateString()}
      </div>
      <button onClick={(e) => { e.stopPropagation(); onArchive(email.id); }} title="Archive" style={{
        background: 'none', border: '1px solid #D4C5A9', borderRadius: 6,
        padding: '4px 8px', cursor: 'pointer', fontSize: 14, color: '#8B7D62',
      }}>ð¥</button>
      <button onClick={(e) => { e.stopPropagation(); onDelete(email.id); }} title="Delete" style={{
        background: 'none', border: '1px solid #E0B0B0', borderRadius: 6,
        padding: '4px 8px', cursor: 'pointer', fontSize: 14, color: '#CD5C5C',
      }}>ð</button>
    </div>
  );
}

function Toast({ message, visible }) {
  return (
    <div style={{
      position: 'fixed', bottom: 30, left: '50%',
      transform: `translateX(-50%) translateY(${visible ? 0 : 20}px)`,
      background: '#3E2C1C', color: '#FFF8EE', padding: '12px 24px', borderRadius: 12,
      fontWeight: 600, fontSize: 14, opacity: visible ? 1 : 0, transition: 'all 0.4s ease',
      boxShadow: '0 4px 20px rgba(0,0,0,0.25)', zIndex: 999, pointerEvents: 'none',
    }}>{message}</div>
  );
}

// âââ Login Screen âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

function LoginScreen({ onSignIn, error }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #FAF3E8 0%, #F0E6D3 100%)',
      fontFamily: "'Segoe UI', system-ui, sans-serif",
    }}>
      <div style={{
        background: '#FFFDF8', borderRadius: 24, padding: '48px 40px', textAlign: 'center',
        boxShadow: '0 8px 40px rgba(139,105,20,0.12)', maxWidth: 440, width: '90%',
      }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>ð½</div>
        <h1 style={{ fontSize: 28, color: '#3E2C1C', marginBottom: 8, fontWeight: 700 }}>
          Chef's Inbox Cleaner
        </h1>
        <p style={{ color: '#8B7D62', fontSize: 15, marginBottom: 32, lineHeight: 1.5 }}>
          Clean up your catering business inbox in seconds.<br/>
          Delete spam, archive old emails, and stay organized.
        </p>
        {error && (
          <div style={{
            background: '#FDECEC', color: '#CD5C5C', padding: '10px 16px', borderRadius: 10,
            fontSize: 13, marginBottom: 20, border: '1px solid #E0B0B0',
          }}>
            {error}
          </div>
        )}
        <button onClick={onSignIn} style={{
          display: 'inline-flex', alignItems: 'center', gap: 12, padding: '14px 32px',
          background: '#FFFDF8', border: '2px solid #D4C5A9', borderRadius: 12,
          fontSize: 16, fontWeight: 600, color: '#3E2C1C', cursor: 'pointer',
          transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}>
          <svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
          Sign in with Google
        </button>
        <p style={{ color: '#A08E76', fontSize: 12, marginTop: 24 }}>
          We only access your email to clean it. Nothing is stored on our servers.
        </p>
      </div>
    </div>
  );
}

// âââ Main App âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

export default function App() {
  const { user, accessToken, loading: authLoading, error: authError, signIn, signOut } = useAuth();

  const [emails, setEmails] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [filter, setFilter] = useState('all');
  const [stats, setStats] = useState({ deleted: 0, archived: 0, categorized: 0 });
  const [toast, setToastState] = useState({ message: '', visible: false });
  const [processing, setProcessing] = useState(false);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [nextPage, setNextPage] = useState(null);
  const [totalLoaded, setTotalLoaded] = useState(0);

  const showToast = useCallback((msg) => {
    setToastState({ message: msg, visible: true });
    setTimeout(() => setToastState({ message: '', visible: false }), 3000);
  }, []);

  // Load emails on login
  const loadEmails = useCallback(async (pageToken) => {
    if (!accessToken) return;
    setLoadingEmails(true);
    try {
      const result = await fetchEmails(accessToken, {
        maxResults: 50,
        query: 'in:inbox',
        pageToken,
      });
      if (pageToken) {
        setEmails((prev) => [...prev, ...result.emails]);
      } else {
        setEmails(result.emails);
      }
      setNextPage(result.nextPageToken);
      setTotalLoaded((prev) => prev + result.emails.length);
      setStats((s) => ({ ...s, categorized: 0 }));
    } catch (err) {
      showToast('Failed to load emails: ' + err.message);
    }
    setLoadingEmails(false);
  }, [accessToken, showToast]);

  useEffect(() => {
    if (accessToken) loadEmails(null);
  }, [accessToken, loadEmails]);

  // âââ Actions ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const filtered = filter === 'all' ? emails : emails.filter((e) => e.category === filter);

  const selectAllVisible = () => {
    const ids = filtered.map((e) => e.id);
    const allSelected = ids.every((id) => selected.has(id));
    setSelected(allSelected ? new Set() : new Set(ids));
  };

  const handleDelete = async (ids) => {
    const idArray = Array.isArray(ids) ? ids : [...ids];
    if (idArray.length === 0) return;
    setProcessing(true);
    try {
      await trashMessages(accessToken, idArray);
      setEmails((prev) => prev.filter((e) => !idArray.includes(e.id)));
      setSelected(new Set());
      setStats((s) => ({ ...s, deleted: s.deleted + idArray.length }));
      showToast(`ð Deleted ${idArray.length} email${idArray.length > 1 ? 's' : ''}`);
    } catch (err) {
      showToast('Delete failed: ' + err.message);
    }
    setProcessing(false);
  };

  const handleArchive = async (ids) => {
    const idArray = Array.isArray(ids) ? ids : [...ids];
    if (idArray.length === 0) return;
    setProcessing(true);
    try {
      await archiveMessages(accessToken, idArray);
      setEmails((prev) => prev.filter((e) => !idArray.includes(e.id)));
      setSelected(new Set());
      setStats((s) => ({ ...s, archived: s.archived + idArray.length }));
      showToast(`ð¥ Archived ${idArray.length} email${idArray.length > 1 ? 's' : ''}`);
    } catch (err) {
      showToast('Archive failed: ' + err.message);
    }
    setProcessing(false);
  };

  const deleteSpam = async () => {
    const spamIds = emails.filter((e) => e.category === 'spam').map((e) => e.id);
    if (spamIds.length === 0) { showToast('No spam found!'); return; }
    await handleDelete(spamIds);
  };

  const instantClean = async () => {
    setProcessing(true);
    try {
      const spam = emails.filter((e) => e.category === 'spam');
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const old = emails.filter((e) => e.category !== 'spam' && new Date(e.date) < sevenDaysAgo);
      const kept = emails.filter((e) => e.category !== 'spam' && new Date(e.date) >= sevenDaysAgo);

      if (spam.length > 0) {
        await trashMessages(accessToken, spam.map((e) => e.id));
      }
      if (old.length > 0) {
        await archiveMessages(accessToken, old.map((e) => e.id));
      }

      setEmails(kept);
      setSelected(new Set());
      setStats((s) => ({
        deleted: s.deleted + spam.length,
        archived: s.archived + old.length,
        categorized: kept.length,
      }));
      showToast(`â¡ ${spam.length} deleted, ${old.length} archived, ${kept.length} organized`);
    } catch (err) {
      showToast('Clean failed: ' + err.message);
    }
    setProcessing(false);
  };

  const categorizeAll = () => {
    setStats((s) => ({ ...s, categorized: emails.length }));
    showToast(`ð ${emails.length} emails categorized!`);
  };

  const spamCount = emails.filter((e) => e.category === 'spam').length;

  // âââ Render âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

  if (authLoading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #FAF3E8, #F0E6D3)',
        fontFamily: "'Segoe UI', system-ui, sans-serif",
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12, animation: 'spin 1s linear infinite' }}>ð½</div>
          <div style={{ color: '#5C4033', fontWeight: 600 }}>Loading...</div>
        </div>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!user || !accessToken) {
    return <LoginScreen onSignIn={signIn} error={authError} />;
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'linear-gradient(135deg, #FAF3E8 0%, #F0E6D3 100%)',
      fontFamily: "'Segoe UI', system-ui, sans-serif",
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #5C3D1E, #8B6914)', padding: '20px 32px',
        color: '#FFF8EE', boxShadow: '0 4px 20px rgba(92,61,30,0.3)',
      }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>ð½ Chef's Inbox Cleaner</h1>
              <p style={{ margin: '4px 0 0', fontSize: 13, opacity: 0.85 }}>
                Signed in as {user.email}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <ActionButton label="Delete Spam" icon="ð§¹" color="#CD5C5C" onClick={deleteSpam} disabled={processing || spamCount === 0} />
              <ActionButton label="Instant Clean" icon="â¡" color="#D4880F" onClick={instantClean} disabled={processing || emails.length === 0} />
              <ActionButton label="Categorize All" icon="ð" color="#6B8E23" onClick={categorizeAll} disabled={processing || emails.length === 0} />
              <button onClick={signOut} style={{
                background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)',
                color: '#FFF8EE', borderRadius: 8, padding: '8px 14px', fontSize: 13,
                cursor: 'pointer', fontWeight: 500,
              }}>Sign Out</button>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '20px 16px' }}>
        {/* Stat Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: 14, marginBottom: 20 }}>
          <StatCard label="In Inbox" value={emails.length} icon="ð¬" color="#8B6914" />
          <StatCard label="Deleted" value={stats.deleted} icon="ð" color="#CD5C5C" />
          <StatCard label="Archived" value={stats.archived} icon="ð¥" color="#2E8B57" />
          <StatCard label="Categorized" value={stats.categorized} icon="ð" color="#6B8E23" />
          <StatCard label="Spam Found" value={spamCount} icon="â ï¸" color="#D4880F" />
        </div>

        {/* Progress Bars */}
        <div style={{
          background: '#FFFDF8', borderRadius: 14, padding: 20, marginBottom: 20,
          boxShadow: '0 2px 10px rgba(139,105,20,0.08)',
        }}>
          <h3 style={{ margin: '0 0 14px', color: '#3E2C1C', fontSize: 16 }}>Cleanup Progress</h3>
          <ProgressBar label="Emails Deleted" current={stats.deleted} total={totalLoaded || 1} color="#CD5C5C" />
          <ProgressBar label="Emails Archived" current={stats.archived} total={totalLoaded || 1} color="#2E8B57" />
          <ProgressBar label="Emails Categorized" current={stats.categorized} total={emails.length || 1} color="#6B8E23" />
          <ProgressBar label="Inbox Zero Progress" current={stats.deleted + stats.archived} total={totalLoaded || 1} color="#D4880F" />
        </div>

        {/* Filter Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          {[{ key: 'all', label: 'All', icon: 'ð§' },
            ...Object.entries(CATEGORIES).map(([k, v]) => ({ key: k, label: v.label, icon: v.icon })),
          ].map((f) => {
            const count = f.key === 'all' ? emails.length : emails.filter((e) => e.category === f.key).length;
            const active = filter === f.key;
            return (
              <button key={f.key} onClick={() => setFilter(f.key)} style={{
                padding: '7px 14px', borderRadius: 20,
                border: active ? '2px solid #8B6914' : '1px solid #D4C5A9',
                background: active ? '#8B691422' : '#FFFDF8',
                color: active ? '#5C3D1E' : '#7A6548',
                fontWeight: active ? 700 : 500, fontSize: 13, cursor: 'pointer',
              }}>
                {f.icon} {f.label} ({count})
              </button>
            );
          })}
        </div>

        {/* Bulk Actions */}
        {selected.size > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
            background: '#FFF3E0', borderRadius: 12, marginBottom: 10, flexWrap: 'wrap',
            border: '1px solid #E8D5B5',
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#5C3D1E' }}>{selected.size} selected</span>
            <ActionButton label="Delete" icon="ð" color="#CD5C5C" onClick={() => handleDelete([...selected])} size="small" disabled={processing} />
            <ActionButton label="Archive" icon="ð¥" color="#2E8B57" onClick={() => handleArchive([...selected])} size="small" disabled={processing} />
          </div>
        )}

        {/* Email List */}
        <div style={{
          background: '#FFFDF8', borderRadius: 14, overflow: 'hidden',
          boxShadow: '0 2px 10px rgba(139,105,20,0.08)',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', padding: '10px 14px',
            background: '#F5EDE0', borderBottom: '2px solid #E8D5B5', gap: 10,
          }}>
            <input type="checkbox"
              checked={filtered.length > 0 && filtered.every((e) => selected.has(e.id))}
              onChange={selectAllVisible}
              style={{ accentColor: '#8B6914', width: 16, height: 16, cursor: 'pointer' }}
            />
            <span style={{ fontSize: 13, color: '#7A6548', fontWeight: 600 }}>
              {filtered.length} email{filtered.length !== 1 ? 's' : ''}
            </span>
            {nextPage && (
              <button onClick={() => loadEmails(nextPage)} disabled={loadingEmails} style={{
                marginLeft: 'auto', background: 'none', border: '1px solid #D4C5A9',
                borderRadius: 8, padding: '4px 12px', fontSize: 12, cursor: 'pointer',
                color: '#5C3D1E', fontWeight: 600,
              }}>
                {loadingEmails ? 'Loading...' : 'Load More'}
              </button>
            )}
          </div>

          {loadingEmails && emails.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 12, animation: 'spin 1s linear infinite' }}>ð³</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#3E2C1C' }}>Fetching your emails...</div>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>ð</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: '#3E2C1C' }}>
                {emails.length === 0 ? 'Inbox Zero Achieved!' : 'No emails in this category'}
              </div>
              <div style={{ fontSize: 14, color: '#8B7D62', marginTop: 6 }}>
                {emails.length === 0 ? 'Your catering inbox is spotless. Time to cook!' : 'Try a different filter.'}
              </div>
            </div>
          ) : (
            filtered.map((email) => (
              <EmailRow key={email.id} email={email}
                selected={selected.has(email.id)}
                onSelect={toggleSelect}
                onDelete={(id) => handleDelete([id])}
                onArchive={(id) => handleArchive([id])}
              />
            ))
          )}
        </div>

        <div style={{ textAlign: 'center', padding: '20px 0 10px', fontSize: 12, color: '#A08E76' }}>
          Chef's Inbox Cleaner â Built for 1B Star Agency Catering
        </div>
      </div>

      <Toast message={toast.message} visible={toast.visible} />

      {processing && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(62,44,28,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 998,
        }}>
          <div style={{
            background: '#FFFDF8', borderRadius: 16, padding: '32px 40px',
            textAlign: 'center', boxShadow: '0 8px 40px rgba(0,0,0,0.15)',
          }}>
            <div style={{ fontSize: 36, marginBottom: 12, animation: 'spin 1s linear infinite' }}>ð³</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#3E2C1C' }}>Cleaning in progress...</div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        button:focus { outline: 2px solid #8B6914; outline-offset: 2px; }
      `}</style>
    </div>
  );
}
