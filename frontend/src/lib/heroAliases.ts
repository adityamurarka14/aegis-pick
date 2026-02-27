// Hero aliases: English names + common abbreviations + Dota 1 names
// Used for fuzzy name matching in hero search
export const HERO_ALIASES: Record<string, string[]> = {
    "Anti-Mage": ["AM", "Magina"],
    "Axe": ["Mogul Khan"],
    "Bane": ["Atropos"],
    "Bloodseeker": ["BS", "Strygwyr"],
    "Crystal Maiden": ["CM", "Rylai"],
    "Drow Ranger": ["DR", "Traxex"],
    "Earthshaker": ["ES", "Raigor"],
    "Juggernaut": ["Jugg", "Yurnero"],
    "Mirana": ["Mira", "Selemene"],
    "Morphling": ["Morph"],
    "Shadow Fiend": ["SF", "Nevermore"],
    "Phantom Lancer": ["PL", "Azwraith"],
    "Puck": ["Faerie Dragon"],
    "Pudge": ["Butcher"],
    "Razor": ["Lightning Revenant"],
    "Sand King": ["SK", "Crixalis"],
    "Storm Spirit": ["Storm", "Raijin"],
    "Sven": ["God's Strength"],
    "Tiny": ["Pebbles"],
    "Vengeful Spirit": ["VS", "Venge"],
    "Windranger": ["WR", "Lyralei", "Windrunner"],
    "Witch Doctor": ["WD", "Zharvakko"],
    "Lich": ["Ethreain"],
    "Lion": ["Demon Witch"],
    "Shadow Shaman": ["SS", "Rhasta"],
    "Slardar": ["Amphitherus"],
    "Tidehunter": ["Tide", "Leviathan"],
    "Ancient Apparition": ["AA", "Kaldr"],
    "Clinkz": ["Bone Fletcher"],
    "Enchantress": ["Aiushtha"],
    "Huskar": ["Sacred Warrior"],
    "Jakiro": ["Twin Head Dragon"],
    "Batrider": ["Bat"],
    "Chen": ["Holy Knight"],
    "Spectre": ["Mercurial"],
    "Doom": ["Lucifer"],
    "Faceless Void": ["Void", "FV", "Darkterror"],
    "Wraith King": ["WK", "Ostarion", "Skeleton King"],
    "Death Prophet": ["DP", "Krobelus"],
    "Phantom Assassin": ["PA", "Mortred"],
    "Pugna": ["Oblivion"],
    "Templar Assassin": ["TA", "Lanaya"],
    "Invoker": ["Carl", "Kael"],
    "Naga Siren": ["Naga", "Slithice"],
    "Dark Seer": ["DS", "Ish'kafel"],
    "Clockwerk": ["CW", "Rattletrap"],
    "Nyx Assassin": ["Nyx", "Anub'arak"],
    "Keeper of the Light": ["KotL", "Ezalor"],
    "Io": ["Wisp"],
    "Visage": ["Necro'lic"],
    "Outworld Destroyer": ["OD", "Harbinger"],
    "Brewmaster": ["Mangix"],
    "Spirit Breaker": ["SB", "Barathrum", "Bara"],
    "Ursa": ["Ulfsaar"],
    "Gyrocopter": ["Gyro"],
    "Alchemist": ["Razzil"],
    "Elder Titan": ["ET"],
    "Lone Druid": ["LD", "Bear", "Sylla"],
    "Chaos Knight": ["CK", "Nessaj"],
    "Meepo": ["Geomancer"],
    "Dragon Knight": ["DK", "Davion"],
    "Dazzle": ["Shadow Priest"],
    "Rubick": ["Grand Magus"],
    "Disruptor": ["Thunderhawk"],
    "Legion Commander": ["LC", "Tresdin"],
    "Nature's Prophet": ["NP", "Furion", "Prophet"],
    "Lifestealer": ["LS", "N'aix", "Naix"],
    "Bounty Hunter": ["BH", "Gondar"],
    "Weaver": ["The Weaver"],
    "Treant Protector": ["Treant", "Rooftrellen"],
    "Arc Warden": ["Arc", "Zet"],
    "Underlord": ["Pit Lord", "Vrogros"],
    "Terrorblade": ["TB", "Soul Keeper"],
    "Phoenix": ["Icarus"],
    "Oracle": ["Fortune's End"],
    "Winter Wyvern": ["WW", "Auroth"],
    "Earth Spirit": ["Kaolin"],
    "Undying": ["Dirge"],
    "Abaddon": ["Lord of Avernus"],
    "Ember Spirit": ["Ember", "Xin"],
    "Void Spirit": ["Inai"],
    "Centaur Warrunner": ["Centaur", "Bradwarden"],
    "Magnus": ["Magnataur"],
    "Timbersaw": ["Timber", "Rizzrack"],
    "Bristleback": ["BB"],
    "Tusk": ["Walrus Punch"],
    "Skywrath Mage": ["SM", "Dragonus"],
    "Ogre Magi": ["Ogre"],
    "Kunkka": ["Admiral"],
    "Beastmaster": ["BM", "Karroch"],
    "Queen of Pain": ["QoP", "Akasha"],
    "Venomancer": ["Veno", "Lesale"],
    "Necrophos": ["Necro", "Rotund'jere"],
    "Warlock": ["Demnok"],
    "Leshrac": ["Lesh", "Tormented Soul"],
    "Lina": ["Slayer"],
    "Zeus": ["Lord of Heaven"],
    "Troll Warlord": ["Troll", "Jah'rakal"],
    "Medusa": ["Gorgon"],
    "Sniper": ["Kardel"],
    "Enigma": ["Darchrow"],
    "Tinker": ["Boush"],
    "Lycan": ["Banehallow"],
    "Shadow Demon": ["SD"],
    "Pangolier": ["Pango"],
    "Dark Willow": ["DW", "Mireska"],
    "Grimstroke": ["Grim"],
    "Mars": [],
    "Snapfire": [],
    "Hoodwink": [],
    "Dawnbreaker": ["Dawn"],
    "Marci": [],
    "Primal Beast": ["PB"],
    "Muerta": ["La Muerte"],
    "Ringmaster": [],
};

export function searchHeroes<T extends { localized_name: string; id: number }>(
    query: string,
    heroes: T[],
    excludeIds: number[] = []
): T[] {
    const q = query.toLowerCase().trim();
    if (!q) {
        return heroes
            .filter((h) => !excludeIds.includes(h.id))
            .sort((a, b) => a.localized_name.localeCompare(b.localized_name));
    }

    return heroes
        .filter((h) => {
            if (excludeIds.includes(h.id)) return false;
            const name = h.localized_name.toLowerCase();
            if (name.includes(q)) return true;
            const aliases = (HERO_ALIASES[h.localized_name] ?? []).map((a) =>
                a.toLowerCase()
            );
            return aliases.some((a) => a.includes(q));
        })
        .sort((a, b) => {
            const aExact = a.localized_name.toLowerCase() === q ? 1 : 0;
            const bExact = b.localized_name.toLowerCase() === q ? 1 : 0;
            if (bExact !== aExact) return bExact - aExact;
            return a.localized_name.localeCompare(b.localized_name);
        });
}
