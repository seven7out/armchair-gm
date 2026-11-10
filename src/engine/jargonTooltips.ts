/**
 * Plain-English NFL Salary Cap Jargon Translation Table (`jargonTooltips.ts`).
 * Maps front-office CBA terminology into intuitive human labels, visual metaphors,
 * and one-line tooltips based on NFL fan research.
 */

export type JargonTermKey =
  | 'CAP_SPACE'
  | 'EFFECTIVE_CAP_SPACE'
  | 'TOP_51_RULE'
  | 'ADJUSTED_CAP'
  | 'ROLLOVER'
  | 'CAP_HIT'
  | 'CASH_SPEND'
  | 'APY'
  | 'PRACTICAL_GUARANTEE'
  | 'FULLY_GUARANTEED'
  | 'SIGNING_BONUS_PRORATION'
  | 'RESTRUCTURE'
  | 'PAY_CUT'
  | 'VOID_YEARS'
  | 'VOID_YEAR_DEAD_CAP'
  | 'DEAD_MONEY'
  | 'BONUS_ACCELERATION'
  | 'PRE_JUNE_1_RELEASE'
  | 'POST_JUNE_1_DESIGNATION'
  | 'FRANCHISE_TAG'
  | 'TRANSITION_TAG'
  | 'FIFTH_YEAR_OPTION'
  | 'COMP_PICK'
  | 'CFA_CANCELLATION'
  | 'STREET_FREE_AGENT'
  | 'ROOKIE_POOL'
  | 'TRADE_VALUE_CHART';

export interface JargonTranslation {
  key: JargonTermKey;
  officialTerm: string;
  plainLabel: string;
  metaphor: string;
  tooltip: string;
}

export const JARGON_TRANSLATIONS: Record<JargonTermKey, JargonTranslation> = {
  CAP_SPACE: {
    key: 'CAP_SPACE',
    officialTerm: 'Cap Space',
    plainLabel: 'Room Today',
    metaphor: 'Fuel gauge',
    tooltip: 'What fits under the salary cap ceiling right now before rookie reserves.',
  },
  EFFECTIVE_CAP_SPACE: {
    key: 'EFFECTIVE_CAP_SPACE',
    officialTerm: 'Effective Cap Space',
    plainLabel: 'Spendable Now',
    metaphor: 'Fuel gauge with reserve line',
    tooltip: 'True spendable room today after setting aside money for your draft picks and Top-51 roster displacement.',
  },
  TOP_51_RULE: {
    key: 'TOP_51_RULE',
    officialTerm: 'Top-51 Rule',
    plainLabel: 'Only 51 Biggest Deals Count',
    metaphor: '51 seats behind a velvet rope',
    tooltip: 'In the offseason, only the 51 highest cap hits count. Signing a rookie pushes #51 out, reducing the net cap cost.',
  },
  ADJUSTED_CAP: {
    key: 'ADJUSTED_CAP',
    officialTerm: 'Adjusted Cap Ceiling',
    plainLabel: "Your Team's Cap Limit",
    metaphor: 'Ceiling height',
    tooltip: 'The NFL league cap ($301.2M in 2026) plus leftover room rolled over from last season. This is your limit, not open space.',
  },
  ROLLOVER: {
    key: 'ROLLOVER',
    officialTerm: 'Rollover / Carryover',
    plainLabel: 'Leftover Room From Last Year',
    metaphor: 'Piggy bank',
    tooltip: 'Unused cap space carries forward to the next season, though CBA 4-year cash-spending floors prevent hoarding forever.',
  },
  CAP_HIT: {
    key: 'CAP_HIT',
    officialTerm: 'Cap Hit',
    plainLabel: "This Year's Cap Charge",
    metaphor: 'Accounting receipt',
    tooltip: 'What counts against the team cap this season (Base Salary + Prorated Bonus Slice + Roster/Workout Bonuses).',
  },
  CASH_SPEND: {
    key: 'CASH_SPEND',
    officialTerm: 'Cash Spend',
    plainLabel: 'Paid This Year (Wallet)',
    metaphor: "Owner's checkbook",
    tooltip: 'Actual dollars wired to the player this year. Can be much higher or lower than his accounting cap charge.',
  },
  APY: {
    key: 'APY',
    officialTerm: 'APY (Average Per Year)',
    plainLabel: 'Headline Average (*)',
    metaphor: 'Price tag with an asterisk',
    tooltip: 'Agent-reported headline average. Often inflated by unguaranteed back-end balloon years that will never be played.',
  },
  PRACTICAL_GUARANTEE: {
    key: 'PRACTICAL_GUARANTEE',
    officialTerm: 'Practical Guarantee',
    plainLabel: "Money He'll Almost Certainly Get",
    metaphor: 'Vault too costly to open',
    tooltip: 'Money that becomes guaranteed early or would cost more in dead cap to cut than to keep.',
  },
  FULLY_GUARANTEED: {
    key: 'FULLY_GUARANTEED',
    officialTerm: 'Fully Guaranteed at Signing',
    plainLabel: 'Locked In',
    metaphor: 'Padlock',
    tooltip: 'Owed to the player no matter what — protected against skill, injury, and cap release.',
  },
  SIGNING_BONUS_PRORATION: {
    key: 'SIGNING_BONUS_PRORATION',
    officialTerm: 'Signing Bonus Proration',
    plainLabel: 'Bonus Spread Into Slices',
    metaphor: 'Pizza cut into slices (max 5)',
    tooltip: 'The player gets the bonus cash upfront, but the cap counts it in equal annual slices over up to 5 years.',
  },
  RESTRUCTURE: {
    key: 'RESTRUCTURE',
    officialTerm: 'Simple Restructure',
    plainLabel: 'Pay Him Now, Count It Later',
    metaphor: 'Credit card swipe',
    tooltip: 'Not a pay cut! Converts this year’s base salary into a bonus so the player gets cash now while the cap bill spreads into future years.',
  },
  PAY_CUT: {
    key: 'PAY_CUT',
    officialTerm: 'Pay Cut',
    plainLabel: 'Player Takes Less Cash',
    metaphor: 'Shrinking price tag',
    tooltip: 'The player actually agrees to reduce his cash compensation to avoid being released.',
  },
  VOID_YEARS: {
    key: 'VOID_YEARS',
    officialTerm: 'Void Years',
    plainLabel: 'Ghost Years for Cap Math',
    metaphor: 'Ghost years on timeline',
    tooltip: 'Dummy seasons tacked onto the end of a contract solely to spread bonus slices over 5 years.',
  },
  VOID_YEAR_DEAD_CAP: {
    key: 'VOID_YEAR_DEAD_CAP',
    officialTerm: 'Void Year Acceleration',
    plainLabel: 'The Ghost Bill',
    metaphor: 'Ghost holding an invoice',
    tooltip: 'When a contract expires into a Void Year, all remaining bonus slices in those ghost years hit the cap at once.',
  },
  DEAD_MONEY: {
    key: 'DEAD_MONEY',
    officialTerm: 'Dead Money',
    plainLabel: 'Cap Charges for Gone Players',
    metaphor: 'Past-due credit card balance',
    tooltip: 'Cap space consumed by players no longer on the roster — mostly accounting charges for signing bonuses already paid in past years.',
  },
  BONUS_ACCELERATION: {
    key: 'BONUS_ACCELERATION',
    officialTerm: 'Prorated Bonus Acceleration',
    plainLabel: 'All Remaining Slices Hit Now',
    metaphor: 'All pizza slices dumped on today’s plate',
    tooltip: 'Cutting or trading a player forces all future unaccounted bonus slices onto the cap immediately (or split across 2 years after June 1).',
  },
  PRE_JUNE_1_RELEASE: {
    key: 'PRE_JUNE_1_RELEASE',
    officialTerm: 'Pre-June 1 Release',
    plainLabel: 'Full Dead Bill Now, Clean Next Year',
    metaphor: 'One big invoice today',
    tooltip: 'All remaining bonus proration accelerates into this year’s cap, leaving $0 dead money in future seasons.',
  },
  POST_JUNE_1_DESIGNATION: {
    key: 'POST_JUNE_1_DESIGNATION',
    officialTerm: 'Post-June 1 Designation',
    plainLabel: 'Split Dead Bill Across Two Years',
    metaphor: 'Invoice torn in half (max 2/yr)',
    tooltip: 'Same total dead money, split across this year and next year. Cap savings do not unlock until June 2 (after Wave 1 of Free Agency).',
  },
  FRANCHISE_TAG: {
    key: 'FRANCHISE_TAG',
    officialTerm: 'Non-Exclusive Franchise Tag',
    plainLabel: '1-Year Hold (2 Firsts to Steal)',
    metaphor: 'Reserved sign',
    tooltip: '1-year fully guaranteed tender at top-5 positional average (or 120% of prior cap hit). Another team must give up two 1st-round picks to sign him.',
  },
  TRANSITION_TAG: {
    key: 'TRANSITION_TAG',
    officialTerm: 'Transition Tag',
    plainLabel: 'Right to Match (No Pick Compensation)',
    metaphor: 'Right-of-first-refusal mirror',
    tooltip: 'Cheaper 1-year tender (top-10 average) giving the team 5 days to match any outside offer, but yields 0 draft picks if declined.',
  },
  FIFTH_YEAR_OPTION: {
    key: 'FIFTH_YEAR_OPTION',
    officialTerm: 'Fifth-Year Option',
    plainLabel: 'Bonus Year on 1st-Rounders',
    metaphor: 'Extra calendar page',
    tooltip: 'Team option for Round 1 picks (decided by May 3 of Year 4). Fully guaranteed once exercised.',
  },
  COMP_PICK: {
    key: 'COMP_PICK',
    officialTerm: 'Compensatory Draft Pick',
    plainLabel: 'Free Agent Refund Pick',
    metaphor: 'Store credit (Rounds 3–7)',
    tooltip: 'Awarded (up to 4 per team, 32 league-wide) when a team loses more or higher-priced qualifying UFAs than it signs.',
  },
  CFA_CANCELLATION: {
    key: 'CFA_CANCELLATION',
    officialTerm: 'CFA Cancellation Chart',
    plainLabel: 'This Signing Erases a Refund Pick',
    metaphor: 'Two cards canceling out',
    tooltip: 'Signing an outside UFA pairs up against a departing UFA of similar or lower APY and cancels out that compensatory pick.',
  },
  STREET_FREE_AGENT: {
    key: 'STREET_FREE_AGENT',
    officialTerm: 'Street Free Agent',
    plainLabel: 'Comp-Pick Safe Signing',
    metaphor: 'Green safe stamp',
    tooltip: 'A player who was cut/released by his prior team (rather than an expiring UFA). Signing him NEVER cancels a compensatory pick!',
  },
  ROOKIE_POOL: {
    key: 'ROOKIE_POOL',
    officialTerm: 'Rookie Pool Reserve',
    plainLabel: 'Draft Class Cap Budget',
    metaphor: 'Shopping cart total vs net cost',
    tooltip: 'Gross Year-1 cap hits of your unsigned draft picks. Because each rookie displaces the 51st contract (~$1.03M), net cap space needed is much lower.',
  },
  TRADE_VALUE_CHART: {
    key: 'TRADE_VALUE_CHART',
    officialTerm: 'Trade Value Chart',
    plainLabel: 'Pick Price Guide (3 Models)',
    metaphor: 'Three appraisal books',
    tooltip: 'Jimmy Johnson (classic 90s steep top-end), Rich Hill (modern NFL trade consensus), and Fitzgerald-Spielberger (analytical surplus value).',
  },
};
