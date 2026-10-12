import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Search, Sparkles, Book, HardDrive } from '@/lib/icon-map';
import EnhancedMarkdownPreview from '@/components/EnhancedMarkdownPreview';
import { useIsMobile } from '@/hooks/use-mobile';
import MobileScrollToTop from '@/components/MobileScrollToTop';
import {
  docArticles,
  docCategories,
  getArticleBySlug,
  getArticlesByCategory,
} from './docs';
import {
  AppShell, TopBar, Wrap, PageHead, Pill, Kbd, Empty, Ico, UnderlineTabs,
  btn, useDocTitle, useSearchShortcut,
} from '@/components/custom/squid-app';

/* ═══════════════════════════════════════════════════════════════
   DOCUMENTATION
   A reading tool, not a card grid. Left: persistent navigation that
   keeps your place. Centre: the article at a comfortable measure.
   Right: a live table of contents with scroll-spy. Bottom: previous
   and next. Press / anywhere to search; Enter opens the top hit.
   Data, routes and filtering are unchanged.
   Place at: src/pages/help/Documentation.tsx   (next to ./docs)
   ═══════════════════════════════════════════════════════════════ */

type Article = (typeof docArticles)[number];
type Category = (typeof docCategories)[number];
type NavGroup = { cat: Category; articles: Article[] };
type TocItem = { id: string; text: string; level: 2 | 3 };

const DOC_CSS = `
.dc { display: grid; grid-template-columns: 252px minmax(0, 1fr); gap: 48px; align-items: start; }
.dc.art { grid-template-columns: 252px minmax(0, 1fr) 208px; }
.dc-side { position: sticky; top: 64px; max-height: calc(100vh / var(--sa-zoom, 1) - 80px); overflow-y: auto; padding: 0 8px 24px 0; margin-right: -8px; }
.dc-side .sa-nav, .dc-drawer .sa-nav { gap: 2px; }
.dc-side .sa-nav-i, .dc-drawer .sa-nav-i { min-height: 32px; padding-top: 6px; padding-bottom: 6px; }
.dc-side .sa-field-wrap { margin-bottom: 18px; }
.dc-main { min-width: 0; }
.dc-mobile { display: none; }
.dc-mob-btn { display: none; }
.dc-toc { position: sticky; top: 72px; font-size: 12.5px; }
.dc-toc h4 { margin: 0 0 12px; font: 400 10.5px/1 var(--sa-mono); letter-spacing: 0.12em; text-transform: uppercase; color: var(--sa-mute); }
.dc-toc a { display: block; padding: 5px 0 5px 12px; border-left: 1px solid var(--sa-line); color: var(--sa-mute); text-decoration: none; line-height: 1.4; transition: color 0.15s, border-color 0.15s; }
.dc-toc a:hover { color: var(--sa-text); }
.dc-toc a.on { color: var(--sa-text); border-left-color: var(--sa-text); }
.dc-toc a.l3 { padding-left: 24px; }
@media (max-width: 1180px) { .dc.art { grid-template-columns: 252px minmax(0, 1fr); } .dc-toc { display: none; } }
@media (max-width: 1100px) {
  .dc, .dc.art { grid-template-columns: minmax(0, 1fr); gap: 20px; }
  .dc-side { display: none; }
  .dc-mobile { display: block; }
  .dc-mob-btn { display: inline-flex; }
}
.dc-drawer { position: fixed; inset: 48px 0 0 0; z-index: 35; overflow-y: auto; padding: 16px var(--sa-gut) 96px; background: var(--sa-bg); }
.dc-feat { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-bottom: 32px; }
@media (max-width: 720px) { .dc-feat { grid-template-columns: 1fr; } }
.dc-tile { display: grid; grid-template-columns: 34px minmax(0, 1fr) auto; gap: 14px; align-items: center; padding: 14px 16px; border: 1px solid var(--sa-line); border-radius: 5px; background: var(--sa-bg-2); text-decoration: none; transition: border-color 0.15s, background 0.15s; }
.dc-tile:hover { border-color: var(--sa-dim); background: var(--sa-bg-3); }
.dc-tile .i { display: grid; place-items: center; width: 34px; height: 34px; border: 1px solid var(--sa-line-2); border-radius: 4px; color: var(--sa-text); }
.dc-tile .t { display: flex; align-items: center; gap: 8px; font: 500 13.5px/1.3 var(--sa-f); color: var(--sa-text); }
.dc-tile .d { margin-top: 3px; font-size: 12.5px; line-height: 1.45; color: var(--sa-mute); }
.dc-tile .go { color: var(--sa-mute); transition: transform 0.2s var(--sa-ease), color 0.15s; }
.dc-tile:hover .go { color: var(--sa-text); transform: translateX(2px); }
.dc-cat { margin-bottom: 36px; scroll-margin-top: 72px; animation: sa-in 0.22s var(--sa-ease) both; }
.dc-cat-h { display: flex; align-items: baseline; gap: 10px; margin-bottom: 4px; }
.dc-cat-h h2 { margin: 0; font: 500 15px/1.3 var(--sa-f); letter-spacing: -0.01em; }
.dc-cat-h .n { font: 400 11px/1 var(--sa-mono); color: var(--sa-mute); }
.dc-cat-d { margin: 0 0 12px; font-size: 13px; color: var(--sa-mute); }
.dl { border: 1px solid var(--sa-line); border-radius: 5px; background: var(--sa-bg-2); overflow: hidden; }
.dl-row { display: grid; grid-template-columns: 20px minmax(0, 1fr) auto; gap: 14px; align-items: start; padding: 13px 16px; text-decoration: none; transition: background 0.12s; }
.dl-row + .dl-row { border-top: 1px solid var(--sa-line); }
.dl-row:hover { background: var(--sa-bg-3); }
.dl-row > svg { margin-top: 2px; color: var(--sa-mute); }
.dl-row .t { font: 500 13.5px/1.35 var(--sa-f); color: var(--sa-text); }
.dl-row .d { margin-top: 3px; font-size: 12.5px; line-height: 1.5; color: var(--sa-mute); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.dl-row .tg { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; max-width: 240px; }
.dl-row .tg span { font: 400 10.5px/1 var(--sa-mono); letter-spacing: 0.04em; color: var(--sa-mute); }
@media (max-width: 720px) { .dl-row { grid-template-columns: 20px minmax(0, 1fr); } .dl-row .tg { display: none; } }
.doc-head { display: flex; gap: 16px; align-items: flex-start; padding-bottom: 22px; margin-bottom: 28px; border-bottom: 1px solid var(--sa-line); }
.doc-head .i { display: grid; place-items: center; width: 40px; height: 40px; flex: none; border: 1px solid var(--sa-line-2); border-radius: 5px; color: var(--sa-text); }
.doc-head .tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 16px; }
.doc-body { max-width: 760px; min-width: 0; font-size: 15px; line-height: 1.75; color: var(--sa-text-2); overflow-wrap: break-word; }
.doc-body pre { max-width: 100%; overflow-x: auto; }
.doc-body :is(h1, h2, h3, h4) { scroll-margin-top: 72px; color: var(--sa-text); }
.doc-pn { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; max-width: 760px; margin-top: 56px; padding-top: 24px; border-top: 1px solid var(--sa-line); }
.doc-pn a { display: block; min-width: 0; padding: 14px 16px; border: 1px solid var(--sa-line); border-radius: 5px; text-decoration: none; transition: border-color 0.15s, background 0.15s; }
.doc-pn a:hover { border-color: var(--sa-dim); background: var(--sa-bg-2); }
.doc-pn small { display: block; font: 400 10.5px/1 var(--sa-mono); letter-spacing: 0.12em; text-transform: uppercase; color: var(--sa-mute); }
.doc-pn span { display: block; margin-top: 8px; font: 500 13.5px/1.35 var(--sa-f); color: var(--sa-text); }
.doc-pn .nx { text-align: right; grid-column: 2; }
.dc-count { display: flex; align-items: center; gap: 8px; margin: 16px 0 24px; font-size: 12.5px; color: var(--sa-mute); }
`;

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');

function DocNav({
  groups,
  active,
  onNavigate,
}: {
  groups: NavGroup[];
  active?: string;
  onNavigate?: () => void;
}) {
  if (groups.length === 0) {
    return <p className="sa-hint" style={{ padding: '0 10px' }}>No articles match.</p>;
  }
  return (
    <nav className="sa-nav" aria-label="Documentation">
      <Link to="/help/docs" onClick={onNavigate} className={`sa-nav-i${!active ? ' on' : ''}`} aria-current={!active ? 'page' : undefined}>
        <Book className="h-3.5 w-3.5" /> Overview
      </Link>
      {groups.map(({ cat, articles }) => {
        const CatIcon = cat.icon;
        return (
          <Fragment key={cat.id}>
            <div className="sa-nav-h" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CatIcon className="h-3 w-3" /> {cat.title}
            </div>
            {articles.map((a) => (
              <Link
                key={a.id}
                to={`/help/docs/${a.id}`}
                onClick={onNavigate}
                className={`sa-nav-i${active === a.id ? ' on' : ''}`}
                aria-current={active === a.id ? 'page' : undefined}
                data-active={active === a.id ? 'true' : undefined}
              >
                {a.title}
              </Link>
            ))}
          </Fragment>
        );
      })}
    </nav>
  );
}

const Documentation = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [currentDoc, setCurrentDoc] = useState<ReturnType<typeof getArticleBySlug> | null>(null);

  useEffect(() => {
    if (slug) {
      setCurrentDoc(getArticleBySlug(slug) || null);
    } else {
      setCurrentDoc(null);
    }
  }, [slug]);

  const filteredArticles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return docArticles.filter((doc) => {
      const matchesSearch =
        q === '' ||
        doc.title.toLowerCase().includes(q) ||
        doc.description.toLowerCase().includes(q) ||
        doc.tags.some((tag) => tag.toLowerCase().includes(q));
      const matchesCategory = selectedCategory === 'all' || doc.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);

  const visibleCategories = useMemo(() => {
    const ids = new Set(filteredArticles.map((a) => a.category));
    return docCategories.filter((c) => ids.has(c.id));
  }, [filteredArticles]);

  /* ── workbench additions: search focus, nav, TOC, prev/next ── */
  const searchRef = useRef<HTMLInputElement>(null);
  useSearchShortcut(searchRef);
  const [navOpen, setNavOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [toc, setToc] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState('');

  useDocTitle(currentDoc ? currentDoc.title : 'Documentation');

  const navGroups = useMemo<NavGroup[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    const match = (d: Article) =>
      q === '' ||
      d.title.toLowerCase().includes(q) ||
      d.description.toLowerCase().includes(q) ||
      d.tags.some((tag) => tag.toLowerCase().includes(q));
    return docCategories
      .map((cat) => ({ cat, articles: getArticlesByCategory(cat.id).filter(match) }))
      .filter((g) => g.articles.length > 0);
  }, [searchQuery]);

  const ordered = useMemo(() => docCategories.flatMap((c) => getArticlesByCategory(c.id)), []);
  const idx = currentDoc ? ordered.findIndex((a) => a.id === currentDoc.id) : -1;
  const prevDoc = idx > 0 ? ordered[idx - 1] : null;
  const nextDoc = idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1] : null;
  const currentCat = currentDoc ? docCategories.find((c) => c.id === currentDoc.category) : undefined;

  // new article → top of page
  useEffect(() => {
    window.scrollTo(0, 0);
    setNavOpen(false);
  }, [slug]);

  // keep the active nav item visible in the sidebar
  useEffect(() => {
    document.querySelector('.dc-side [data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [slug]);

  // Escape closes the mobile nav
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setNavOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navOpen]);

  // Table of contents is read from the rendered headings so it always
  // matches what is on screen, whatever the markdown renderer does.
  useEffect(() => {
    setToc([]);
    setActiveId('');
    const root = contentRef.current;
    if (!root || !currentDoc) return;
    let raf = 0;
    const build = () => {
      const used = new Set<string>();
      const items: TocItem[] = [];
      root.querySelectorAll<HTMLElement>('h2, h3').forEach((h) => {
        const text = (h.textContent || '').trim();
        if (!text) return;
        let id = h.id || slugify(text) || 'section';
        if (used.has(id)) {
          let n = 2;
          while (used.has(`${id}-${n}`)) n += 1;
          id = `${id}-${n}`;
        }
        used.add(id);
        h.id = id;
        items.push({ id, text, level: h.tagName === 'H2' ? 2 : 3 });
      });
      setToc((prev) => (JSON.stringify(prev) === JSON.stringify(items) ? prev : items));
    };
    build();
    const mo = new MutationObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(build);
    });
    mo.observe(root, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [currentDoc]);

  // scroll-spy
  useEffect(() => {
    if (toc.length === 0) return;
    const els = toc.map((t) => document.getElementById(t.id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActiveId(vis[0].target.id);
      },
      { rootMargin: '-64px 0px -70% 0px', threshold: 0 },
    );
    els.forEach((e) => io.observe(e));
    const h = window.location.hash.replace('#', '');
    if (h) document.getElementById(h)?.scrollIntoView();
    return () => io.disconnect();
  }, [toc]);

  const goToHeading = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
    window.history.replaceState(window.history.state, '', `#${id}`);
    setActiveId(id);
  };

  const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim() && filteredArticles[0]) {
      navigate(`/help/docs/${filteredArticles[0].id}`);
    } else if (e.key === 'Escape') {
      setSearchQuery('');
      e.currentTarget.blur();
    }
  };

  const searchField = (ref?: React.RefObject<HTMLInputElement>, placeholder = 'Search docs') => (
    <div className="sa-field-wrap">
      <Search className="h-3.5 w-3.5" />
      <input
        ref={ref}
        type="search"
        className={`sa-input pl${searchQuery ? '' : ' pr'}`}
        placeholder={placeholder}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onKeyDown={onSearchKey}
        aria-label="Search documentation"
        autoComplete="off"
        spellCheck={false}
      />
      {!searchQuery && <span className="end" aria-hidden="true"><Kbd>/</Kbd></span>}
    </div>
  );

  const topBar = (
    <TopBar
      crumbs={[
        { label: 'Docs', to: '/help/docs' },
        ...(currentDoc && currentCat ? [{ label: currentCat.title }] : []),
        ...(currentDoc ? [{ label: currentDoc.title }] : []),
      ]}
    >
      <button type="button" className={btn('ghost', 'sm') + ' dc-mob-btn'} onClick={() => setNavOpen((v) => !v)} aria-expanded={navOpen}>
        {navOpen ? <Ico.Close size={13} /> : <Ico.Menu size={13} />} Browse
      </button>
      <Link to="/dashboard" className={btn('ghost', 'sm')}>Dashboard</Link>
    </TopBar>
  );

  const drawer = navOpen && (
    <div className="dc-drawer sa-in" role="dialog" aria-label="Browse documentation">
      <div style={{ marginBottom: 16 }}>{searchField(undefined, 'Search documentation')}</div>
      <DocNav groups={navGroups} active={slug} onNavigate={() => setNavOpen(false)} />
    </div>
  );

  /* ───────── Article ───────── */
  if (currentDoc) {
    const Icon = currentDoc.icon;
    return (
      <AppShell>
        <style>{DOC_CSS}</style>
        {isMobile && <MobileScrollToTop />}
        {topBar}
        {drawer}
        <Wrap width="wide">
          <div className="dc art">
            <aside className="dc-side" aria-label="Documentation navigation">
              {searchField(searchRef)}
              <DocNav groups={navGroups} active={slug} />
            </aside>

            <article className="dc-main">
              <header className="doc-head">
                <div className="i"><Icon className="h-5 w-5" /></div>
                <div style={{ minWidth: 0 }}>
                  <h1 className="sa-title">{currentDoc.title}</h1>
                  <p className="sa-desc">{currentDoc.description}</p>
                  <div className="tags">
                    {currentDoc.tags.map((tag) => (
                      <Pill key={tag}>{tag}</Pill>
                    ))}
                    {currentDoc.updated && <Pill tone="info">Updated {currentDoc.updated}</Pill>}
                  </div>
                </div>
              </header>

              <div className="doc-body" ref={contentRef}>
                <EnhancedMarkdownPreview content={currentDoc.content} />
              </div>

              {(prevDoc || nextDoc) && (
                <nav className="doc-pn" aria-label="Previous and next article">
                  {prevDoc ? (
                    <Link to={`/help/docs/${prevDoc.id}`}>
                      <small>← Previous</small>
                      <span>{prevDoc.title}</span>
                    </Link>
                  ) : <span />}
                  {nextDoc && (
                    <Link to={`/help/docs/${nextDoc.id}`} className="nx">
                      <small>Next →</small>
                      <span>{nextDoc.title}</span>
                    </Link>
                  )}
                </nav>
              )}
            </article>

            <aside className="dc-toc" aria-label="On this page">
              {toc.length > 0 && (
                <>
                  <h4>On this page</h4>
                  {toc.map((t) => (
                    <a
                      key={t.id}
                      href={`#${t.id}`}
                      className={`${t.level === 3 ? 'l3 ' : ''}${activeId === t.id ? 'on' : ''}`}
                      onClick={(e) => goToHeading(e, t.id)}
                      aria-current={activeId === t.id ? 'location' : undefined}
                    >
                      {t.text}
                    </a>
                  ))}
                </>
              )}
            </aside>
          </div>
        </Wrap>
      </AppShell>
    );
  }

  /* ───────── Not found ───────── */
  if (slug && getArticleBySlug(slug) === undefined) {
    return (
      <AppShell>
        <style>{DOC_CSS}</style>
        {topBar}
        <Wrap width="narrow">
          <Empty
            icon={<Search className="h-4 w-4" />}
            title="Article not found"
            body={`There is no article called "${slug}". It may have been renamed or moved.`}
            action={<Link to="/help/docs" className={btn('primary')}>Browse all docs</Link>}
          />
        </Wrap>
      </AppShell>
    );
  }

  /* ───────── Index ───────── */
  return (
    <AppShell>
      <style>{DOC_CSS}</style>
      {isMobile && <MobileScrollToTop />}
      {topBar}
      {drawer}
      <Wrap width="wide">
        <div className="dc">
          <aside className="dc-side" aria-label="Documentation navigation">
            {searchField(searchRef)}
            <DocNav groups={navGroups} active={undefined} />
          </aside>

          <div className="dc-main">
            <PageHead
              eyebrow="Documentation"
              title="SquidCloud Documentation"
              desc="Comprehensive guides, API references, and architecture documentation"
            />

            <div className="dc-mobile" style={{ marginBottom: 20 }}>{searchField(undefined, 'Search documentation...')}</div>

            <div className="dc-feat">
              <Link to="/help/docs/notes" className="dc-tile">
                <span className="i"><Sparkles className="h-4 w-4" /></span>
                <div>
                  <div className="t">What's New <Pill tone="solid">v12.0.17</Pill></div>
                  <div className="d">Check out the latest updates, features, and improvements</div>
                </div>
                <Ico.Arrow className="go" />
              </Link>
              <Link to="/help/docs/bring-your-own-storage" className="dc-tile">
                <span className="i"><HardDrive className="h-4 w-4" /></span>
                <div>
                  <div className="t">Bring Your Own Storage <Pill tone="ok">New</Pill></div>
                  <div className="d">Connect your own S3-compatible buckets — AWS, Backblaze, R2, Wasabi, and more</div>
                </div>
                <Ico.Arrow className="go" />
              </Link>
            </div>

            <UnderlineTabs
              label="Filter by category"
              idPrefix="doccat"
              value={selectedCategory}
              onChange={setSelectedCategory}
              tabs={[
                { id: 'all', label: 'All', count: docArticles.length },
                ...docCategories.map((c) => ({ id: c.id, label: c.title, count: getArticlesByCategory(c.id).length })),
              ]}
            />

            <div className="dc-count" aria-live="polite">
              <span>
                {filteredArticles.length} article{filteredArticles.length === 1 ? '' : 's'}
                {searchQuery.trim() ? <> matching “{searchQuery.trim()}”</> : null}
              </span>
              <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6 }} className="hide-sm">
                Search <Kbd>/</Kbd>
              </span>
            </div>

            {visibleCategories.map((cat) => {
              const CatIcon = cat.icon;
              const articles = filteredArticles.filter((a) => a.category === cat.id);
              if (articles.length === 0) return null;
              return (
                <section key={cat.id} className="dc-cat" id={`cat-${cat.id}`}>
                  <div className="dc-cat-h">
                    <CatIcon className="h-4 w-4" style={{ alignSelf: 'center', color: 'var(--sa-mute)' }} />
                    <h2>{cat.title}</h2>
                    <span className="n">{articles.length}</span>
                  </div>
                  <p className="dc-cat-d">{cat.description}</p>
                  <div className="dl">
                    {articles.map((doc) => {
                      const Icon = doc.icon;
                      return (
                        <Link key={doc.id} to={`/help/docs/${doc.id}`} className="dl-row">
                          <Icon className="h-4 w-4" />
                          <div style={{ minWidth: 0 }}>
                            <div className="t">{doc.title}</div>
                            <div className="d">{doc.description}</div>
                          </div>
                          <div className="tg">
                            {doc.tags.slice(0, 3).map((tag) => (
                              <span key={tag}>{tag}</span>
                            ))}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              );
            })}

            {filteredArticles.length === 0 && (
              <div className="sa-panel">
                <Empty
                  icon={<Search className="h-4 w-4" />}
                  title="No Documentation Found"
                  body="Try adjusting your search or filter criteria"
                  action={
                    <button type="button" className={btn()} onClick={() => { setSearchQuery(''); setSelectedCategory('all'); }}>
                      Clear search and filters
                    </button>
                  }
                />
              </div>
            )}
          </div>
        </div>
      </Wrap>
    </AppShell>
  );
};

export default Documentation;
