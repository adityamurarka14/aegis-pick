'use client';

import Image from 'next/image';
import { useDraftStore, Hero } from '@/lib/store';
import type { FacetMap } from '@/lib/api';
import FacetPicker from '@/components/FacetPicker';

type Side = 'ally' | 'enemy';

/** Props for a single hero slot card in the draft grid. */
function HeroSlotCard({
    hero,
    facetId,
    side,
    idx,
    allFacets,
}: {
    hero: Hero | null;
    facetId: number;
    side: Side;
    idx: number;
    allFacets: FacetMap;
}) {
    const {
        openSearch, removeAllyHero, removeEnemyHero,
        setAllyFacet, setEnemyFacet,
    } = useDraftStore();

    const handleRemove = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (side === 'ally') removeAllyHero(idx);
        else removeEnemyHero(idx);
    };

    const handleFacetChange = (newFacetId: number) => {
        if (side === 'ally') setAllyFacet(idx, newFacetId);
        else setEnemyFacet(idx, newFacetId);
    };

    const handleDragStart = (e: React.DragEvent) => {
        if (!hero) return;
        // Identify this drag as coming from a slot
        e.dataTransfer.setData('application/json', JSON.stringify({ type: 'slot', side, idx }));
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault(); // allow drop
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        try {
            const data = JSON.parse(e.dataTransfer.getData('application/json'));

            // Allow slot swapping on the SAME side
            if (data.type === 'slot' && data.side === side) {
                if (data.idx !== idx) {
                    useDraftStore.getState().swapSlots(side, data.idx, idx);
                }
            }
            // Allow dropping a suggestion onto an ALLY slot
            else if (data.type === 'suggestion' && side === 'ally') {
                // If dropping suggestion onto an existing hero, it replaces it. 
                useDraftStore.getState().assignSuggestion(data.hero, idx);
            }
        } catch (err) {
            console.error('Drop error:', err);
        }
    };

    // Get facets for this specific hero from the global facet map
    const heroFacets = hero ? (allFacets[String(hero.id)] ?? []) : [];

    return (
        <div
            className={`group flex flex-col items-center justify-center rounded-[10px] border border-white/10 relative overflow-visible cursor-pointer transition-all duration-300 ease-in-out hover:-translate-y-1 hover:scale-[102%] z-10 hover:z-20 ${side === 'ally' ? 'hover:shadow-[0_10px_25px_-5px_rgba(59,130,246,0.25),0_0_15px_rgba(59,130,246,0.25)]' : 'hover:shadow-[0_10px_25px_-5px_rgba(239,68,68,0.25),0_0_15px_rgba(239,68,68,0.25)]'}`}
            style={{
                width: 145, height: 120,
                background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
                backdropFilter: 'blur(10px)'
            }}
            onClick={() => !hero && openSearch(side, idx)}
            draggable={!!hero}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            {/* Hover border glow using an absolute pseudo-element equivalent */}
            <div className={`absolute inset-0 rounded-[10px] pointer-events-none transition-shadow duration-300 ${side === 'ally' ? 'group-hover:shadow-[inset_0_0_0_1.5px_#3b82f6]' : 'group-hover:shadow-[inset_0_0_0_1.5px_#ef4444]'}`} />

            {hero ? (
                <>
                    <Image
                        src={hero.img}
                        alt={hero.localized_name}
                        fill
                        className="object-cover rounded-lg pointer-events-none"
                        unoptimized
                    />

                    {/* Hover Overlay - Click entire area to remove */}
                    <div
                        className="absolute inset-0 bg-red-900/80 backdrop-blur-sm opacity-0 hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer rounded-lg"
                        onClick={handleRemove}
                        title="Remove Hero"
                    >
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                        <span className="text-white font-bold text-xs mt-2 uppercase tracking-wider">Remove</span>
                    </div>

                    {/* Facet picker — shown below slot when facets are loaded */}
                    {heroFacets.length > 1 && (
                        <div
                            style={{
                                position: 'absolute',
                                bottom: '-26px',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                zIndex: 120,
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <FacetPicker
                                facets={heroFacets}
                                selectedFacetId={facetId}
                                onChange={handleFacetChange}
                            />
                        </div>
                    )}
                </>
            ) : (
                <div className="flex flex-col items-center justify-center opacity-40 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <div className="text-3xl font-light mb-1">+</div>
                    <span className="text-[10px] uppercase tracking-[0.15em] font-medium"
                        style={{ color: 'var(--text-muted)' }}>
                        Pos {idx + 1}
                    </span>
                </div>
            )}
        </div>
    );
}

function TeamGrid({ side, label, allFacets }: { side: Side; label: string; allFacets: FacetMap }) {
    const { allySlots, enemySlots } = useDraftStore();
    const slots = side === 'ally' ? allySlots : enemySlots;
    const isAlly = side === 'ally';

    return (
        <div className="flex-1 flex flex-col relative overflow-visible rounded-[24px] border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] transition-colors hover:border-white/20 p-10 md:p-12"
            style={{ background: 'rgba(15, 20, 35, 0.4)', backdropFilter: 'blur(20px)', padding: '10px', borderRadius: '10px', height: '100%' }}>
            {/* Subtle background glow for the team grid */}
            <div className="absolute top-0 opacity-20 pointer-events-none"
                style={{
                    background: `radial-gradient(circle at 50% 0%, ${isAlly ? 'var(--ally-color)' : 'var(--enemy-color)'} 0%, transparent 70%)`,
                    width: '100%', height: '150px',
                    left: 0
                }}
            />

            <div className="flex items-center justify-between mb-8 z-10">
                <h3 className="text-xl font-display font-bold tracking-widest uppercase"
                    style={{ color: isAlly ? 'var(--ally-color)' : 'var(--enemy-color)', marginBottom: '10px' }}>
                    {label}
                </h3>
                <div className="h-px flex-1 ml-4"
                    style={{ background: `linear-gradient(90deg, ${isAlly ? 'var(--ally-color)' : 'var(--enemy-color)'} 0%, transparent 100%)`, opacity: 0.3 }} />
            </div>

            <div className="flex gap-6 md:gap-8 justify-center flex-wrap z-10" style={{ paddingBottom: '36px' }}>
                {slots.map((slot, i) => (
                    <HeroSlotCard
                        key={i}
                        hero={slot.hero}
                        facetId={slot.facetId}
                        side={side}
                        idx={i}
                        allFacets={allFacets}
                    />
                ))}
            </div>
        </div>
    );
}

/**
 * DraftBoard — renders the 5v5 draft grid with role badges and facet pickers.
 */
export default function DraftBoard({ allFacets = {} }: { allFacets?: FacetMap }) {
    return (
        <div className="flex flex-col md:flex-row gap-6 w-full">
            <TeamGrid side="ally" label="Your Team" allFacets={allFacets} />
            <TeamGrid side="enemy" label="Enemy Team" allFacets={allFacets} />
        </div>
    );
}
