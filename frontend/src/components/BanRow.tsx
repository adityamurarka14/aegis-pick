'use client';

import Image from 'next/image';
import { useDraftStore } from '@/lib/store';

const MODE_BAN_COUNTS = { ranked: 16, cm: 14, turbo: 10 } as const;

export default function BanRow() {
    const { gameMode, bannedHeroes, openSearch, removeBan } = useDraftStore();
    const maxBans = MODE_BAN_COUNTS[gameMode];

    return (
        <div className="glass px-4 py-3">
            <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold uppercase tracking-widest mr-1"
                    style={{ color: 'var(--text-muted)' }}>
                    Bans
                    <span className="ml-1.5 opacity-50">({bannedHeroes.length}/{maxBans})</span>
                </span>

                {bannedHeroes.map((hero) => (
                    <button
                        key={hero.id}
                        className="ban-chip group"
                        onClick={() => removeBan(hero.id)}
                        title={`Remove ban: ${hero.localized_name}`}
                    >
                        {hero.img && (
                            <Image
                                src={hero.img}
                                alt={hero.localized_name}
                                width={18}
                                height={18}
                                className="rounded-sm object-cover"
                                style={{ width: 18, height: 18 }}
                                unoptimized
                            />
                        )}
                        <span style={{ color: 'var(--text-secondary)' }}>
                            {hero.localized_name}
                        </span>
                        <span className="text-red-400 font-bold ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            ✕
                        </span>
                    </button>
                ))}

                {bannedHeroes.length < maxBans && (
                    <button
                        className="ban-chip"
                        style={{ borderStyle: 'dashed', color: 'var(--text-secondary)' }}
                        onClick={() => openSearch('ban', 0)}
                    >
                        <span className="text-amber-400 font-bold">+</span>
                        <span>Ban</span>
                    </button>
                )}

                {gameMode === 'cm' && (
                    <span className="ml-auto text-xs" style={{ color: 'var(--text-muted)' }}>
                        CM phase: 3+2+2 / 4+1+2
                    </span>
                )}
            </div>
        </div>
    );
}
