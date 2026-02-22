'use client';

import { GameMode, useDraftStore } from '@/lib/store';

const MODES: { key: GameMode; label: string; bans: string }[] = [
    { key: 'ranked', label: 'Ranked', bans: '16 bans' },
    { key: 'cm', label: 'Captains Mode', bans: '7/side' },
    { key: 'turbo', label: 'Turbo', bans: '1/player' },
];

const BRACKETS = [
    'herald', 'guardian', 'crusader', 'archon',
    'legend', 'ancient', 'divine', 'immortal',
] as const;

const REGIONS = [
    { key: 'SEA', label: 'SEA' },
    { key: 'CN', label: 'CN' },
    { key: 'EU', label: 'EU' },
    { key: 'NA', label: 'NA' },
    { key: 'SA', label: 'SA' },
    { key: 'EEU', label: 'EEU' },
    { key: 'ME', label: 'ME' },
] as const;

export default function GameModeSelector() {
    const { gameMode, bracket, region, setGameMode, setBracket, setRegion, resetDraft } =
        useDraftStore();

    return (
        <div className="glass p-4 flex flex-col gap-4">
            {/* Game Mode */}
            <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-2"
                    style={{ color: 'var(--text-muted)' }}>
                    Game Mode
                </p>
                <div className="flex gap-2 flex-wrap">
                    {MODES.map((m) => (
                        <button
                            key={m.key}
                            className={`mode-pill ${gameMode === m.key ? 'active' : ''}`}
                            onClick={() => setGameMode(m.key)}
                        >
                            {m.label}
                            <span className="ml-1 opacity-50 text-[10px]">({m.bans})</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Bracket */}
            <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-2"
                    style={{ color: 'var(--text-muted)' }}>
                    MMR Bracket
                </p>
                <div className="flex gap-1.5 flex-wrap">
                    {BRACKETS.map((b) => (
                        <button
                            key={b}
                            className={`bracket-pill ${bracket === b ? 'active' : ''}`}
                            onClick={() => setBracket(b)}
                        >
                            {b}
                        </button>
                    ))}
                </div>
            </div>

            {/* Region + Reset */}
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-widest mb-2"
                        style={{ color: 'var(--text-muted)' }}>
                        Region
                    </p>
                    <div className="flex gap-1.5 flex-wrap">
                        {REGIONS.map((r) => (
                            <button
                                key={r.key}
                                className={`bracket-pill ${region === r.key ? 'active' : ''}`}
                                onClick={() => setRegion(r.key)}
                            >
                                {r.label}
                            </button>
                        ))}
                    </div>
                </div>
                <button
                    onClick={resetDraft}
                    className="text-xs px-3 py-1.5 rounded-lg border transition-all hover:bg-white/5"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                >
                    Reset Draft
                </button>
            </div>
        </div>
    );
}
