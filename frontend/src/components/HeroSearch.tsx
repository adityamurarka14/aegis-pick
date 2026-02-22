'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { searchHeroes } from '@/lib/heroAliases';
import { Hero, useDraftStore } from '@/lib/store';

interface HeroSearchProps {
    allHeroes: Hero[];
}

const ROLES = ['carry', 'mid', 'offlane', 'soft_support', 'hard_support'] as const;

export default function HeroSearch({ allHeroes }: HeroSearchProps) {
    const { searchOpen, searchTarget, closeSearch, pickHero,
        allySlots, enemySlots, bannedHeroes } = useDraftStore();
    const [query, setQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const excludedIds = [
        ...allySlots.map((s) => s.hero?.id).filter(Boolean),
        ...enemySlots.map((s) => s.hero?.id).filter(Boolean),
        ...bannedHeroes.map((h) => h.id),
    ] as number[];

    const results = searchHeroes(query, allHeroes, excludedIds);

    useEffect(() => {
        if (searchOpen) {
            setQuery('');
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [searchOpen]);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeSearch();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [closeSearch]);

    if (!searchOpen) return null;

    const title =
        searchTarget?.side === 'ban'
            ? 'Select hero to ban'
            : searchTarget?.side === 'ally'
                ? 'Add ally hero'
                : 'Add enemy hero';

    const accentStyle =
        searchTarget?.side === 'ban'
            ? 'border-amber-500/30'
            : searchTarget?.side === 'ally'
                ? 'border-blue-500/30'
                : 'border-red-500/30';

    return (
        <div className="modal-backdrop" onClick={closeSearch}>
            <div
                className={`search-modal border ${accentStyle}`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b"
                    style={{ borderColor: 'var(--border)' }}>
                    <span className="font-display text-sm font-semibold tracking-wide uppercase"
                        style={{ color: 'var(--text-secondary)' }}>
                        {title}
                    </span>
                    <button onClick={closeSearch}
                        className="text-xs px-2 py-1 rounded hover:bg-white/5 transition-colors"
                        style={{ color: 'var(--text-muted)' }}>
                        ESC
                    </button>
                </div>

                {/* Search input */}
                <div className="px-4 py-3">
                    <input
                        ref={inputRef}
                        className="search-input"
                        placeholder="Search by name or alias (AM, Nevermore, Carl…)"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                </div>

                {/* Hero grid */}
                <div className="overflow-y-auto px-4 pb-4"
                    style={{ maxHeight: 'calc(70vh - 120px)' }}>
                    {results.length === 0 ? (
                        <p className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>
                            No heroes found for &ldquo;{query}&rdquo;
                        </p>
                    ) : (
                        <div className="grid grid-cols-7 gap-1">
                            {results.map((hero) => (
                                <button
                                    key={hero.id}
                                    className="hero-grid-item"
                                    onClick={() => pickHero(hero)}
                                >
                                    {hero.img ? (
                                        <Image
                                            src={hero.img}
                                            alt={hero.localized_name}
                                            width={54}
                                            height={30}
                                            className="hero-grid-portrait"
                                            unoptimized
                                        />
                                    ) : (
                                        <div className="hero-grid-portrait skeleton" />
                                    )}
                                    <span className="hero-grid-name">{hero.localized_name}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
