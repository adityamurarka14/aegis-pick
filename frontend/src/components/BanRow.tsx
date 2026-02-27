'use client';

import Image from 'next/image';
import { useDraftStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const MODE_BAN_COUNTS = { ranked: 16, cm: 14, turbo: 10 } as const;

export default function BanRow() {
    const { gameMode, bannedHeroes, openSearch, removeBan } = useDraftStore();
    const maxBans = MODE_BAN_COUNTS[gameMode];

    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 px-8 py-6 bg-black/40 backdrop-blur-xl border border-white/10 rounded-[24px] shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] transition-all hover:border-white/20" style={{ padding: '10px', borderRadius: '10px' }}>
            <div className="flex items-center gap-3 flex-wrap flex-1">
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] mr-2"
                    style={{ color: 'var(--text-secondary)', fontSize: 'large' }}>
                    Bans
                    <span className="ml-1.5 opacity-40 font-normal">({bannedHeroes.length}/{maxBans})</span>
                </span>

                <div className="flex gap-2 flex-wrap">
                    {bannedHeroes.map((hero) => (
                        <Button
                            key={hero.id}
                            variant="outline"
                            className="group h-auto flex items-center gap-1.5 bg-black/40 border border-amber-500/20 rounded-lg px-2.5 py-1 text-xs font-medium cursor-pointer transition-all shadow-sm hover:border-amber-500 hover:bg-amber-500/10 hover:shadow-[0_4px_12px_rgba(245,158,11,0.25)] hover:-translate-y-px"
                            onClick={() => removeBan(hero.id)}
                            title={`Remove ban: ${hero.localized_name}`}
                        >
                            {hero.img && (
                                <Image
                                    src={hero.img}
                                    alt={hero.localized_name}
                                    width={20}
                                    height={20}
                                    className="rounded-[4px] object-cover"
                                    unoptimized
                                />
                            )}
                            <span style={{ color: 'var(--text-primary)' }}>
                                {hero.localized_name}
                            </span>
                            <span className="text-red-400 font-bold ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                ✕
                            </span>
                        </Button>
                    ))}

                    {bannedHeroes.length < maxBans && (
                        <Button
                            variant="outline"
                            className="flex h-auto items-center gap-1.5 bg-transparent border border-dashed border-white/25 rounded-lg px-2.5 py-1 text-xs font-medium cursor-pointer transition-all hover:bg-white/5 hover:border-amber-500 hover:shadow-[0_4px_12px_rgba(245,158,11,0.25)] hover:-translate-y-px"
                            onClick={() => openSearch('ban', 0)}
                        >
                            <span className="text-amber-500 font-bold ml-1">+</span>
                            <span style={{ color: 'var(--text-secondary)' }} className="mr-1">Add Ban</span>
                        </Button>
                    )}
                </div>
            </div>

            {gameMode === 'cm' && (
                <div className="flex items-center">
                    <Badge variant="outline" className="text-[10px] font-medium tracking-widest uppercase bg-white/5 px-3 py-1.5 rounded text-gray-400 border-white/10">
                        CM Phase: 3+2+2 / 4+1+2
                    </Badge>
                </div>
            )}
        </div>
    );
}
