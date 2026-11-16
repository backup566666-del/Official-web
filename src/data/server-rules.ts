export type RuleCategory =
  | "Roleplay"
  | "Gameplay"
  | "Economy"
  | "Communication"
  | "Staff Conduct";

export type RuleCategoryFilter = "All" | RuleCategory;

export interface ServerRule {
  number: string;
  title: string;
  description: string;
  punishment: string;
  category: RuleCategory;
}

export const GENERAL_RULES_WARNING =
  "All players are required to follow these rules. Punishments may increase for repeated or serious violations.";

export const RULE_CATEGORIES: readonly RuleCategory[] = [
  "Roleplay",
  "Gameplay",
  "Economy",
  "Communication",
  "Staff Conduct",
] as const;

export const SERVER_RULES: readonly ServerRule[] = [
  {
    number: "01",
    title: "RESPECT",
    description:
      "All players must respect other players and staff. Insults, harassment, bullying, and unnecessary provocation are prohibited.",
    punishment: "Warning → Mute → Temporary Ban.",
    category: "Communication",
  },
  {
    number: "02",
    title: "NO CHEATING",
    description:
      "Using cheats, hacks, scripts, or unauthorized software to gain an advantage is prohibited.",
    punishment: "Permanent Ban.",
    category: "Gameplay",
  },
  {
    number: "03",
    title: "NO EXPLOITING",
    description: "Do not intentionally abuse bugs, glitches, or unintended game mechanics.",
    punishment: "Warning → 24-Hour Ban → Permanent Ban for serious abuse.",
    category: "Gameplay",
  },
  {
    number: "04",
    title: "NO RDM",
    description:
      "Random Deathmatch is prohibited. Players must have a valid RP reason before attacking or killing another player.",
    punishment: "Warning → 24-Hour Ban.",
    category: "Roleplay",
  },
  {
    number: "05",
    title: "NO VDM",
    description:
      "Using a vehicle to intentionally kill or attack players without a valid RP reason is prohibited.",
    punishment: "Warning → 24-Hour Ban.",
    category: "Roleplay",
  },
  {
    number: "06",
    title: "NO POWERGAMING",
    description:
      "Do not force actions or outcomes onto another player's character without allowing reasonable interaction.",
    punishment: "Warning → 12-Hour Ban.",
    category: "Roleplay",
  },
  {
    number: "07",
    title: "NO METAGAMING",
    description:
      "Do not use information obtained outside the game to gain an advantage inside the game.",
    punishment: "Warning → 24-Hour Ban.",
    category: "Roleplay",
  },
  {
    number: "08",
    title: "NO FAIL RP",
    description:
      "Players must maintain realistic roleplay and avoid actions that deliberately destroy the RP experience.",
    punishment: "Warning → 12-Hour Ban.",
    category: "Roleplay",
  },
  {
    number: "09",
    title: "NO COMBAT LOGGING",
    description:
      "Do not disconnect from the game to avoid death, arrest, combat, or an active RP situation.",
    punishment: "Warning → 24-Hour Ban.",
    category: "Roleplay",
  },
  {
    number: "10",
    title: "NO REVENGE KILLING",
    description:
      "Do not return to kill someone simply because they killed or attacked you previously.",
    punishment: "Warning → 12-Hour Ban.",
    category: "Roleplay",
  },
  {
    number: "11",
    title: "NO GRIEFING",
    description:
      "Repeatedly targeting a player simply to ruin their gameplay experience is prohibited.",
    punishment: "Warning → 24-Hour Ban.",
    category: "Gameplay",
  },
  {
    number: "12",
    title: "NO SPAWN KILLING",
    description:
      "Do not attack players immediately after they spawn when they have not had a fair opportunity to participate.",
    punishment: "Warning → 12-Hour Ban.",
    category: "Gameplay",
  },
  {
    number: "13",
    title: "NO RANDOM PROVOCATION",
    description:
      "Do not repeatedly provoke police, EMS, civilians, or other factions without a legitimate RP reason.",
    punishment: "Warning → 12-Hour Ban.",
    category: "Roleplay",
  },
  {
    number: "14",
    title: "REALISTIC ROLEPLAY",
    description:
      "Players must act in a manner reasonably appropriate to the Free City environment and their character.",
    punishment: "Warning → 12-Hour Ban.",
    category: "Roleplay",
  },
  {
    number: "15",
    title: "NO CHARACTER ABUSE",
    description:
      "Do not intentionally use your character to repeatedly disrupt other players' RP.",
    punishment: "Warning → 24-Hour Ban.",
    category: "Roleplay",
  },
  {
    number: "16",
    title: "NO SCAMMING",
    description:
      "Intentionally deceiving players to steal money, vehicles, items, or other assets is prohibited.",
    punishment: "24-Hour Ban → Permanent Ban for serious cases.",
    category: "Economy",
  },
  {
    number: "17",
    title: "NO FRAUD",
    description:
      "Do not use fake transactions, fake identities, or other methods to intentionally defraud players.",
    punishment: "24-Hour Ban → Permanent Ban.",
    category: "Economy",
  },
  {
    number: "18",
    title: "NO UNAUTHORIZED TRADING",
    description: "Follow the approved Free City trading systems and procedures.",
    punishment: "Warning → 24-Hour Ban.",
    category: "Economy",
  },
  {
    number: "19",
    title: "NO ACCOUNT SHARING FOR PUNISHMENT EVASION",
    description: "Do not use another person's account to avoid a punishment.",
    punishment: "7-Day Ban.",
    category: "Gameplay",
  },
  {
    number: "20",
    title: "NO BAN EVASION",
    description: "Creating or using another account to bypass a ban is prohibited.",
    punishment: "Permanent Ban.",
    category: "Gameplay",
  },
  {
    number: "21",
    title: "NO SPAM",
    description:
      "Do not repeatedly send messages, commands, sounds, or other unnecessary content.",
    punishment: "Warning → Mute.",
    category: "Communication",
  },
  {
    number: "22",
    title: "NO CHAT FLOODING",
    description:
      "Do not fill public channels with excessive messages that prevent normal communication.",
    punishment: "Warning → 1-Hour Mute → 12-Hour Mute.",
    category: "Communication",
  },
  {
    number: "23",
    title: "NO UNAUTHORIZED ADVERTISING",
    description:
      "Advertising other servers, communities, or services without permission is prohibited.",
    punishment: "Warning → 24-Hour Mute → Ban.",
    category: "Communication",
  },
  {
    number: "24",
    title: "NO MALICIOUS LINKS",
    description: "Do not distribute dangerous, malicious, deceptive, or harmful links.",
    punishment: "Immediate Ban.",
    category: "Communication",
  },
  {
    number: "25",
    title: "NO STAFF IMPERSONATION",
    description:
      "Do not pretend to be an Administrator, Moderator, Developer, or other official representative.",
    punishment: "24-Hour Ban → Permanent Ban for serious cases.",
    category: "Staff Conduct",
  },
  {
    number: "26",
    title: "NO FALSE REPORTS",
    description:
      "Do not intentionally submit fake reports against another player or staff member.",
    punishment: "Warning → 24-Hour Ban.",
    category: "Staff Conduct",
  },
  {
    number: "27",
    title: "NO REPORT ABUSE",
    description:
      "Do not repeatedly use the report system for jokes, spam, revenge, or harassment.",
    punishment: "Warning → Temporary Report Restriction.",
    category: "Staff Conduct",
  },
  {
    number: "28",
    title: "FOLLOW STAFF INSTRUCTIONS",
    description:
      "Players must follow reasonable instructions from authorized staff while an issue is being investigated or handled.",
    punishment: "Warning → Mute → Temporary Ban.",
    category: "Staff Conduct",
  },
  {
    number: "29",
    title: "NO STAFF HARASSMENT",
    description: "Do not repeatedly harass, threaten, or intentionally provoke staff members.",
    punishment: "24-Hour Mute → 7-Day Ban.",
    category: "Staff Conduct",
  },
  {
    number: "30",
    title: "NO BRIBERY",
    description:
      "Do not offer money, items, or favors to staff in exchange for special treatment.",
    punishment: "7-Day Ban → Permanent Ban for serious attempts.",
    category: "Staff Conduct",
  },
] as const;

export function filterServerRules(
  rules: readonly ServerRule[],
  query: string,
  category: RuleCategoryFilter,
): ServerRule[] {
  const normalizedQuery = query.trim().toLowerCase();
  const numericQuery = normalizedQuery.replace(/^[#0]+/, "");

  return rules.filter((rule) => {
    if (category !== "All" && rule.category !== category) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    const ruleNumUnpadded = String(Number(rule.number));
    const matchesNumber =
      rule.number.includes(normalizedQuery) ||
      `${rule.number}.`.includes(normalizedQuery) ||
      (numericQuery.length > 0 && ruleNumUnpadded === numericQuery);

    return (
      matchesNumber ||
      rule.title.toLowerCase().includes(normalizedQuery) ||
      rule.description.toLowerCase().includes(normalizedQuery) ||
      rule.punishment.toLowerCase().includes(normalizedQuery) ||
      rule.category.toLowerCase().includes(normalizedQuery)
    );
  });
}
