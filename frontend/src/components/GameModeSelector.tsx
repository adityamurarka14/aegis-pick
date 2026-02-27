'use client';

import { GameMode, useDraftStore } from '@/lib/store';
import { Button } from '@/components/ui/button';

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
        <div className="flex flex-col md:flex-row gap-6 md:gap-10 justify-between p-8 md:p-10 bg-black/40 backdrop-blur-xl border border-white/10 rounded-[24px] shadow-[0_8px_32px_0_rgba(0,0,0,0.4)] transition-all hover:border-white/20" style={{ padding: '10px', borderRadius: '10px' }}>
            {/* Game Mode / Bracket Flex wrapper */}
            <div className="flex flex-col sm:flex-row gap-6 md:gap-10 flex-1">
                {/* Game Mode */}
                <div>
                    <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] mb-3"
                        style={{ color: 'var(--text-muted)', fontSize: 'large' }}>
                        Game Mode
                    </h2>
                    <div className="flex gap-2 flex-wrap">
                        {MODES.map((m) => (
                            <Button
                                key={m.key}
                                variant="outline"
                                className={`px-[18px] py-2 h-auto rounded-3xl border text-[13px] font-semibold cursor-pointer transition-all duration-200 bg-transparent
                                ${gameMode === m.key
                                        ? 'bg-gradient-to-b from-blue-400/30 to-blue-500/20 border-blue-400 text-white shadow-[0_0_15px_rgba(96,165,250,0.3)] hover:bg-blue-500/30 hover:text-white'
                                        : 'border-white/15 text-white hover:border-white/30 hover:bg-white/10'
                                    }`}
                                onClick={() => setGameMode(m.key)}
                            >
                                {m.label}
                                <span className={`ml-1.5 text-[10px] ${gameMode === m.key ? 'opacity-80' : 'opacity-40'}`}>
                                    ({m.bans})
                                </span>
                            </Button>
                        ))}
                    </div>
                </div>

                {/* Bracket */}
                <div>
                    <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] mb-3"
                        style={{ color: 'var(--text-muted)', fontSize: 'large' }}>
                        MMR Bracket
                    </h2>
                    <div className="flex gap-2 flex-wrap">
                        {BRACKETS.map((b) => (
                            <Button
                                key={b}
                                variant="outline"
                                className={`px-4 h-auto py-1.5 rounded-[20px] border text-[13px] font-semibold cursor-pointer transition-all duration-200 capitalize bg-transparent
                                ${bracket === b
                                        ? 'bg-blue-400/25 border-blue-400 text-white shadow-[0_0_12px_rgba(96,165,250,0.3)] hover:bg-blue-400/30 hover:text-white'
                                        : 'border-white/15 text-white hover:border-white/30 hover:bg-white/10'
                                    }`}
                                onClick={() => setBracket(b)}
                            >
                                {b}
                            </Button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Region + Reset */}
            <div className="flex flex-col justify-between items-start md:items-end gap-4 min-w-[200px]">
                <div className="w-full">
                    <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] mb-3 md:text-right"
                        style={{ color: 'var(--text-muted)', fontSize: 'large' }}>
                        Region
                    </h2>
                    <div className="flex gap-2 flex-wrap md:justify-end">
                        {REGIONS.map((r) => (
                            <Button
                                key={r.key}
                                variant="outline"
                                className={`px-4 py-1.5 h-auto rounded-[20px] border text-[13px] font-semibold cursor-pointer transition-all duration-200 capitalize bg-transparent
                                ${region === r.key
                                        ? 'bg-blue-400/25 border-blue-400 text-white shadow-[0_0_12px_rgba(96,165,250,0.3)] hover:bg-blue-400/30 hover:text-white'
                                        : 'border-white/15 text-white hover:border-white/30 hover:bg-white/10'
                                    }`}
                                onClick={() => setRegion(r.key)}
                            >
                                {r.label}
                            </Button>
                        ))}
                    </div>
                </div>
                <Button
                    variant="outline"
                    onClick={resetDraft}
                    className="h-auto text-[11px] font-semibold uppercase tracking-wider px-4 py-2 rounded-lg transition-all border-red-500/30 text-slate-400 bg-red-500/5 hover:bg-red-500/15 hover:text-white hover:border-red-500/80"
                >
                    Reset Draft
                </Button>
            </div>
        </div>
    );
}
