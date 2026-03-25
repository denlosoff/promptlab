export interface Category {
  id: string;
  name: string;
  icon?: string;
  parentId?: string;
  isNew?: boolean;
  isModified?: boolean;
}

export interface Token {
  id: string;
  name: string;
  descriptionShort: string;
  aliases: string[];
  wordForms?: string[];
  categoryIds: string[];
  examples: string[];
  exampleCount?: number;
  coverImage?: string;
  isNew?: boolean;
  isModified?: boolean;
}

export interface RecentInput {
  text: string;
  type: 'token' | 'text';
  tokenId?: string;
  count: number;
  lastUsed: number;
}

export type PromptNodeType = 'token' | 'custom' | 'group' | 'separator';

export interface PromptNode {
  id: string;
  type: PromptNodeType;
  tokenId?: string;
  text: string;
  children?: PromptNode[];
}

export interface SuggestedToken {
  id: string;
  name: string;
  descriptionShort: string;
  categoryIds: string[];
  categoryNames: string[]; // The names of the categories it was mapped to or suggested
  confidence: number; // 0 to 1
  aliases: string[];
  wordForms: string[];
  examples: string[];
}

export interface AiSuggestion {
  id: string;
  type: 'add' | 'remove' | 'replace' | 'move';
  targetText?: string;
  targetNodeIds?: string[];
  newText?: string;
  reason: string;
}

export interface DataMeta {
  dataFile: string;
  updatedAt: string;
  mode?: string;
}

export interface AppFeatures {
  aiEnabled: boolean;
}

export interface TokenSuggestion {
  id: string;
  name: string;
  descriptionShort: string;
  aliases: string[];
  wordForms: string[];
  categoryIds: string[];
  examples: string[];
  note?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  reviewedAt?: string;
}
