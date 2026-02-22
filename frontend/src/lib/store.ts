import { create } from 'zustand';

export type GameMode = 'ranked' | 'cm' | 'turbo';
export type Bracket =
    | 'herald' | 'guardian' | 'crusader' | 'archon'
    | 'legend' | 'ancient' | 'divine' | 'immortal';
export type Region = 'SEA' | 'CN' | 'EU' | 'NA' | 'SA' | 'EEU' | 'ME';
export type Role = 'carry' | 'mid' | 'offlane' | 'soft_support' | 'hard_support' | null;

export interface Hero {
    id: number;
    localized_name: string;
    img: string;
    icon?: string;
    primary_attr?: string;
}

/** A single facet option for a hero (from /api/facets). */
export interface HeroFacet {
    id: number;           // 0-indexed within hero's facets array
    title: string;
    description: string;
    color: string;        // "Red" | "Blue" | "Green" | "Purple" | "Yellow" | "Gray"
    icon?: string;
}

export interface Suggestion {
    id: number;
    localized_name: string;
    img: string;
    score: number;
    confidence_value: number;
    confidence_label: 'High' | 'Moderate' | 'Low';
    reason: string;
    facet_note?: string;  // optional kit-changing facet note from backend
}

export interface HeroSlot {
    hero: Hero | null;
    role: Role;
    /**
     * facetId: which facet index (0-based) the hero is running.
     * Defaults to 0 (first facet, the game's default).
     * Only meaningful when hero != null.
     */
    facetId: number;
}

interface DraftState {
    // Settings
    gameMode: GameMode;
    bracket: Bracket;
    region: Region;
    locale: string;

    // Draft
    allySlots: HeroSlot[]; // 5 slots
    enemySlots: HeroSlot[]; // 5 slots
    bannedHeroes: Hero[];

    // Suggestions
    suggestions: Suggestion[];
    isFetching: boolean;

    // Hero search modal
    searchOpen: boolean;
    searchTarget: { side: 'ally' | 'enemy' | 'ban'; slotIdx: number } | null;

    // Actions
    setGameMode: (m: GameMode) => void;
    setBracket: (b: Bracket) => void;
    setRegion: (r: Region) => void;
    setLocale: (l: string) => void;

    openSearch: (side: 'ally' | 'enemy' | 'ban', slotIdx: number) => void;
    closeSearch: () => void;
    pickHero: (hero: Hero) => void;
    removeAllyHero: (idx: number) => void;
    removeEnemyHero: (idx: number) => void;
    setAllyRole: (idx: number, role: Role) => void;
    setAllyFacet: (idx: number, facetId: number) => void;
    setEnemyFacet: (idx: number, facetId: number) => void;
    addBan: (hero: Hero) => void;
    removeBan: (heroId: number) => void;

    setSuggestions: (s: Suggestion[]) => void;
    setFetching: (v: boolean) => void;

    resetDraft: () => void;
}

const makeSlots = (n: number): HeroSlot[] =>
    Array.from({ length: n }, () => ({ hero: null, role: null, facetId: 0 }));

export const useDraftStore = create<DraftState>((set, get) => ({
    gameMode: 'ranked',
    bracket: 'immortal',
    region: 'SEA',
    locale: 'en',

    allySlots: makeSlots(5),
    enemySlots: makeSlots(5),
    bannedHeroes: [],

    suggestions: [],
    isFetching: false,

    searchOpen: false,
    searchTarget: null,

    setGameMode: (m) => set({ gameMode: m }),
    setBracket: (b) => set({ bracket: b }),
    setRegion: (r) => set({ region: r }),
    setLocale: (l) => set({ locale: l }),

    openSearch: (side, slotIdx) =>
        set({ searchOpen: true, searchTarget: { side, slotIdx } }),
    closeSearch: () => set({ searchOpen: false, searchTarget: null }),

    pickHero: (hero) => {
        const { searchTarget, allySlots, enemySlots, bannedHeroes } = get();
        if (!searchTarget) return;

        if (searchTarget.side === 'ban') {
            const alreadyBanned = bannedHeroes.some((h) => h.id === hero.id);
            if (!alreadyBanned) {
                set({ bannedHeroes: [...bannedHeroes, hero] });
            }
        } else if (searchTarget.side === 'ally') {
            const updated = [...allySlots];
            updated[searchTarget.slotIdx] = {
                ...updated[searchTarget.slotIdx],
                hero,
                facetId: 0,  // reset facet on new pick
            };
            set({ allySlots: updated });
        } else {
            const updated = [...enemySlots];
            updated[searchTarget.slotIdx] = {
                ...updated[searchTarget.slotIdx],
                hero,
                facetId: 0,  // reset facet on new pick
            };
            set({ enemySlots: updated });
        }
        set({ searchOpen: false, searchTarget: null });
    },

    removeAllyHero: (idx) => {
        const updated = [...get().allySlots];
        updated[idx] = { hero: null, role: null, facetId: 0 };
        set({ allySlots: updated });
    },

    removeEnemyHero: (idx) => {
        const updated = [...get().enemySlots];
        updated[idx] = { hero: null, role: null, facetId: 0 };
        set({ enemySlots: updated });
    },

    setAllyRole: (idx, role) => {
        const updated = [...get().allySlots];
        updated[idx] = { ...updated[idx], role };
        set({ allySlots: updated });
    },

    setAllyFacet: (idx, facetId) => {
        const updated = [...get().allySlots];
        updated[idx] = { ...updated[idx], facetId };
        set({ allySlots: updated });
    },

    setEnemyFacet: (idx, facetId) => {
        const updated = [...get().enemySlots];
        updated[idx] = { ...updated[idx], facetId };
        set({ enemySlots: updated });
    },

    addBan: (hero) => {
        const { bannedHeroes } = get();
        if (!bannedHeroes.find((h) => h.id === hero.id)) {
            set({ bannedHeroes: [...bannedHeroes, hero] });
        }
    },

    removeBan: (heroId) =>
        set({ bannedHeroes: get().bannedHeroes.filter((h) => h.id !== heroId) }),

    setSuggestions: (s) => set({ suggestions: s }),
    setFetching: (v) => set({ isFetching: v }),

    resetDraft: () =>
        set({
            allySlots: makeSlots(5),
            enemySlots: makeSlots(5),
            bannedHeroes: [],
            suggestions: [],
        }),
}));
