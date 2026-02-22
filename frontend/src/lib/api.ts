/**
 * api.ts — Backend API client with localStorage caching.
 *
 * Caching strategy:
 *   heroes + facets  → localStorage, 30-day TTL (data changes only on new hero/patch)
 *   suggestions      → no cache (personalised per draft state)
 *   health/ping      → no cache (keep-alive)
 */

import type { HeroFacet } from './store';

const BACKEND_URL =
    process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

/** 30 days in milliseconds */
const HERO_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// localStorage helpers (safe — SSR may not have localStorage)
// ---------------------------------------------------------------------------
function lsGet<T>(key: string): T | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = window.localStorage.getItem(key);
        if (!raw) return null;
        const { data, ts } = JSON.parse(raw) as { data: T; ts: number };
        if (Date.now() - ts > HERO_TTL_MS) {
            window.localStorage.removeItem(key);
            return null;
        }
        return data;
    } catch {
        return null;
    }
}

function lsSet<T>(key: string, data: T): void {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
    } catch {
        // Storage full or unavailable — silently skip
    }
}

// ---------------------------------------------------------------------------
// Heroes
// ---------------------------------------------------------------------------
/**
 * Fetch hero list with localStorage cache (30-day TTL).
 * Avoids re-fetching on every page visit since heroes change ~4x/year.
 */
export async function fetchHeroes(): Promise<Record<string, unknown>[]> {
    const cached = lsGet<Record<string, unknown>[]>('aegis:heroes');
    if (cached) return cached;

    const res = await fetch(`${BACKEND_URL}/api/heroes`, {
        // Next.js ISR revalidation as secondary cache if running server-side
        next: { revalidate: 86400 },
    });
    if (!res.ok) throw new Error('Failed to fetch heroes');
    const data = await res.json();
    lsSet('aegis:heroes', data);
    return data;
}

// ---------------------------------------------------------------------------
// Facets
// ---------------------------------------------------------------------------
/** Facet map returned by /api/facets: heroId (string) → HeroFacet[] */
export type FacetMap = Record<string, HeroFacet[]>;

/**
 * Fetch facet definitions with localStorage cache (30-day TTL).
 * Facets change only when a hero is added or reworked (~4x/year).
 */
export async function fetchFacets(): Promise<FacetMap> {
    const cached = lsGet<FacetMap>('aegis:facets');
    if (cached) return cached;

    const res = await fetch(`${BACKEND_URL}/api/facets`, {
        next: { revalidate: 86400 },
    });
    if (!res.ok) throw new Error('Failed to fetch facets');
    const data = await res.json();
    lsSet('aegis:facets', data);
    return data;
}

// ---------------------------------------------------------------------------
// Suggestions
// ---------------------------------------------------------------------------
export interface SuggestionParams {
    ally_ids: number[];
    enemy_ids: number[];
    banned_ids: number[];
    ally_roles: Record<string, string>;
    ally_facets: Record<string, number>;   // { heroId: facetId }
    enemy_facets: Record<string, number>;  // { heroId: facetId }
    mmr_bracket: string;
    game_mode: string;
    region: string;
}

/**
 * Fetch counterpick suggestions.
 * Never cached — each draft state is unique.
 */
export async function fetchSuggestions(params: SuggestionParams) {
    const res = await fetch(`${BACKEND_URL}/api/suggestions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
        cache: 'no-store',
    });
    if (!res.ok) throw new Error('Failed to fetch suggestions');
    return res.json();
}

// ---------------------------------------------------------------------------
// Meta / keep-alive
// ---------------------------------------------------------------------------
export async function fetchMeta() {
    const res = await fetch(`${BACKEND_URL}/health`, {
        next: { revalidate: 60 },
    });
    if (!res.ok) throw new Error('Failed to fetch meta');
    return res.json();
}

/**
 * Ping backend every ~4 minutes to prevent Render free tier from sleeping.
 * Failures are silently swallowed — the UI should not break if backend is cold.
 */
export async function pingBackend() {
    try {
        await fetch(`${BACKEND_URL}/health`);
    } catch {
        // silently ignore keep-alive failures
    }
}
