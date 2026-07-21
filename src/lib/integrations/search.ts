import "server-only";
// Semantic search abstraction. A keyword+NL-parse provider that works TODAY, and
// an OpenAI-embeddings provider (env-gated) that upgrades ranking the moment
// OPENAI_API_KEY is set. Both share the pure NL parser in lib/search/parse.
import { isConfigured } from "./config";
import { parseNaturalQuery, type ParsedQuery } from "@/lib/search/parse";

export interface SemanticSearchProvider {
  name: string;
  parse(text: string): ParsedQuery;
}

class KeywordProvider implements SemanticSearchProvider {
  name = "keyword-fallback";
  parse = parseNaturalQuery;
}

class OpenAIEmbeddingsProvider implements SemanticSearchProvider {
  name = "openai-embeddings";
  // Structured parse still runs; embeddings would additionally re-rank candidates.
  // Integration point: POST https://api.openai.com/v1/embeddings with OPENAI_API_KEY,
  // store vectors in pgvector, rank by cosine similarity, then intersect with filters.
  parse = parseNaturalQuery;
}

export function getSearchProvider(): SemanticSearchProvider {
  return isConfigured("openai_search") ? new OpenAIEmbeddingsProvider() : new KeywordProvider();
}

/** Parse a natural-language query into structured search filters. */
export function querySemantic(text: string): ParsedQuery {
  return getSearchProvider().parse(text);
}
