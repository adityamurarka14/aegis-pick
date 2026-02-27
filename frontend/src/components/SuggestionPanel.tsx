'use client';

import Image from 'next/image';
import { Suggestion, useDraftStore } from '@/lib/store';

/** Props for the ConfidenceBadge component. */
interface ConfidenceBadgeProps {
    label: 'High' | 'Moderate' | 'Low';
    value: number;
}

/** 
 * Renders a small badge showing the system's confidence in a specific rating. 
 * Colored dynamically based on the label. 
 */
function ConfidenceBadge({ label, value }: ConfidenceBadgeProps) {
    const colorClass =
        label === 'High' ? 'text-green-400 bg-green-500/10 border-green-500/30'
            : label === 'Moderate' ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
                : 'text-red-400 bg-red-500/10 border-red-500/30';
    return (
        <span
            className={`text-[9px] font-bold px-1.5 py-0.5 rounded-sm border whitespace-nowrap ${colorClass}`}
        >
            {value}%
        </span>
    );
}

/**
 * Visual gradient bar representing the counterpick score numerically.
 * Maps score ranges (0.45 - ~0.65) to CSS percentage values.
 */
function ScoreBar({ score }: { score: number }) {
    // score is 0.5 (neutral) to ~0.65 (strong counter)
    const pct = Math.max(0, Math.min(100, ((score - 0.45) / 0.25) * 100));
    return (
        <div className="w-full h-1 mt-2 rounded-full overflow-hidden"
            style={{ background: 'var(--bg-gradient-start)' }}>
            <div
                className="h-full rounded-full transition-all"
                style={{
                    width: `${pct}%`,
                    background: pct > 65 ? 'var(--high)' : pct > 35 ? 'var(--moderate)' : 'var(--low)',
                }}
            />
        </div>
    );
}

/** Props for the SuggestionPanel component. */
interface SuggestionPanelProps {
    suggestions: Suggestion[];
    isFetching: boolean;
    hasEnemies: boolean;
}

/**
 * The main panel that displays counterpick suggestions categorised by pos/role.
 * Uses draft state to handle "assigning" suggestions directly to empty slots.
 */
export default function SuggestionPanel({
    suggestions,
    isFetching,
    hasEnemies,
}: SuggestionPanelProps) {
    const { addSuggestion, winProbability } = useDraftStore();

    if (winProbability !== null) {
        const winPct = (winProbability * 100).toFixed(1);
        const winColor = winProbability > 0.52 ? 'text-green-400' : winProbability < 0.48 ? 'text-red-400' : 'text-amber-400';
        return (
            <div className="flex flex-col items-center justify-center gap-4 min-h-[160px] p-8 bg-black/40 backdrop-blur-xl border border-white/10 rounded-[24px] shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] transition-all hover:border-white/20">
                <span className="text-5xl">🏆</span>
                <div className="text-center">
                    <h2 className="text-lg font-display font-bold tracking-widest uppercase mb-1" style={{ color: 'var(--text-primary)' }}>
                        Draft Complete
                    </h2>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
                        Expected Win Probability: <span className={`text-xl ml-1 ${winColor} drop-shadow-md`}>{winPct}%</span>
                    </p>
                </div>
            </div>
        );
    }

    if (!hasEnemies && !isFetching) {
        return (
            <div className="flex flex-col items-center justify-center gap-2 min-h-[120px] p-6 bg-black/40 backdrop-blur-xl border border-white/10 rounded-[24px] shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] transition-all hover:border-white/20">
                <span className="text-4xl opacity-20">🎯</span>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    Pick enemy heroes to get counterpick suggestions
                </p>
            </div>
        );
    }

    const attrToRole: Record<string, { label: string; color: string }> = {
        agi: { label: 'Pos 1 Carry (Agi)', color: '#32FF7A' },
        all: { label: 'Pos 2 Mid (Univ)', color: '#FFB900' },
        str: { label: 'Pos 3 Off (Str)', color: '#FF4131' },
        int: { label: 'Pos 4/5 Supp (Int)', color: '#00A4FF' }
    };

    const grouped = suggestions.reduce((acc, s) => {
        const group = s.primary_attr || 'all';
        if (!acc[group]) acc[group] = [];
        acc[group].push(s);
        return acc;
    }, {} as Record<string, Suggestion[]>);

    // Sort order for groups: AGI, ALL, STR, INT (Pos 1 to Pos 4/5)
    const groupOrder = ['agi', 'all', 'str', 'int'];

    return (
        <div className="overflow-hidden bg-black/40 backdrop-blur-xl border border-white/10 rounded-[24px] shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] transition-all hover:border-white/20" style={{ padding: '10px', borderRadius: '10px' }}>
            <div className="px-5 py-4 border-b flex items-center gap-3 bg-black/20"
                style={{ borderColor: 'var(--border)' }}>
                <span className="font-display text-sm font-bold tracking-widest uppercase"
                    style={{ color: 'var(--text-primary)', marginBottom: '10px' }}>
                    Suggested Counterpicks
                </span>
                {isFetching && (
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-transparent border-t-blue-500 animate-spin" />
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 p-6 md:p-8" style={{ margin: '10px 0px' }}>
                {isFetching && suggestions.length === 0 ? (
                    Array.from({ length: 4 }).map((_, colIdx) => (
                        <div key={colIdx} className="flex flex-col gap-3">
                            <div className="h-4 w-1/2 rounded mb-2 bg-[#131826] relative overflow-hidden after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-white/5 after:to-transparent after:animate-[shimmer_1.5s_infinite_linear]" />
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="flex gap-3 items-center p-2 rounded-lg bg-white/5 border border-white/5">
                                    <div className="w-14 h-9 rounded shrink-0 bg-[#131826] relative overflow-hidden after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-white/5 after:to-transparent after:animate-[shimmer_1.5s_infinite_linear]" />
                                    <div className="flex-1 flex flex-col gap-1.5 align-middle">
                                        <div className="h-3 w-2/3 rounded bg-[#131826] relative overflow-hidden after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-white/5 after:to-transparent after:animate-[shimmer_1.5s_infinite_linear]" />
                                        <div className="h-2 w-full rounded bg-[#131826] relative overflow-hidden after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-white/5 after:to-transparent after:animate-[shimmer_1.5s_infinite_linear]" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))
                ) : (
                    groupOrder.map((attr) => (
                        <div key={attr} className="flex flex-col gap-3">
                            {/* Role Group Header */}
                            <div className="flex items-center gap-2 mb-1">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: attrToRole[attr].color, opacity: 0.8, boxShadow: `0 0 10px ${attrToRole[attr].color}80` }} />
                                <h4 className="font-display text-[13px] font-bold tracking-wider uppercase text-white/90">
                                    {attrToRole[attr].label}
                                </h4>
                                <span className="text-[10px] text-white/30 ml-auto">
                                    ({grouped[attr]?.length || 0})
                                </span>
                            </div>

                            {/* Group List */}
                            <div className="flex flex-col gap-2">
                                {grouped[attr]?.map((s) => {
                                    const isTopOverall = suggestions[0]?.id === s.id;
                                    return (
                                        <div
                                            key={s.id}
                                            className={`group relative flex items-center gap-3 p-2 rounded-lg bg-black/20 hover:bg-white/10 ${isTopOverall ? 'border border-blue-500/30 ring-1 ring-blue-500/20' : 'border border-white/5'} transition-all`}
                                            title="Hover to Quick Add!"
                                        >
                                            {/* Thumbnail + Quick Add Overlay */}
                                            <div className="relative w-14 h-9 shrink-0 rounded overflow-hidden shadow-md">
                                                <Image
                                                    src={s.img}
                                                    alt={s.localized_name}
                                                    fill
                                                    className="object-cover pointer-events-none"
                                                    unoptimized
                                                />
                                                {/* Hover Add Button (stops drag event bubbling) */}
                                                <button
                                                    onClick={() => addSuggestion(s, attr)}
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                    className="absolute inset-0 bg-blue-600/90 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 cursor-pointer"
                                                    title="Add to Draft"
                                                >
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                        <line x1="12" y1="5" x2="12" y2="19"></line>
                                                        <line x1="5" y1="12" x2="19" y2="12"></line>
                                                    </svg>
                                                </button>
                                            </div>

                                            {/* Info Block (pointer-events-none so dragging the card body works smoothly) */}
                                            <div className="flex-1 min-w-0 flex flex-col pointer-events-none">
                                                <div className="flex justify-between items-center mb-0.5 gap-2">
                                                    <span className={`text-[13px] font-bold truncate ${isTopOverall ? 'text-blue-400' : 'text-gray-100'}`}>
                                                        {s.localized_name}
                                                    </span>
                                                    <ConfidenceBadge label={s.confidence_label} value={s.confidence_value} />
                                                </div>
                                                <span className="text-[10px] text-gray-400 truncate w-full mb-1 leading-tight">
                                                    {s.reason}
                                                </span>
                                                <ScoreBar score={s.score} />
                                            </div>
                                        </div>
                                    );
                                })}
                                {(!grouped[attr] || grouped[attr].length === 0) && !isFetching && (
                                    <div className="text-[11px] text-white/20 italic py-2">No top counters found for this role.</div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
