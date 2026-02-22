'use client';

import Image from 'next/image';
import { Suggestion } from '@/lib/store';

interface ConfidenceBadgeProps {
    label: 'High' | 'Moderate' | 'Low';
    value: number;
}

function ConfidenceBadge({ label, value }: ConfidenceBadgeProps) {
    const cls =
        label === 'High'
            ? 'badge-high'
            : label === 'Moderate'
                ? 'badge-moderate'
                : 'badge-low';
    return (
        <span
            className={`${cls} text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap`}
        >
            {value}% {label}
        </span>
    );
}

function ScoreBar({ score }: { score: number }) {
    // score is 0.5 (neutral) to ~0.65 (strong counter)
    const pct = Math.max(0, Math.min(100, ((score - 0.45) / 0.25) * 100));
    return (
        <div className="w-16 h-1.5 rounded-full overflow-hidden"
            style={{ background: 'var(--border)' }}>
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

interface SuggestionPanelProps {
    suggestions: Suggestion[];
    isFetching: boolean;
    hasEnemies: boolean;
}

export default function SuggestionPanel({
    suggestions,
    isFetching,
    hasEnemies,
}: SuggestionPanelProps) {
    if (!hasEnemies && !isFetching) {
        return (
            <div className="glass p-6 flex flex-col items-center justify-center gap-2 min-h-[120px]">
                <span className="text-4xl opacity-20">🎯</span>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    Pick enemy heroes to get counterpick suggestions
                </p>
            </div>
        );
    }

    return (
        <div className="glass overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center gap-2"
                style={{ borderColor: 'var(--border)' }}>
                <span className="font-display text-sm font-semibold tracking-wide uppercase"
                    style={{ color: 'var(--text-secondary)' }}>
                    Suggested Counterpicks
                </span>
                {isFetching && (
                    <div className="w-3 h-3 rounded-full border-2 border-transparent animate-spin"
                        style={{ borderTopColor: 'var(--accent)' }} />
                )}
            </div>

            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {isFetching && suggestions.length === 0
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="suggestion-row">
                            <div className="skeleton" style={{ width: 44, height: 44, borderRadius: 6 }} />
                            <div className="flex flex-col gap-2">
                                <div className="skeleton" style={{ width: 90, height: 10 }} />
                                <div className="skeleton" style={{ width: 140, height: 8 }} />
                            </div>
                            <div className="skeleton" style={{ width: 60, height: 10 }} />
                            <div className="skeleton" style={{ width: 70, height: 18, borderRadius: 9 }} />
                        </div>
                    ))
                    : suggestions.map((s, i) => (
                        <div key={s.id} className="suggestion-row" style={{
                            background: i === 0 ? 'rgba(91,127,255,0.04)' : undefined
                        }}>
                            {/* Portrait */}
                            <div className="relative" style={{ width: 44, height: 44 }}>
                                <Image
                                    src={s.img}
                                    alt={s.localized_name}
                                    fill
                                    className="suggestion-portrait object-cover"
                                    unoptimized
                                />
                                {i === 0 && (
                                    <span className="absolute -top-1 -left-1 text-[9px] font-bold px-1 rounded"
                                        style={{ background: 'var(--accent)', color: '#fff' }}>
                                        #1
                                    </span>
                                )}
                            </div>

                            {/* Name + Reason */}
                            <div className="min-w-0">
                                <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                                    {s.localized_name}
                                </p>
                                <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                                    {s.reason}
                                </p>
                            </div>

                            {/* Score bar */}
                            <ScoreBar score={s.score} />

                            {/* Confidence badge */}
                            <ConfidenceBadge label={s.confidence_label} value={s.confidence_value} />
                        </div>
                    ))}
            </div>
        </div>
    );
}
