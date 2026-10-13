import { useEffect, useState } from 'react';

import PageHeader from '../components/PageHeader.jsx';

const FB_PAGE_ID = '1424151444262464';
const FB_ACCESS_TOKEN =
  'EAATZAeMV0gKABSD2TSdAbYEmuMZBzwLaBSMN4D1i2JZA12LVzoIHpCvTMKzxOo7J0LZB6gZApT2WBxbuv38fFkK55TTEo1t2gZCBfLFi0h6mJNkVG7V0QC48VZB53kZAegTCusdFVjHHRS5ACk9NnW5rdin42BVP0BlDJmYXlKBCY86ZBBdRvrw4pfCRC1G7XBLBinTPsqZBjF';
const API_URL = `https://graph.facebook.com/v19.0/${FB_PAGE_ID}/posts?fields=message,created_time,full_picture,permalink_url,story&limit=9&access_token=${FB_ACCESS_TOKEN}`;

// BENTO box assignment rules — exactly the same as js/news.js.
function bentoClassFor(index, hasImage) {
  if (index === 0 && hasImage) return 'bento-hero';
  if (index === 0 && !hasImage) return 'bento-wide';
  if (index === 3 && hasImage) return 'bento-tall';
  if (index === 6 && hasImage) return 'bento-wide';
  return '';
}

function formatPostDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// News & updates: bento-grid Facebook feed. Mirrors js/news.js.
export default function News({ onToggleSidebar }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchFeed() {
      try {
        const response = await fetch(API_URL);
        const json = await response.json();
        if (json.error) throw new Error(json.error.message);
        if (!cancelled) {
          setPosts(json.data || []);
          setLoading(false);
        }
      } catch (err) {
        console.error('Facebook API Error:', err);
        if (!cancelled) {
          setError(err);
          setLoading(false);
        }
      }
    }

    fetchFeed();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="container">
      <PageHeader title="News & Updates" onToggleSidebar={onToggleSidebar} />
      <p style={{ color: '#64748b', margin: '0 0 25px 0', fontSize: '0.95rem' }}>
        Live announcements, advisories, and updates from the official CDRRMD - Butuan Facebook Page.
      </p>

      <div className="card news-panel">
        {loading ? (
          <div
            className="news-feed-grid"
            style={{ display: 'grid' }}
          >
            <div
              className="news-loading"
              style={{
                gridColumn: '1 / -1',
                textAlign: 'center',
                padding: 40,
                color: '#64748b',
              }}
            >
              <i className="fa-solid fa-circle-notch fa-spin" /> Fetching live posts from Facebook...
            </div>
          </div>
        ) : error ? (
          <div
            style={{
              gridColumn: '1 / -1',
              textAlign: 'center',
              color: '#ef4444',
              background: '#fef2f2',
              padding: 20,
              borderRadius: 8,
              border: '1px solid #fecaca',
            }}
          >
            <i
              className="fa-solid fa-triangle-exclamation"
              style={{ marginBottom: 10, fontSize: 24 }}
            />
            <br />
            <b>Unable to load news feed.</b>
            <br />
            <small>{error.message}</small>
          </div>
        ) : posts.length === 0 ? (
          <div className="news-loading">No recent posts found on the page.</div>
        ) : (
          <div id="fb-feed-container" className="news-feed-grid">
            {posts.map((post, index) => {
              const text = post.message || post.story || 'View update on Facebook';
              const imageUrl = post.full_picture;
              const bentoClass = bentoClassFor(index, !!imageUrl);
              const iconColor =
                bentoClass === 'bento-hero' ? { color: '#ffffff' } : { color: '#1877F2' };

              return (
                <div className={`fb-post-card ${bentoClass}`} key={post.id || index}>
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt="News Image"
                      className="fb-post-img"
                      loading="lazy"
                    />
                  ) : null}
                  <div className="fb-post-content">
                    <div className="fb-post-date">
                      <i className="fa-brands fa-facebook" style={iconColor} />{' '}
                      {formatPostDate(post.created_time)}
                    </div>
                    <p className="fb-post-message">{text}</p>
                    <a
                      href={post.permalink_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="fb-post-link"
                    >
                      Read on Facebook
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
