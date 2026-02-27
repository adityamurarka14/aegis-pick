import { create } from 'zustand';

/** 
 * Game modes available for draft evaluation. 
 */
export type GameMode = 'ranked' | 'cm' | 'turbo';

/** 
 * Skill brackets used to contextualize hero winrates. 
 */
export type Bracket =
    | 'herald' | 'guardian' | 'crusader' | 'archon'
    | 'legend' | 'ancient' | 'divine' | 'immortal';

/** 
 * Server regions for geographically specific matchmaking data. 
 */
export type Region = 'SEA' | 'CN' | 'EU' | 'NA' | 'SA' | 'EEU' | 'ME';

/** 
 * Represents a Dota 2 Hero entity in the draft.
 */
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

/** 
 * Defines a counterpick suggestion returned by the backend.
 * Includes ranking scores and specific reasoning.
 */
export interface Suggestion {
    id: number;
    localized_name: string;
    img: string;
    primary_attr: string;
    score: number;
    confidence_value: number;
    confidence_label: 'High' | 'Moderate' | 'Low';
    reason: string;
    facet_note?: string;  // optional kit-changing facet note from backend
}

/** 
 * Represents a slot in the draft with an optional hero and their selected facet.
 */
export interface HeroSlot {
    hero: Hero | null;
    /**
     * facetId: which facet index (0-based) the hero is running.
     * Defaults to 0 (first facet, the game's default).
     * Only meaningful when hero != null.
     */
    facetId: number;
}

/**
 * Global application state for tracking draft progress, settings, and API results.
 */
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

    // Evaluation
    winProbability: number | null;

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
    setAllyFacet: (idx: number, facetId: number) => void;
    setEnemyFacet: (idx: number, facetId: number) => void;
    addBan: (hero: Hero) => void;
    removeBan: (heroId: number) => void;

    setSuggestions: (s: Suggestion[]) => void;
    setFetching: (v: boolean) => void;
    setWinProbability: (p: number | null) => void;

    swapSlots: (side: 'ally' | 'enemy', fromIdx: number, toIdx: number) => void;
    /** Replace a specific slot with a suggested hero. */
    assignSuggestion: (hero: Hero, toIdx: number) => void;
    /** Instantly assign a suggested hero to the appropriate slot. */
    addSuggestion: (hero: Hero, attrGroup?: string) => void;

    resetDraft: () => void;
}

/** Helper to initialize a clean draft slot array. */
const makeSlots = (n: number): HeroSlot[] =>
    Array.from({ length: n }, () => ({ hero: null, facetId: 0 }));

/**
 * Zustand store holding the entire global UI and Draft state.
 */
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
    winProbability: null,

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
        updated[idx] = { hero: null, facetId: 0 };
        set({ allySlots: updated });
    },

    removeEnemyHero: (idx) => {
        const updated = [...get().enemySlots];
        updated[idx] = { hero: null, facetId: 0 };
        set({ enemySlots: updated });
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
    setWinProbability: (p) => set({ winProbability: p }),

    swapSlots: (side, fromIdx, toIdx) => {
        const slotsName = side === 'ally' ? 'allySlots' : 'enemySlots';
        const slots = [...get()[slotsName]];
        const temp = slots[fromIdx];
        slots[fromIdx] = slots[toIdx];
        slots[toIdx] = temp;
        set({ [slotsName]: slots } as Partial<DraftState>);
    },

    assignSuggestion: (hero, toIdx) => {
        const updated = [...get().allySlots];
        updated[toIdx] = { hero, facetId: 0 };
        set({ allySlots: updated });
    },

    addSuggestion: (hero, attrGroup) => {
        const state = get();
        let targetIdx = state.allySlots.findIndex(s => !s.hero);
        if (targetIdx === -1) targetIdx = 0;

        if (attrGroup === 'agi') {
            targetIdx = 0;
        } else if (attrGroup === 'all') {
            targetIdx = 1;
        } else if (attrGroup === 'str') {
            targetIdx = 2;
        } else if (attrGroup === 'int') {
            // For Support (Pos 4/5), check if Pos 4 is taken but Pos 5 is free
            if (state.allySlots[3].hero && !state.allySlots[4].hero) {
                targetIdx = 4;
            } else {
                targetIdx = 3;
            }
        }

        state.assignSuggestion(hero, targetIdx);
    },

    resetDraft: () =>
        set({
            allySlots: makeSlots(5),
            enemySlots: makeSlots(5),
            bannedHeroes: [],
            suggestions: [],
            winProbability: null,
        }),
}));
