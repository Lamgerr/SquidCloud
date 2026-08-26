import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { 
  Search, Upload, BookOpen, MoreVertical, Download, 
  Trash2, Star, Clock, Info, Library, Loader2, Bookmark, X
} from 'lucide-react';

interface GutendexBook {
  id: number;
  title: string;
  authors: { name: string }[];
  formats: Record<string, string>;
  download_count: number;
}

export default function DeepReadCatalog({ files, onBookOpen, onUpload }: { files: any[], onBookOpen: (file: any, source?: 'local' | 'remote') => void, onUpload?: () => void }) {
  const isMobile = useIsMobile();
  
  const [activeTab, setActiveTab] = useState<'library' | 'discover'>('library');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  
  const [books, setBooks] = useState<GutendexBook[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  
  const [selectedBook, setSelectedBook] = useState<GutendexBook | null>(null);
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  
  const observer = useRef<IntersectionObserver | null>(null);
  const userBooks = files.filter(f => f.name?.match(/\.(epub|pdf|mobi)$/i));

  useEffect(() => {
    if (userBooks.length === 0 && activeTab === 'library') setActiveTab('discover');
  }, [userBooks.length]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchBooks = async (pageNum: number, searchQuery: string, reset = false) => {
    if (loading) return;
    setLoading(true);
    try {
      const url = `https://gutendex.com/books/?page=${pageNum}${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      setBooks(prev => reset ? data.results : [...prev, ...data.results]);
      setHasMore(!!data.next);
    } catch (err) {
      console.error("Failed to fetch open-source books", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    fetchBooks(1, debouncedSearch, true);
  }, [debouncedSearch]);

  const lastBookElementRef = useCallback((node: HTMLDivElement) => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && activeTab === 'discover') {
        setPage(p => { const next = p + 1; fetchBooks(next, debouncedSearch); return next; });
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, hasMore, debouncedSearch, activeTab]);

  const getCover = (book: GutendexBook) => book.formats['image/jpeg'] || `https://ui-avatars.com/api/?name=${book.title}&background=121212&color=fff&size=400`;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0A0A0A] text-white overflow-hidden">
      
      {/* ═══ RESPONSIVE HEADER ═══ */}
      <header className="shrink-0 bg-[#0A0A0A]/95 border-b border-zinc-800/80 z-30">
        <div className="flex items-center justify-between px-4 sm:px-8 py-4 sm:py-6">
          {!showMobileSearch && (
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-lg bg-white text-black flex items-center justify-center  shrink-0">
                <Library className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">DeepRead</h1>
                {!isMobile && <p className="text-sm text-zinc-500 font-medium">Your private digital library</p>}
              </div>
            </div>
          )}

          {!isMobile && (
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="w-4 h-4 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2" />
                <input 
                  type="text" placeholder="Search authors or titles..." 
                  className="pl-11 pr-4 py-2.5 w-72 rounded-xl bg-[#121212] border border-zinc-800 focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-all text-sm outline-none text-white placeholder:text-zinc-600"
                  value={search} onChange={e => setSearch(e.target.value)}
                />
              </div>
              <button onClick={onUpload} className="flex items-center gap-2 bg-white text-black px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-zinc-200 transition-all shadow-lg active:scale-95 shrink-0">
                <Upload className="w-4 h-4" /> Upload
              </button>
            </div>
          )}

          {isMobile && (
            <div className={cn("flex items-center gap-2", showMobileSearch ? "w-full" : "w-auto")}>
              {showMobileSearch ? (
                <div className="relative w-full flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                      autoFocus type="text" placeholder="Search..." 
                      className="pl-9 pr-3 py-2 w-full rounded-lg bg-[#121212] border border-zinc-800 text-sm outline-none text-white"
                      value={search} onChange={e => setSearch(e.target.value)}
                    />
                  </div>
                  <button onClick={() => { setShowMobileSearch(false); setSearch(''); }} className="text-sm font-medium text-zinc-400">Cancel</button>
                </div>
              ) : (
                <>
                  <button onClick={() => setShowMobileSearch(true)} className="w-10 h-10 rounded-full flex items-center justify-center text-zinc-400 bg-zinc-900 border border-zinc-800">
                    <Search className="w-4 h-4" />
                  </button>
                  <button onClick={onUpload} className="w-10 h-10 rounded-full flex items-center justify-center bg-white text-black shadow-lg">
                    <Upload className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* ═══ SEGMENTED TABS ═══ */}
        <div className="px-4 sm:px-8 pb-4 flex items-center gap-6">
          <button 
            onClick={() => setActiveTab('library')}
            className={cn("text-sm sm:text-base font-bold transition-all relative py-2", activeTab === 'library' ? "text-white" : "text-zinc-500 hover:text-zinc-300")}
          >
            My Library
            {activeTab === 'library' && <motion.div layoutId="dr-tab" className="absolute bottom-0 inset-x-0 h-0.5 bg-white rounded-t-full" />}
          </button>
          <button 
            onClick={() => setActiveTab('discover')}
            className={cn("text-sm sm:text-base font-bold transition-all relative py-2", activeTab === 'discover' ? "text-white" : "text-zinc-500 hover:text-zinc-300")}
          >
            Discover Free Books
            {activeTab === 'discover' && <motion.div layoutId="dr-tab" className="absolute bottom-0 inset-x-0 h-0.5 bg-white rounded-t-full" />}
          </button>
        </div>
      </header>

      {/* ═══ MAIN CONTENT AREA ═══ */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pb-24 touch-pan-y" onClick={() => setActiveMenu(null)}>
        
        {/* ─── TAB: MY LIBRARY ─── */}
        {activeTab === 'library' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 sm:p-8">
            {userBooks.length === 0 ? (
              <div className="mt-10 sm:mt-20 w-full max-w-md mx-auto p-8 sm:p-12 rounded-[2rem] border border-dashed border-zinc-800 flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-zinc-900 rounded-lg flex items-center justify-center mb-4"><Bookmark className="w-8 h-8 text-zinc-600" /></div>
                <h3 className="text-lg font-bold text-white mb-2">Your library is empty</h3>
                <p className="text-zinc-500 text-sm mb-6">Upload a PDF or EPUB file from your device, or discover thousands of free classics.</p>
                <button onClick={() => setActiveTab('discover')} className="px-6 py-3 bg-white text-black font-bold rounded-xl text-sm shadow-lg active:scale-95 transition-all">
                  Browse Catalog
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
                {userBooks.map(file => (
                  <div key={file.id} className="relative group flex flex-col gap-2.5">
                    <div 
                      className="aspect-[2/3] w-full rounded-lg bg-[#121212] border border-zinc-800/80 overflow-hidden cursor-pointer transition-all duration-300 group-hover:border-zinc-500 group-hover:shadow-[0_15px_30px_-10px_rgba(0,0,0,0.5)]"
                      onClick={() => onBookOpen(file, 'local')}
                    >
                      <div className="w-full h-full flex flex-col items-center justify-center text-zinc-700 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-900 to-[#121212]">
                        <BookOpen className="w-10 h-10 mb-3 opacity-60" />
                        <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">{file.name.split('.').pop()}</span>
                      </div>
                    </div>

                    <div className="flex items-start justify-between gap-2 px-1">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-white truncate">{file.name}</p>
                        <p className="text-xs text-zinc-500 font-medium truncate mt-0.5">Local Storage</p>
                      </div>
                      <div className="relative shrink-0">
                        <button onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === file.id ? null : file.id); }} className="w-6 h-6 flex items-center justify-center text-zinc-500 hover:text-white transition-colors">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        <AnimatePresence>
                          {activeMenu === file.id && (
                            <motion.div 
                              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                              className="absolute right-0 top-8 z-50 w-48 bg-[#121212] border border-zinc-800 rounded-xl shadow-2xl p-1.5 flex flex-col gap-0.5"
                            >
                              <button onClick={() => onBookOpen(file, 'local')} className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-zinc-300 hover:text-white hover:bg-zinc-800"><BookOpen className="w-4 h-4" /> Read Now</button>
                              <div className="h-px bg-zinc-800/80 my-1" />
                              <button className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-red-400 hover:bg-red-400/10"><Trash2 className="w-4 h-4" /> Delete</button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ─── TAB: DISCOVER ─── */}
        {activeTab === 'discover' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 sm:p-8">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
              {books.map((book, index) => {
                const isLast = index === books.length - 1;
                return (
                  <div 
                    key={book.id} ref={isLast ? lastBookElementRef : null}
                    className="relative group flex flex-col gap-2.5 cursor-pointer"
                    onClick={() => { setSelectedBook(book); setInfoDialogOpen(true); }}
                  >
                    <div className="aspect-[2/3] w-full rounded-lg bg-[#121212] border border-zinc-800/80 overflow-hidden transition-all duration-300 group-hover:shadow-[0_15px_30px_-10px_rgba(0,0,0,0.5)] group-hover:border-zinc-500 relative">
                      <img src={getCover(book)} alt={book.title} className="w-full h-full object-cover" loading="lazy" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white"><Info className="w-5 h-5" /></div>
                      </div>
                    </div>
                    <div className="px-1">
                      <p className="text-sm font-bold text-white leading-tight line-clamp-2" title={book.title}>{book.title}</p>
                      <p className="text-xs text-zinc-500 font-medium truncate mt-1">{book.authors[0]?.name || 'Unknown'}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {loading && (
              <div className="w-full py-12 flex justify-center items-center gap-3 text-zinc-500 font-medium text-sm">
                <Loader2 className="w-5 h-5 animate-spin" /> Fetching catalog...
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* ═══ SAFE NATIVE FRAMER MOTION MODAL (ERROR 130 FIXED) ═══ */}
      <AnimatePresence>
        {infoDialogOpen && selectedBook && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80"
              onClick={() => setInfoDialogOpen(false)}
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={cn(
                "relative z-10 w-full bg-[#121212] border border-zinc-800 shadow-[0_30px_60px_rgba(0,0,0,0.6)] overflow-hidden text-white flex flex-col",
                isMobile ? "max-w-md rounded-lg p-6" : "max-w-2xl rounded-[2.5rem] p-8"
              )}
            >
              <button onClick={() => setInfoDialogOpen(false)} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-zinc-900 rounded-full text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>

              <div className={cn("flex", isMobile ? "flex-col gap-6" : "gap-8")}>
                <div className={cn("shrink-0", isMobile ? "flex justify-center" : "")}>
                  <img src={getCover(selectedBook)} className={cn("object-cover rounded-xl shadow-lg border border-zinc-800", isMobile ? "w-40 h-60" : "w-48 h-72")} alt="Cover" />
                </div>
                
                <div className="flex flex-col justify-center flex-1 min-w-0 text-center sm:text-left">
                  <h3 className={cn("font-bold leading-tight text-white", isMobile ? "text-xl" : "text-3xl")}>{selectedBook.title}</h3>
                  <p className="text-zinc-400 mt-2 font-medium text-lg">{selectedBook.authors[0]?.name}</p>
                  
                  <div className={cn("flex items-center gap-3 mt-4 text-xs font-bold text-zinc-500 uppercase tracking-wider", isMobile ? "justify-center" : "")}>
                    <span className="px-3 py-1 bg-zinc-900 rounded-lg border border-zinc-800">Public Domain</span>
                    <span>•</span>
                    <span>{selectedBook.download_count.toLocaleString()} <span className="hidden sm:inline">Downloads</span></span>
                  </div>
                  
                  <div className="mt-8 flex flex-col gap-3">
                    {selectedBook.formats['application/epub+zip'] ? (
                      <button 
                        onClick={() => {
                          setInfoDialogOpen(false);
                          onBookOpen({ name: selectedBook.title + '.epub', url: selectedBook.formats['application/epub+zip'] }, 'remote');
                        }}
                        className="flex items-center justify-center gap-2 w-full bg-white text-black py-4 sm:py-3.5 rounded-xl font-bold hover:bg-zinc-200 transition-all active:scale-95  text-base sm:text-sm"
                      >
                        <BookOpen className="w-5 h-5 sm:w-4 sm:h-4" /> Read Book Now
                      </button>
                    ) : (
                      <button disabled className="w-full bg-zinc-900 text-zinc-600 border border-zinc-800 py-4 sm:py-3.5 rounded-xl font-bold cursor-not-allowed">
                        EPUB Unavailable
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
