import { useEffect, useMemo, useState } from 'react';

import PageHeader from '../components/PageHeader.jsx';

const FB_PAGE_ID = '1424151444262464';
const FB_ACCESS_TOKEN =
  'EAATZAeMV0gKABSD2TSdAbYEmuMZBzwLaBSMN4D1i2JZA12LVzoIHpCvTMKzxOo7J0LZB6gZApT2WBxbuv38fFkK55TTEo1t2gZCBfLFi0h6mJNkVG7V0QC48VZB53kZAegTCusdFVjHHRS5ACk9NnW5rdin42BVP0BlDJmYXlKBCY86ZBBdRvrw4pfCRC1G7XBLBinTPsqZBjF';
// Fetch up to 20 posts so the bottom carousel pagination has multiple pages when content is available
const API_URL = `https://graph.facebook.com/v19.0/${FB_PAGE_ID}/posts?fields=message,created_time,full_picture,permalink_url,story&limit=20&access_token=${FB_ACCESS_TOKEN}`;

const FALLBACK_IMG = `${import.meta.env.BASE_URL}assets/images/cdrrmd-logo.jpg`;

function formatPostDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Automatically detect a clean category badge & extract a readable title + body from the Facebook message
function parsePostContent(post) {
  const raw = (post.message || post.story || 'View update on Facebook').trim();
  const upper = raw.toUpperCase();

  let category = 'Advisory';
  let dotColor = '#2563eb';
  if (upper.includes('HEAT INDEX')) {
    category = 'Heat Index';
    dotColor = '#ea580c';
  } else if (upper.includes('THUNDERSTORM')) {
    category = 'Thunderstorm';
    dotColor = '#d97706';
  } else if (upper.includes('WEATHER')) {
    category = 'Weather Update';
    dotColor = '#0284c7';
  } else if (upper.includes('ATM') || upper.includes('ACTIVITY') || upper.includes('USAR')) {
    category = 'Operations';
    dotColor = '#16a34a';
  }

  const lines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  let title = lines[0] || 'CDRRMD Advisory';
  let body = lines.slice(1).join(' ');

  // If the first line is just a timestamp header (e.g. "14 OCTOBER 2026 WEDNESDAY 2:00 PM"),
  // combine or promote the second line as the main headline.
  if (lines.length > 1 && /^\d{1,2}\s+[A-Z]+\s+\d{4}/i.test(lines[0])) {
    title = lines[1];
    body = lines.slice(2).join(' ') || lines[0];
  }

  if (!body) {
    body = raw;
  }

  return { category, dotColor, title, body };
}

export default function News({ onToggleSidebar }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  const CARDS_PER_PAGE = 3;

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

  // Split posts into:
  // 1) Featured Hero Post (posts[0])
  // 2) Latest Posts right-hand list (posts[1..4])
  // 3) Paginated bottom carousel grid (posts[5..]) — or if total posts <= 5, paginate all remaining posts
  const heroPost = posts[0] || null;
  const sidePosts = useMemo(() => posts.slice(1, 5), [posts]);
  const carouselPool = useMemo(
    () => (posts.length > 5 ? posts.slice(5) : posts.slice(1)),
    [posts]
  );

  const totalPages = Math.max(1, Math.ceil(carouselPool.length / CARDS_PER_PAGE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  const currentCarouselPosts = useMemo(() => {
    const start = (currentPage - 1) * CARDS_PER_PAGE;
    return carouselPool.slice(start, start + CARDS_PER_PAGE);
  }, [carouselPool, currentPage]);

  const goPrev = () => setCurrentPage((p) => Math.max(1, p - 1));
  const goNext = () => setCurrentPage((p) => Math.min(totalPages, p + 1));

  return (
    <div className="container">
      {/* Scoped Editorial Layout Styles matching the attached reference */}
      <style>{`
        .news-editorial-wrapper {
          background-color: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          padding: 28px;
          box-shadow: 0 4px 20px rgba(15, 23, 42, 0.04);
        }

        /* Top Section: Hero (Left) + Latest Post List (Right) */
        .news-top-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.55fr) minmax(300px, 1fr);
          gap: 28px;
          align-items: stretch;
          padding-bottom: 28px;
          border-bottom: 1px solid #f1f5f9;
        }

        .news-hero-card {
          position: relative;
          border-radius: 18px;
          overflow: hidden;
          min-height: 410px;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          text-decoration: none;
          color: #ffffff;
          background-color: #0f172a;
          box-shadow: 0 10px 25px rgba(15, 23, 42, 0.1);
          group: hero;
        }

        .news-hero-img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .news-hero-card:hover .news-hero-img {
          transform: scale(1.03);
        }

        .news-hero-overlay {
          position: relative;
          z-index: 1;
          padding: 28px 26px 24px 26px;
          background: linear-gradient(
            to top,
            rgba(15, 23, 42, 0.92) 0%,
            rgba(15, 23, 42, 0.68) 55%,
            rgba(15, 23, 42, 0) 100%
          );
          backdrop-filter: blur(2px);
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .news-category-pill {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          align-self: flex-start;
          background-color: #ffffff;
          color: #1e293b;
          font-size: 0.74rem;
          font-weight: 700;
          padding: 5px 12px;
          border-radius: 999px;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
        }

        .news-category-pill.subtle {
          background-color: #f8fafc;
          border: 1px solid #e2e8f0;
          box-shadow: none;
        }

        .news-category-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .news-hero-title {
          margin: 0;
          font-size: 1.45rem;
          font-weight: 700;
          line-height: 1.3;
          color: #ffffff;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .news-hero-desc {
          margin: 0;
          font-size: 0.88rem;
          line-height: 1.5;
          color: rgba(255, 255, 255, 0.84);
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .news-meta-line {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.76rem;
          color: rgba(255, 255, 255, 0.75);
          font-weight: 500;
          margin-top: 2px;
        }

        /* Right Side: Latest Post List */
        .news-latest-col {
          display: flex;
          flex-direction: column;
        }

        .news-section-heading {
          margin: 0 0 16px 0;
          font-size: 1.2rem;
          font-weight: 700;
          color: #0f172a;
          letter-spacing: -0.01em;
        }

        .news-latest-list {
          display: flex;
          flex-direction: column;
          gap: 14px;
          flex: 1;
          justify-content: space-between;
        }

        .news-latest-item {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 8px;
          border-radius: 14px;
          text-decoration: none;
          color: inherit;
          transition: background-color 0.15s ease, transform 0.15s ease;
        }

        .news-latest-item:hover {
          background-color: #f8fafc;
          transform: translateX(2px);
        }

        .news-latest-thumb {
          width: 74px;
          height: 74px;
          border-radius: 12px;
          object-fit: cover;
          flex-shrink: 0;
          background-color: #f1f5f9;
          border: 1px solid #e2e8f0;
        }

        .news-latest-info {
          display: flex;
          flex-direction: column;
          gap: 5px;
          min-width: 0;
        }

        .news-latest-title {
          margin: 0;
          font-size: 0.9rem;
          font-weight: 700;
          color: #0f172a;
          line-height: 1.35;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .news-latest-meta {
          font-size: 0.75rem;
          color: #64748b;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        /* Bottom Section: 3-Column Card Grid + Carousel Controls */
        .news-bottom-section {
          padding-top: 26px;
        }

        .news-bottom-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 18px;
        }

        .news-nav-arrows {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .news-circle-arrow {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: 1px solid #e2e8f0;
          background-color: #ffffff;
          color: #334155;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
          font-size: 0.82rem;
        }

        .news-circle-arrow:hover:not(:disabled) {
          background-color: #f8fafc;
          border-color: #cbd5e1;
          color: #0f172a;
        }

        .news-circle-arrow:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .news-cards-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 20px;
        }

        .news-grid-card {
          background-color: #f8fafc;
          border: 1px solid #f1f5f9;
          border-radius: 16px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          text-decoration: none;
          color: inherit;
          transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
        }

        .news-grid-card:hover {
          transform: translateY(-3px);
          background-color: #ffffff;
          border-color: #e2e8f0;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
        }

        .news-grid-card-img {
          width: 100%;
          height: 175px;
          border-radius: 12px;
          object-fit: cover;
          background-color: #e2e8f0;
          margin-bottom: 14px;
        }

        .news-grid-card-body {
          padding: 4px 6px 6px 6px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          flex: 1;
        }

        .news-grid-card-title {
          margin: 2px 0 0 0;
          font-size: 1rem;
          font-weight: 700;
          color: #0f172a;
          line-height: 1.35;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .news-grid-card-text {
          margin: 0;
          font-size: 0.83rem;
          color: #64748b;
          line-height: 1.5;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .news-grid-card-footer {
          margin-top: auto;
          padding-top: 8px;
          font-size: 0.75rem;
          color: #94a3b8;
          font-weight: 500;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        /* Bottom Carousel Paging Bar (Matches Reference Bottom Bar) */
        .news-pagination-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 28px;
          padding-top: 18px;
          border-top: 1px solid #f1f5f9;
        }

        .news-page-numbers {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .news-page-num {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: none;
          background: transparent;
          color: #64748b;
          font-size: 0.82rem;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .news-page-num:hover {
          background-color: #f1f5f9;
          color: #0f172a;
        }

        .news-page-num.active {
          background-color: #1e293b;
          color: #ffffff;
          box-shadow: 0 2px 8px rgba(15, 23, 42, 0.2);
        }

        @media (max-width: 1024px) {
          .news-top-grid {
            grid-template-columns: 1fr;
          }
          .news-cards-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 640px) {
          .news-editorial-wrapper {
            padding: 18px;
          }
          .news-hero-card {
            min-height: 320px;
          }
          .news-cards-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <PageHeader title="News & Updates" onToggleSidebar={onToggleSidebar} />
      <p style={{ color: '#64748b', margin: '0 0 25px 0', fontSize: '0.95rem' }}>
        Live announcements, advisories, and updates from the official CDRRMD - Butuan Facebook Page.
      </p>

      <div className="news-editorial-wrapper">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 50, color: '#64748b' }}>
            <i className="fa-solid fa-circle-notch fa-spin" style={{ marginRight: 8 }} />
            Fetching live posts from Facebook...
          </div>
        ) : error ? (
          <div
            style={{
              textAlign: 'center',
              color: '#ef4444',
              background: '#fef2f2',
              padding: 24,
              borderRadius: 12,
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
          <div style={{ textAlign: 'center', padding: 40, color: '#64748b' }}>
            No recent posts found on the page.
          </div>
        ) : (
          <>
            {/* TOP EDITORIAL SECTION: Hero Card + Latest Posts List */}
            <div className="news-top-grid">
              {heroPost && (() => {
                const parsed = parsePostContent(heroPost);
                const img = heroPost.full_picture || FALLBACK_IMG;
                return (
                  <a
                    href={heroPost.permalink_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="news-hero-card"
                  >
                    <img
                      src={img}
                      alt="Featured Advisory"
                      className="news-hero-img"
                      loading="lazy"
                    />
                    <div className="news-hero-overlay">
                      <span className="news-category-pill">
                        <span
                          className="news-category-dot"
                          style={{ backgroundColor: parsed.dotColor }}
                        />
                        {parsed.category}
                      </span>
                      <h3 className="news-hero-title">{parsed.title}</h3>
                      <p className="news-hero-desc">{parsed.body}</p>
                      <div className="news-meta-line">
                        <i className="fa-brands fa-facebook" />
                        <span>{formatPostDate(heroPost.created_time)}</span>
                        <span>•</span>
                        <span>Read on Facebook</span>
                      </div>
                    </div>
                  </a>
                );
              })()}

              <div className="news-latest-col">
                <h3 className="news-section-heading">Latest post</h3>
                <div className="news-latest-list">
                  {sidePosts.map((post, idx) => {
                    const parsed = parsePostContent(post);
                    const img = post.full_picture || FALLBACK_IMG;
                    return (
                      <a
                        key={post.id || idx}
                        href={post.permalink_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="news-latest-item"
                      >
                        <img
                          src={img}
                          alt="Post thumbnail"
                          className="news-latest-thumb"
                          loading="lazy"
                        />
                        <div className="news-latest-info">
                          <h4 className="news-latest-title">{parsed.title}</h4>
                          <div className="news-latest-meta">
                            <span>{formatPostDate(post.created_time)}</span>
                            <span>•</span>
                            <span style={{ color: parsed.dotColor, fontWeight: 600 }}>
                              {parsed.category}
                            </span>
                          </div>
                        </div>
                      </a>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* BOTTOM CAROUSEL SECTION: 3-Card Row + Pagination */}
            {carouselPool.length > 0 && (
              <div className="news-bottom-section">
                <div className="news-bottom-header">
                  <h3 className="news-section-heading" style={{ margin: 0 }}>
                    More Advisories & Updates
                  </h3>
                  <div className="news-nav-arrows">
                    <button
                      type="button"
                      className="news-circle-arrow"
                      onClick={goPrev}
                      disabled={currentPage === 1}
                      aria-label="Previous page"
                    >
                      <i className="fa-solid fa-arrow-left" />
                    </button>
                    <button
                      type="button"
                      className="news-circle-arrow"
                      onClick={goNext}
                      disabled={currentPage === totalPages}
                      aria-label="Next page"
                    >
                      <i className="fa-solid fa-arrow-right" />
                    </button>
                  </div>
                </div>

                <div className="news-cards-grid">
                  {currentCarouselPosts.map((post, idx) => {
                    const parsed = parsePostContent(post);
                    const img = post.full_picture || FALLBACK_IMG;
                    return (
                      <a
                        key={post.id || idx}
                        href={post.permalink_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="news-grid-card"
                      >
                        <img
                          src={img}
                          alt="Advisory"
                          className="news-grid-card-img"
                          loading="lazy"
                        />
                        <div className="news-grid-card-body">
                          <span className="news-category-pill subtle">
                            <span
                              className="news-category-dot"
                              style={{ backgroundColor: parsed.dotColor }}
                            />
                            {parsed.category}
                          </span>
                          <h4 className="news-grid-card-title">{parsed.title}</h4>
                          <p className="news-grid-card-text">{parsed.body}</p>
                          <div className="news-grid-card-footer">
                            <span>
                              <i
                                className="fa-brands fa-facebook"
                                style={{ color: '#1877F2', marginRight: 5 }}
                              />
                              {formatPostDate(post.created_time)}
                            </span>
                            <span style={{ color: '#2563eb', fontWeight: 600 }}>
                              Open →
                            </span>
                          </div>
                        </div>
                      </a>
                    );
                  })}
                </div>

                {/* Bottom Carousel Paging Bar */}
                {totalPages > 1 && (
                  <div className="news-pagination-bar">
                    <button
                      type="button"
                      className="news-circle-arrow"
                      onClick={goPrev}
                      disabled={currentPage === 1}
                      aria-label="Previous page"
                    >
                      <i className="fa-solid fa-arrow-left" />
                    </button>

                    <div className="news-page-numbers">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                        (page) => (
                          <button
                            key={page}
                            type="button"
                            className={`news-page-num ${
                              currentPage === page ? 'active' : ''
                            }`}
                            onClick={() => setCurrentPage(page)}
                          >
                            {page}
                          </button>
                        )
                      )}
                    </div>

                    <button
                      type="button"
                      className="news-circle-arrow"
                      onClick={goNext}
                      disabled={currentPage === totalPages}
                      aria-label="Next page"
                    >
                      <i className="fa-solid fa-arrow-right" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}