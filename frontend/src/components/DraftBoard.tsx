'use client';

import Image from 'next/image';
import { useDraftStore, Role, Hero } from '@/lib/store';
import type { FacetMap } from '@/lib/api';
import FacetPicker from '@/components/FacetPicker';

type Side = 'ally' | 'enemy';

const ROLE_LABELS: Record<string, string> = {
    carry: 'Carry',
    mid: 'Mid',
    offlane: 'Offlane',
    soft_support: 'Supp',
    hard_support: 'Hard Sup',
};

const ROLE_CYCLE: Role[] = [
    'carry', 'mid', 'offlane', 'soft_support', 'hard_support', null,
];

/** Props for a single hero slot card in the draft grid. */
function HeroSlotCard({
    hero,
    role,
    facetId,
    side,
    idx,
    allFacets,
}: {
    hero: Hero | null;
    role: Role;
    facetId: number;
    side: Side;
    idx: number;
    allFacets: FacetMap;
}) {
    const {
        openSearch, removeAllyHero, removeEnemyHero,
        setAllyRole, setAllyFacet, setEnemyFacet,
    } = useDraftStore();

    const handleRoleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (side !== 'ally') return;
        const current = ROLE_CYCLE.indexOf(role);
        const next = ROLE_CYCLE[(current + 1) % ROLE_CYCLE.length];
        setAllyRole(idx, next);
    };

    const handleRemove = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (side === 'ally') removeAllyHero(idx);
        else removeEnemyHero(idx);
    };

    const handleFacetChange = (newFacetId: number) => {
        if (side === 'ally') setAllyFacet(idx, newFacetId);
        else setEnemyFacet(idx, newFacetId);
    };

    // Get facets for this specific hero from the global facet map
    const heroFacets = hero ? (allFacets[String(hero.id)] ?? []) : [];

    return (
        <div
            className={`hero-slot ${side} flex flex-col`}
            onClick={() => !hero && openSearch(side, idx)}
            style={{ position: 'relative' }}
        >
            {hero ? (
                <>
                    <Image
                        src={hero.img}
                        alt={hero.localized_name}
                        fill
                        className="object-cover rounded-lg"
                        unoptimized
                    />
                    {/* Overlay on hover */}
                    <div className="absolute inset-0 rounded-lg opacity-0 hover:opacity-100 transition-opacity
                          flex flex-col items-center justify-between p-1"
                        style={{ background: 'rgba(0,0,0,0.55)' }}>
                        <button
                            className="self-end text-red-400 text-xs font-bold leading-none"
                            onClick={handleRemove}
                        >
                            ✕
                        </button>
                        {side === 'ally' && (
                            <button className="role-badge" onClick={handleRoleClick}>
                                {role ? ROLE_LABELS[role] : 'Role?'}
                            </button>
                        )}
                    </div>

                    {/* Role badge — always visible bottom */}
                    {side === 'ally' && role && (
                        <span
                            className="absolute bottom-1 left-1/2 -translate-x-1/2 role-badge"
                            onClick={handleRoleClick}
                            style={{ pointerEvents: 'auto', zIndex: 5 }}
                        >
                            {ROLE_LABELS[role]}
                        </span>
                    )}

                    {/* Facet picker — shown below slot when facets are loaded */}
                    {heroFacets.length > 1 && (
                        <div
                            style={{
                                position: 'absolute',
                                bottom: '-22px',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                zIndex: 10,
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
                <>
                    <div className="text-2xl opacity-10">+</div>
                    <span className="text-[9px] uppercase tracking-widest mt-1"
                        style={{ color: 'var(--text-muted)' }}>
                        Pos {idx + 1}
                    </span>
                </>
            )}
        </div>
    );
}

function TeamGrid({ side, label, allFacets }: { side: Side; label: string; allFacets: FacetMap }) {
    const { allySlots, enemySlots } = useDraftStore();
    const slots = side === 'ally' ? allySlots : enemySlots;
    const borderColor = side === 'ally' ? 'var(--ally-color)' : 'var(--enemy-color)';

    return (
        <div className="flex-1 glass p-4">
            <p
                className="text-xs font-semibold uppercase tracking-widest mb-3"
                style={{ color: borderColor }}
            >
                {label}
            </p>
            <div className="flex gap-2 justify-center flex-wrap" style={{ paddingBottom: '24px' }}>
                {slots.map((slot, i) => (
                    <HeroSlotCard
                        key={i}
                        hero={slot.hero}
                        role={slot.role}
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
 *
 * @param allFacets - Global facet map (hero ID → facets[]), passed from the page
 *                    to avoid repeated fetches. Loaded with 30-day localStorage TTL.
 */
export default function DraftBoard({ allFacets = {} }: { allFacets?: FacetMap }) {
    return (
        <div className="flex gap-3">
            <TeamGrid side="ally" label="Your Team" allFacets={allFacets} />
            <TeamGrid side="enemy" label="Enemy Team" allFacets={allFacets} />
        </div>
    );
}
