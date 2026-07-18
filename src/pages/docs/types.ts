import type { ComponentType } from 'react';

export type DocCategoryId =
  | 'getting-started'
  | 'guides'
  | 'features'
  | 'api'
  | 'architecture'
  | 'security'
  | 'releases';

export interface DocArticle {
  id: string;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  category: DocCategoryId;
  content: string;
  tags: string[];
  updated?: string;
}

export interface DocCategoryDef {
  id: DocCategoryId;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}
