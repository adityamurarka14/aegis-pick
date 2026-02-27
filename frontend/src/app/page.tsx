'use client';

import { useEffect, useState } from 'react';
import { fetchHeroes, fetchFacets, fetchSuggestions, pingBackend, fetchMeta, fetchEvaluation } from '@/lib/api';
import type { FacetMap } from '@/lib/api';
import { useDraftStore } from '@/lib/store';
import type { Hero } from '@/lib/store';
import GameModeSelector from '@/components/GameModeSelector';
import BanRow from '@/components/BanRow';
import DraftBoard from '@/components/DraftBoard';
import SuggestionPanel from '@/components/SuggestionPanel';
import HeroSearch from '@/components/HeroSearch';

/**
 * The main entry point for the Aegis Pick draft application.
 * Manages fetching core data (heroes/facets) and automatically
 * queries the suggestion API when the draft state changes.
 */
export default function DraftPage() {
  const {
    gameMode, bracket, region,
    allySlots, enemySlots, bannedHeroes,
    suggestions, isFetching,
    setSuggestions, setFetching,
    winProbability, setWinProbability
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
    fetchMeta()
      .then((data) => setPatch(data.patch))
      .catch(console.error);

    // Keep Render warm every 4 minutes (prevents Render free tier sleep)
    const keepAlive = setInterval(pingBackend, 4 * 60 * 1000);
    pingBackend();
    return () => clearInterval(keepAlive);
  }, []);

  // Auto-fetch suggestions whenever draft state changes
  useEffect(() => {
    const enemyIds = enemySlots.map((s) => s.hero?.id).filter(Boolean) as number[];
    const allyIds = allySlots.map((s) => s.hero?.id).filter(Boolean) as number[];

    // Check if the draft is full
    if (allyIds.length === 5 && enemyIds.length === 5) {
      fetchEvaluation({
        ally_ids: allyIds,
        enemy_ids: enemyIds,
        game_mode: gameMode,
        region: region,
      })
        .then((data) => setWinProbability(data.win_probability))
        .catch(console.error);

      setSuggestions([]); // No more suggestions needed
      return;
    }
    setWinProbability(null);

    if (enemyIds.length === 0) {
      setSuggestions([]);
      return;
    }
    const bannedIds = bannedHeroes.map((h) => h.id);
    const allyRoles: Record<string, string> = {};
    const allyFacets: Record<string, number> = {};
    const enemyFacets: Record<string, number> = {};

    allySlots.forEach((s, index) => {
      if (s.hero) {
        // Derive role from slot index (0->Pos1, 1->Pos2, 2->Pos3, 3->Pos4, 4->Pos5)
        const posRoleMap = ['Carry', 'Mid', 'Offlane', 'Support', 'Hard Support'];
        allyRoles[String(s.hero.id)] = posRoleMap[index];
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
    <div className="min-h-screen" style={{ background: 'var(--bg-base)', padding: '20px' }}>
      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-40 border-b px-6 py-4 flex items-center justify-between shadow-2xl"
        style={{
          background: 'rgba(4, 8, 20, 0.7)', borderColor: 'rgba(255,255,255,0.05)',
          backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
          marginBottom: '20px',
          padding: '20px',

        }}>
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="font-display text-2xl font-bold tracking-[0.2em] leading-none"
              style={{
                background: 'linear-gradient(90deg, #60a5fa 0%, #a78bfa 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: '0 2px 10px rgba(96,165,250,0.3)',
                fontSize: 'xxx-large'
              }}>
              AEGIS PICK
            </span>
            <span className="text-[10px] tracking-widest uppercase font-medium mt-1"
              style={{ color: 'var(--text-muted)', fontSize: 'medium' }}>
              Dota 2 Draft Assistant
            </span>
          </div>
        </div>
        {patch && (
          <div className="glass px-3 py-1 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[11px] font-bold tracking-wider" style={{ color: 'var(--text-secondary)' }}>
              PATCH {patch}
            </span>
          </div>
        )}
      </nav>

      {/* ── Main content ── */}
      <main className="max-w-[1400px] w-full mx-auto px-6 py-12 xl:px-12 xl:py-16 flex flex-col gap-8 lg:gap-12 relative z-10">
        <GameModeSelector />
        <BanRow />
        <DraftBoard allFacets={allFacets} />
        <div className="mt-4">
          <SuggestionPanel
            suggestions={suggestions}
            isFetching={isFetching}
            hasEnemies={hasEnemies}
          />
        </div>
      </main>

      {/* Hero search modal */}
      <HeroSearch allHeroes={allHeroes} />
    </div>
  );
}
