'use client';

import { useEffect, useRef, useState } from 'react';
import { searchHeroes } from '@/lib/heroAliases';
import { Hero, useDraftStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

interface HeroSearchProps {
    allHeroes: Hero[];
}

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

    // If not open, we don't render the content, but the Dialog handles open state
    // We bind it directly to the store state.

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
        <Dialog open={searchOpen} onOpenChange={(open) => !open && closeSearch()}>
            <DialogContent
                className={`flex flex-col overflow-hidden bg-[#131826] border rounded-2xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.7)] sm:max-w-[600px] w-full max-h-[85vh] p-0 ${accentStyle} gap-0`}
            >
                {/* Header */}
                <DialogHeader className="px-5 py-4 border-b bg-black/20" style={{ borderColor: 'var(--border)', padding: '20px' }}>
                    <DialogTitle className="font-display text-base font-bold tracking-[0.15em] uppercase" style={{ color: 'var(--text-primary)' }}>
                        {title}
                    </DialogTitle>
                </DialogHeader>

                {/* Search input */}
                <div className="px-5 py-4 bg-black/10" style={{ margin: ' 10px' }}  >
                    <Input
                        ref={inputRef}
                        className="w-full bg-black/40 border border-white/20 rounded-lg px-4 h-12 text-[15px] text-white placeholder:text-white/40 focus-visible:ring-1 focus-visible:ring-blue-500/50 transition-all font-sans"
                        placeholder="Search by name or alias (AM, Nevermore, Carl…)"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                </div>

                {/* Hero grid */}
                <div className="overflow-y-auto px-4 pb-4"
                    style={{ maxHeight: 'calc(70vh - 120px)' }}>
                    {results.length === 0 ? (
                        <p className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)', marginBottom: '10px', padding: '10px' }}>
                            No heroes found for &ldquo;{query}&rdquo;
                        </p>
                    ) : (
                        <div className="grid grid-cols-7 gap-1" style={{ margin: ' 10px' }} >
                            {results.map((hero) => (
                                <Button
                                    key={hero.id}
                                    variant="ghost"
                                    className="flex flex-col h-auto items-center gap-1.5 p-2 rounded-[10px] border border-transparent transition-all hover:bg-white/5 hover:border-white/10 hover:-translate-y-0.5"
                                    onClick={() => pickHero(hero)}
                                >
                                    {hero.img ? (
                                        <img
                                            src={hero.img}
                                            alt={hero.localized_name}
                                            className="w-16 h-9 rounded-md object-cover shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
                                        />
                                    ) : (
                                        <div className="w-16 h-9 rounded-md bg-[#1c2336] relative overflow-hidden after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-white/5 after:to-transparent after:animate-[shimmer_1.5s_infinite_linear]" />
                                    )}
                                    <span className="text-[10px] font-semibold text-slate-400 text-center leading-[1.2] max-w-[64px] overflow-hidden text-ellipsis whitespace-nowrap">{hero.localized_name}</span>
                                </Button>
                            ))}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
