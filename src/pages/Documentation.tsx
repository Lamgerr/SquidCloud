import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, ArrowLeft, Sparkles, Book, HardDrive } from '@/lib/icon-map';
import EnhancedMarkdownPreview from '@/components/EnhancedMarkdownPreview';
import { useIsMobile } from '@/hooks/use-mobile';
import MobileScrollToTop from '@/components/MobileScrollToTop';
import {
  docArticles,
  docCategories,
  getArticleBySlug,
  getArticlesByCategory,
} from './docs';

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

  if (currentDoc) {
    const Icon = currentDoc.icon;
    return (
      <div className="min-h-screen bg-background">
        {isMobile && <MobileScrollToTop />}
        <div className={`container mx-auto px-4 ${isMobile ? 'py-20 pb-32' : 'py-8'} max-w-4xl`}>
          <Button variant="ghost" onClick={() => navigate('/help/docs')} className="mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Documentation
          </Button>

          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Icon className="w-8 h-8 text-primary" />
              <div>
                <h1 className="text-3xl font-bold">{currentDoc.title}</h1>
                <p className="text-muted-foreground">{currentDoc.description}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {currentDoc.tags.map((tag) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
              {currentDoc.updated && (
                <Badge variant="secondary">Updated {currentDoc.updated}</Badge>
              )}
            </div>
          </div>

          <Card>
            <CardContent className="pt-6">
              <EnhancedMarkdownPreview content={currentDoc.content} />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const SidebarLink = ({ id, title }: { id: string; title: string }) => (
    <button
      onClick={() => navigate(`/help/docs/${id}`)}
      className="block w-full text-left text-sm px-2 py-1.5 rounded-md hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
    >
      {title}
    </button>
  );

  return (
    <div className="min-h-screen bg-background">
      {isMobile && <MobileScrollToTop />}
      <div className={`container mx-auto px-4 ${isMobile ? 'py-20 pb-32' : 'py-8'}`}>
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-3 flex items-center gap-3">
            <Book className="w-10 h-10" />
            SquidCloud Documentation
          </h1>
          <p className="text-xl text-muted-foreground">
            Comprehensive guides, API references, and architecture documentation
          </p>
        </div>

        <div className="lg:grid lg:grid-cols-[16rem_1fr] lg:gap-8">
          {!isMobile && (
            <aside className="hidden lg:block">
              <div className="sticky top-8 space-y-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search docs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <nav className="space-y-4">
                  <button
                    onClick={() => {
                      setSelectedCategory('all');
                      setSearchQuery('');
                    }}
                    className={`block w-full text-left text-sm font-semibold px-2 py-1.5 rounded-md transition-colors ${
                      selectedCategory === 'all'
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    All articles
                  </button>
                  {docCategories.map((cat) => {
                    const CatIcon = cat.icon;
                    return (
                      <div key={cat.id}>
                        <button
                          onClick={() => setSelectedCategory(cat.id)}
                          className={`flex items-center gap-2 w-full text-left text-sm font-semibold px-2 py-1.5 rounded-md transition-colors ${
                            selectedCategory === cat.id
                              ? 'bg-primary/10 text-primary'
                              : 'text-foreground/80 hover:text-foreground'
                          }`}
                        >
                          <CatIcon className="w-4 h-4" />
                          {cat.title}
                        </button>
                        <div className="mt-1 space-y-0.5 pl-2">
                          {getArticlesByCategory(cat.id).map((a) => (
                            <SidebarLink key={a.id} id={a.id} title={a.title} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </nav>
              </div>
            </aside>
          )}

          <div>
            <div className="mb-6 space-y-4 lg:hidden">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search documentation..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="mb-6 flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  selectedCategory === 'all'
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                All
              </button>
              {docCategories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    selectedCategory === cat.id
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {cat.title}
                </button>
              ))}
            </div>

            <Card
              className="mb-6 cursor-pointer hover:shadow-lg transition-shadow border-primary/50"
              onClick={() => navigate('/help/docs/notes')}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-lg bg-primary/10">
                      <Sparkles className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        What's New
                        <Badge className="bg-primary">v12.0.17</Badge>
                      </CardTitle>
                      <CardDescription>
                        Check out the latest updates, features, and improvements
                      </CardDescription>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    View Patch Notes
                  </Button>
                </div>
              </CardHeader>
            </Card>

            <Card
              className="mb-6 cursor-pointer hover:shadow-lg transition-shadow border-primary/50"
              onClick={() => navigate('/help/docs/bring-your-own-storage')}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-lg bg-primary/10">
                      <HardDrive className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        Bring Your Own Storage
                        <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-500/20">New</Badge>
                      </CardTitle>
                      <CardDescription>
                        Connect your own S3-compatible buckets — AWS, Backblaze, R2, Wasabi, and more
                      </CardDescription>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    Read Guide
                  </Button>
                </div>
              </CardHeader>
            </Card>

            {visibleCategories.map((cat) => {
              const CatIcon = cat.icon;
              const articles = filteredArticles.filter((a) => a.category === cat.id);
              if (articles.length === 0) return null;
              return (
                <section key={cat.id} className="mb-10">
                  <div className="flex items-center gap-2 mb-4">
                    <CatIcon className="w-5 h-5 text-primary" />
                    <h2 className="text-2xl font-bold">{cat.title}</h2>
                  </div>
                  <p className="text-muted-foreground mb-4">{cat.description}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {articles.map((doc) => {
                      const Icon = doc.icon;
                      return (
                        <Card
                          key={doc.id}
                          className="cursor-pointer hover:shadow-lg transition-shadow"
                          onClick={() => navigate(`/help/docs/${doc.id}`)}
                        >
                          <CardHeader>
                            <div className="flex items-start justify-between mb-3">
                              <Icon className="w-8 h-8 text-primary" />
                              <Badge variant="secondary">{doc.category}</Badge>
                            </div>
                            <CardTitle className="text-xl">{doc.title}</CardTitle>
                            <CardDescription>{doc.description}</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <div className="flex flex-wrap gap-1">
                              {doc.tags.slice(0, 3).map((tag) => (
                                <Badge key={tag} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </section>
              );
            })}

            {filteredArticles.length === 0 && (
              <Card className="mt-8">
                <CardContent className="pt-12 pb-12 text-center">
                  <Search className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">No Documentation Found</h3>
                  <p className="text-muted-foreground">
                    Try adjusting your search or filter criteria
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Documentation;
