import type { AllocationCategory, AllocationRow, Model } from "./types";

/**
 * Starting points for the simulator. They are generic archetypes, not the
 * numbers of any named project. Row names are English placeholders; the page
 * swaps in the locale's names when it loads a preset.
 */

export const presetIds = [
  "defi_governance",
  "staking_network",
  "consumer_game",
  "depin",
  "fair_launch",
] as const;
export type PresetId = (typeof presetIds)[number];

export const defaultPresetId: PresetId = "defi_governance";

function row(
  id: string,
  name: string,
  category: AllocationCategory,
  share: number,
  tgeUnlock: number,
  cliffMonths: number,
  vestingMonths: number,
  sellPropensity: number,
  purchasePriceUsd: number | null = null,
): AllocationRow {
  return {
    id,
    name,
    category,
    share,
    tgeUnlock,
    cliffMonths,
    vestingMonths,
    vestingStepMonths: 1,
    sellPropensity,
    purchasePriceUsd,
  };
}

/** Settings every preset shares. */
function common(): Pick<Model, "version" | "horizonMonths" | "monteCarlo" | "outcomeMonths"> {
  return {
    version: 1,
    horizonMonths: 60,
    monteCarlo: {
      runs: 500,
      seed: 1,
      marketVolatility: 0.25,
      growthVolatility: 0.3,
      sellPropensityVolatility: 0.5,
    },
    outcomeMonths: [12, 24, 36],
  };
}

const scenarioMultipliers = { bear: 0.5, base: 1, bull: 2 } as const;

const builders: Record<PresetId, () => Model> = {
  defi_governance: () => ({
    ...common(),
    token: { name: "", symbol: "TKN", genesisSupply: 1e9, tgePriceUsd: 0.25 },
    allocations: [
      row("team", "Team", "team", 0.18, 0, 12, 36, 0.25),
      row("seed", "Seed round", "investors", 0.08, 0, 12, 24, 0.5, 0.04),
      row("strategic", "Strategic round", "investors", 0.1, 0, 12, 18, 0.5, 0.1),
      row("advisors", "Advisors", "advisors", 0.03, 0, 6, 24, 0.5),
      row("treasury", "Treasury", "treasury", 0.2, 0.05, 0, 48, 0),
      row("incentives", "Incentives", "ecosystem", 0.28, 0.02, 0, 48, 0.6),
      row("airdrop", "Airdrop", "community", 0.08, 0.5, 0, 6, 0.6),
      row("public", "Public sale", "public_sale", 0.02, 1, 0, 0, 0.4, 0.2),
      row("liquidity", "Liquidity", "liquidity", 0.03, 1, 0, 0, 0),
    ],
    emissions: {
      mode: "none",
      annualInflationRate: 0.05,
      tokensPerMonth: 0,
      decay: "none",
      halvingEveryMonths: 24,
      annualDecayRate: 0.2,
      maxSupply: null,
      capBasis: "minted",
      sellRate: 0.5,
      toStakersShare: 1,
    },
    staking: { initialRatio: 0, targetRatio: 0.3, rampMonths: 12 },
    utility: {
      initialUsers: 5000,
      saturationUsers: 100000,
      monthlyGrowthRate: 0.1,
      spendPerUserUsd: 25,
      holdingMonths: 0,
    },
    revenueSplit: { burnShare: 0.2, treasuryShare: 0.2, stakerShare: 0.3 },
    speculation: {
      baseInflowUsd: 1.6e6,
      monthlyGrowth: 0.01,
      scenario: "base",
      scenarioMultipliers: { ...scenarioMultipliers },
      momentum: 0.5,
    },
    market: { depthRatio: 0.2, minDepthUsd: 250000, holderSellRate: 0.02 },
    treasury: {
      startingUsd: 12e6,
      monthlyCostUsd: 450000,
      annualCostGrowth: 0.05,
      sellTokens: true,
      bufferMonths: 6,
      maxMonthlySaleShare: 0.005,
    },
  }),

  staking_network: () => ({
    ...common(),
    token: { name: "", symbol: "TKN", genesisSupply: 5e8, tgePriceUsd: 1.2 },
    allocations: [
      row("team", "Team", "team", 0.15, 0, 12, 36, 0.25),
      row("series_a", "Series A", "investors", 0.12, 0, 12, 24, 0.5, 0.15),
      row("series_b", "Series B", "investors", 0.08, 0, 12, 18, 0.5, 0.45),
      row("foundation", "Foundation", "treasury", 0.2, 0.1, 0, 60, 0),
      row("ecosystem", "Ecosystem", "ecosystem", 0.25, 0.05, 0, 48, 0.5),
      row("airdrop", "Airdrop", "community", 0.1, 0.6, 0, 12, 0.6),
      row("public", "Public sale", "public_sale", 0.07, 0.5, 0, 6, 0.4, 0.8),
      row("liquidity", "Liquidity", "liquidity", 0.03, 1, 0, 0, 0),
    ],
    emissions: {
      mode: "inflation",
      annualInflationRate: 0.06,
      tokensPerMonth: 0,
      decay: "none",
      halvingEveryMonths: 24,
      annualDecayRate: 0.2,
      maxSupply: null,
      capBasis: "minted",
      sellRate: 0.4,
      toStakersShare: 1,
    },
    staking: { initialRatio: 0.2, targetRatio: 0.6, rampMonths: 18 },
    utility: {
      initialUsers: 20000,
      saturationUsers: 2000000,
      monthlyGrowthRate: 0.08,
      spendPerUserUsd: 1.5,
      holdingMonths: 1,
    },
    revenueSplit: { burnShare: 0.5, treasuryShare: 0, stakerShare: 0.5 },
    speculation: {
      baseInflowUsd: 5e6,
      monthlyGrowth: 0.01,
      scenario: "base",
      scenarioMultipliers: { ...scenarioMultipliers },
      momentum: 0.5,
    },
    market: { depthRatio: 0.2, minDepthUsd: 500000, holderSellRate: 0.02 },
    treasury: {
      startingUsd: 40e6,
      monthlyCostUsd: 1100000,
      annualCostGrowth: 0.05,
      sellTokens: true,
      bufferMonths: 6,
      maxMonthlySaleShare: 0.005,
    },
  }),

  consumer_game: () => ({
    ...common(),
    token: { name: "", symbol: "TKN", genesisSupply: 5e9, tgePriceUsd: 0.02 },
    allocations: [
      row("team", "Team", "team", 0.15, 0, 12, 36, 0.3),
      row("investors", "Investors", "investors", 0.12, 0.05, 6, 18, 0.6, 0.006),
      row("advisors", "Advisors", "advisors", 0.02, 0, 6, 18, 0.6),
      row("treasury", "Treasury", "treasury", 0.18, 0.1, 0, 36, 0),
      row("ecosystem", "Ecosystem", "ecosystem", 0.28, 0.02, 0, 48, 0.5),
      row("airdrop", "Airdrop", "community", 0.12, 0.25, 0, 12, 0.6),
      row("public", "Public sale", "public_sale", 0.08, 0.25, 0, 9, 0.5, 0.015),
      row("liquidity", "Liquidity", "liquidity", 0.05, 1, 0, 0, 0),
    ],
    emissions: {
      mode: "fixed",
      annualInflationRate: 0.05,
      tokensPerMonth: 12e6,
      decay: "annual",
      halvingEveryMonths: 24,
      annualDecayRate: 0.25,
      maxSupply: 5.5e9,
      capBasis: "minted",
      sellRate: 0.8,
      toStakersShare: 0,
    },
    staking: { initialRatio: 0, targetRatio: 0.15, rampMonths: 12 },
    utility: {
      initialUsers: 40000,
      saturationUsers: 400000,
      monthlyGrowthRate: 0.1,
      spendPerUserUsd: 4,
      holdingMonths: 1.5,
    },
    revenueSplit: { burnShare: 0.25, treasuryShare: 0.55, stakerShare: 0.05 },
    speculation: {
      baseInflowUsd: 1.3e6,
      monthlyGrowth: -0.015,
      scenario: "base",
      scenarioMultipliers: { ...scenarioMultipliers },
      momentum: 1,
    },
    market: { depthRatio: 0.2, minDepthUsd: 150000, holderSellRate: 0.03 },
    treasury: {
      startingUsd: 9e6,
      monthlyCostUsd: 400000,
      annualCostGrowth: 0.05,
      sellTokens: true,
      bufferMonths: 6,
      maxMonthlySaleShare: 0.005,
    },
  }),

  depin: () => ({
    ...common(),
    token: { name: "", symbol: "TKN", genesisSupply: 1e9, tgePriceUsd: 0.4 },
    allocations: [
      row("team", "Team", "team", 0.15, 0, 12, 36, 0.25),
      row("investors", "Investors", "investors", 0.2, 0, 12, 24, 0.5, 0.08),
      row("foundation", "Foundation", "treasury", 0.15, 0.1, 0, 48, 0),
      row("bootstrap", "Network bootstrap", "ecosystem", 0.3, 0.03, 0, 48, 0.6),
      row("public", "Public sale", "public_sale", 0.1, 0.4, 0, 6, 0.4, 0.3),
      row("airdrop", "Airdrop", "community", 0.05, 1, 0, 0, 0.6),
      row("liquidity", "Liquidity", "liquidity", 0.05, 1, 0, 0, 0),
    ],
    emissions: {
      mode: "fixed",
      annualInflationRate: 0.05,
      tokensPerMonth: 8e6,
      decay: "halving",
      halvingEveryMonths: 24,
      annualDecayRate: 0.2,
      maxSupply: 2e9,
      capBasis: "outstanding",
      sellRate: 0.7,
      toStakersShare: 0.2,
    },
    staking: { initialRatio: 0, targetRatio: 0.25, rampMonths: 12 },
    utility: {
      initialUsers: 2000,
      saturationUsers: 400000,
      monthlyGrowthRate: 0.09,
      spendPerUserUsd: 20,
      holdingMonths: 0.25,
    },
    revenueSplit: { burnShare: 1, treasuryShare: 0, stakerShare: 0 },
    speculation: {
      baseInflowUsd: 3.2e6,
      monthlyGrowth: 0.005,
      scenario: "base",
      scenarioMultipliers: { ...scenarioMultipliers },
      momentum: 0.5,
    },
    market: { depthRatio: 0.2, minDepthUsd: 300000, holderSellRate: 0.02 },
    treasury: {
      startingUsd: 30e6,
      monthlyCostUsd: 700000,
      annualCostGrowth: 0.05,
      sellTokens: true,
      bufferMonths: 6,
      maxMonthlySaleShare: 0.005,
    },
  }),

  fair_launch: () => ({
    ...common(),
    token: { name: "", symbol: "TKN", genesisSupply: 1e8, tgePriceUsd: 0.2 },
    allocations: [
      row("public", "Public sale", "public_sale", 0.6, 1, 0, 0, 0.3, 0.2),
      row("airdrop", "Airdrop", "community", 0.25, 0.5, 0, 6, 0.6),
      row("liquidity", "Liquidity", "liquidity", 0.1, 1, 0, 0, 0),
      row("dao", "DAO treasury", "treasury", 0.05, 0, 0, 24, 0),
    ],
    emissions: {
      mode: "fixed",
      annualInflationRate: 0.05,
      tokensPerMonth: 1.5e6,
      decay: "halving",
      halvingEveryMonths: 12,
      annualDecayRate: 0.2,
      maxSupply: 1.4e8,
      capBasis: "minted",
      sellRate: 0.5,
      toStakersShare: 1,
    },
    staking: { initialRatio: 0, targetRatio: 0.5, rampMonths: 6 },
    utility: {
      initialUsers: 3000,
      saturationUsers: 60000,
      monthlyGrowthRate: 0.07,
      spendPerUserUsd: 12,
      holdingMonths: 0,
    },
    revenueSplit: { burnShare: 0.4, treasuryShare: 0.2, stakerShare: 0.4 },
    speculation: {
      baseInflowUsd: 4.5e5,
      monthlyGrowth: 0,
      scenario: "base",
      scenarioMultipliers: { ...scenarioMultipliers },
      momentum: 1,
    },
    market: { depthRatio: 0.2, minDepthUsd: 100000, holderSellRate: 0.03 },
    treasury: {
      startingUsd: 1.5e6,
      monthlyCostUsd: 45000,
      annualCostGrowth: 0,
      sellTokens: true,
      bufferMonths: 6,
      maxMonthlySaleShare: 0.005,
    },
  }),
};

/** A fresh copy of a preset, safe to mutate. */
export function getPreset(id: PresetId): Model {
  return builders[id]();
}

/** The model a first-time visitor sees. */
export function defaultModel(): Model {
  return getPreset(defaultPresetId);
}
