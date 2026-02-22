'use client';

import { useEffect, useState } from 'react';
import { fetchHeroes, fetchFacets, fetchSuggestions, pingBackend } from '@/lib/api';
import type { FacetMap } from '@/lib/api';
import { useDraftStore } from '@/lib/store';
import type { Hero } from '@/lib/store';
import GameModeSelector from '@/components/GameModeSelector';
import BanRow from '@/components/BanRow';
import DraftBoard from '@/components/DraftBoard';
import SuggestionPanel from '@/components/SuggestionPanel';
import HeroSearch from '@/components/HeroSearch';

export default function DraftPage() {
  const {
    gameMode, bracket, region,
    allySlots, enemySlots, bannedHeroes,
    suggestions, isFetching,
    setSuggestions, setFetching,
  } = useDraftStore();

  const [allHeroes, setAllHeroes] = useState<Hero[]>([]);
  const [allFacets, setAllFacets] = useState<FacetMap>({});
  const [patch, setPatch] = useState('');

  // Boot: fetch heroes + facets (localStorage-cached 30d) + start keep-alive
  useEffect(() => {
    fetchHeroes()
      .then((data) => setAllHeroes(data as unknown as Hero[]))
      .catch(console.error);
    fetchFacets()
      .then(setAllFacets)
      .catch(console.error);

    // Keep Render warm every 4 minutes (prevents Render free tier sleep)
    const keepAlive = setInterval(pingBackend, 4 * 60 * 1000);
    pingBackend();
    return () => clearInterval(keepAlive);
  }, []);

  // Auto-fetch suggestions whenever draft state changes
  useEffect(() => {
    const enemyIds = enemySlots.map((s) => s.hero?.id).filter(Boolean) as number[];
    if (enemyIds.length === 0) {
      setSuggestions([]);
      return;
    }

    const allyIds = allySlots.map((s) => s.hero?.id).filter(Boolean) as number[];
    const bannedIds = bannedHeroes.map((h) => h.id);
    const allyRoles: Record<string, string> = {};
    const allyFacets: Record<string, number> = {};
    const enemyFacets: Record<string, number> = {};

    allySlots.forEach((s) => {
      if (s.hero) {
        if (s.role) allyRoles[String(s.hero.id)] = s.role;
        allyFacets[String(s.hero.id)] = s.facetId;
      }
    });
    enemySlots.forEach((s) => {
      if (s.hero) enemyFacets[String(s.hero.id)] = s.facetId;
    });

    setFetching(true);
    fetchSuggestions({
      ally_ids: allyIds,
      enemy_ids: enemyIds,
      banned_ids: bannedIds,
      ally_roles: allyRoles,
      ally_facets: allyFacets,
      enemy_facets: enemyFacets,
      mmr_bracket: bracket,
      game_mode: gameMode,
      region,
    })
      .then(setSuggestions)
      .catch(console.error)
      .finally(() => setFetching(false));
    // Include facetId changes in deps via JSON stringify of facet selections
  }, [allySlots, enemySlots, bannedHeroes, bracket, gameMode, region]);

  const hasEnemies = enemySlots.some((s) => s.hero !== null);

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-40 border-b px-6 py-3 flex items-center justify-between"
        style={{
          background: 'rgba(10,12,16,0.9)', borderColor: 'var(--border)',
          backdropFilter: 'blur(16px)'
        }}>
        <div className="flex items-center gap-3">
          <span className="font-display text-xl font-bold tracking-widest"
            style={{ color: 'var(--accent)' }}>
            AEGIS PICK
          </span>
          <span className="text-xs px-2 py-0.5 rounded"
            style={{
              background: 'var(--bg-card)', color: 'var(--text-muted)',
              border: '1px solid var(--border)'
            }}>
            Dota 2 Draft Assistant
          </span>
        </div>
        {patch && (
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Patch {patch}
          </span>
        )}
      </nav>

      {/* ── Main content ── */}
      <main className="max-w-5xl mx-auto px-4 py-6 flex flex-col gap-4">
        <GameModeSelector />
        <BanRow />
        <DraftBoard allFacets={allFacets} />
        <SuggestionPanel
          suggestions={suggestions}
          isFetching={isFetching}
          hasEnemies={hasEnemies}
        />
      </main>

      {/* Hero search modal */}
      <HeroSearch allHeroes={allHeroes} />
    </div>
  );
}
