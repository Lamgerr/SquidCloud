import { Book, FileText, Code, Server, Shield, Calendar, Layers } from '@/lib/icon-map';
import type { DocArticle, DocCategoryDef } from './types';
import { gettingStartedArticles } from './getting-started';
import { guideArticles } from './guides';
import { featureArticles } from './features';
import { apiArticles } from './api';
import { architectureArticles } from './architecture';
import { securityArticles } from './security';

export const docCategories: DocCategoryDef[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    description: 'Accounts, the platform, and your first secure upload.',
    icon: Book,
  },
  {
    id: 'guides',
    title: 'Guides',
    description: 'Everyday tasks: files, sharing, workspaces, and automation.',
    icon: FileText,
  },
  {
    id: 'features',
    title: 'Features (UI)',
    description: 'Every screen in the app, what you can do on each, and how it works.',
    icon: Layers,
  },
  {
    id: 'api',
    title: 'API & CLI',
    description: 'The CloudBliss REST API, secrets, keys, and the squidcloudctl CLI.',
    icon: Code,
  },
  {
    id: 'architecture',
    title: 'Architecture',
    description: 'How encryption, storage backends, and security actually work.',
    icon: Server,
  },
  {
    id: 'security',
    title: 'Security',
    description: 'Zero-knowledge design, RES54, KZA, and BYOK.',
    icon: Shield,
  },
  {
    id: 'releases',
    title: 'Releases',
    description: 'Version history and changelog.',
    icon: Calendar,
  },
];

export const docArticles: DocArticle[] = [
  ...gettingStartedArticles,
  ...guideArticles,
  ...featureArticles,
  ...apiArticles,
  ...architectureArticles,
  ...securityArticles,
];

export const getArticleBySlug = (slug: string | undefined): DocArticle | undefined =>
  docArticles.find((article) => article.id === slug);

export const getArticlesByCategory = (categoryId: string): DocArticle[] =>
  docArticles.filter((article) => article.category === categoryId);
