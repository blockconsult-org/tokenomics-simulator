import type {
  AllocationFieldKey,
  FieldUnit,
  ModelFieldPath,
} from "@/simulator/engine/fields";
import type { PresetId } from "@/simulator/engine/presets";
import type {
  AllocationCategory,
  CapBasis,
  DecayMode,
  EmissionMode,
  HealthCheckId,
  HealthStatus,
  IssueCode,
  Scenario,
} from "@/simulator/engine/types";

/**
 * Interface text of the simulator, English. The German file is typed against
 * this one (see ./index.ts), so a string added here fails the type check
 * until it exists there too. The page's long-form copy (methodology, FAQ)
 * lives in page.en.ts and stays out of the client bundle.
 */

export interface FieldCopy {
  label: string;
  /** Shown in the popover behind the field's "?" button. */
  help: string;
}

export interface ChoiceCopy<T extends string> extends FieldCopy {
  options: Record<T, string>;
}

export const sectionIds = [
  "token",
  "allocations",
  "emissions",
  "staking",
  "utility",
  "speculation",
  "market",
  "treasury",
  "simulation",
] as const;
export type SectionId = (typeof sectionIds)[number];

export const chartTabIds = [
  "supply",
  "unlocks",
  "allocation",
  "price",
  "valuation",
  "flows",
  "staking",
  "treasury",
] as const;
export type ChartTabId = (typeof chartTabIds)[number];

export const kpiIds = [
  "initialMarketCap",
  "initialFloat",
  "priceAtHorizon",
  "largestUnlock",
  "inflationYear1",
  "halfUnlocked",
  "runway",
  "belowLaunch",
] as const;
export type KpiId = (typeof kpiIds)[number];

/** Where a health check's value sits relative to its thresholds. */
type Thresholds = (watch: string, risk: string) => string;

const months = (n: number) => (n === 1 ? "1 month" : `${n} months`);

export const en = {
  months,

  toolbar: {
    label: "Model",
    preset: "Start from",
    presets: {
      defi_governance: {
        name: "DeFi governance token",
        description:
          "No emissions. Team and two investor rounds with one-year cliffs, a large incentive pool and a low float at launch.",
      },
      staking_network: {
        name: "Staking network",
        description:
          "6% annual inflation paid to stakers, a 60% staking target, and fees split between a burn and stakers.",
      },
      consumer_game: {
        name: "Consumer or game token",
        description:
          "Rewards paid to players with a yearly decay and a supply cap. Players hold a working balance of tokens.",
      },
      depin: {
        name: "DePIN, burn and mint",
        description:
          "All revenue buys and burns tokens. Emissions go mostly to operators, halve every two years and sit under a cap on outstanding supply.",
      },
      fair_launch: {
        name: "Fair launch",
        description:
          "No team or investor allocation. 60% sold to the public at launch, with emissions that halve every year.",
      },
    } satisfies Record<PresetId, { name: string; description: string }>,
    /** Shown in the preset list for a model loaded from a link or a file. */
    customModel: "Loaded model",
    customModelDescription:
      "Loaded from a share link or a file. Pick a preset to start over.",
    scenario: "Scenario",
    scenarios: {
      bear: "Bear",
      base: "Base",
      bull: "Bull",
    } satisfies Record<Scenario, string>,
    undo: "Undo",
    reset: "Reset to preset",
    pinBaseline: "Pin as baseline",
    clearBaseline: "Clear baseline",
    baselineNote:
      "A baseline is pinned. Charts show it as a dashed line, and each figure shows the baseline value under it.",
    share: "Copy share link",
    shareCopied: "Link copied",
    shareFailed: "The link could not be copied. Copy it from the address bar.",
    shareNote:
      "The link holds your inputs in the part of the address after the #. That part is never sent to a server.",
    more: "Export and import",
    exportJson: "Download model (JSON)",
    exportCsv: "Download monthly data (CSV)",
    print: "Print or save as PDF",
    importJson: "Load a model file",
    importDone: "Model loaded",
    importFailed: "That file is not a model saved from this simulator.",
    linkLoaded:
      "Loaded the model from the link. Your own model is still saved, and Undo brings it back.",
    linkInvalid:
      "The link did not contain a readable model, so your last saved inputs are shown.",
    skipToResults: "Skip to results",
  },

  inputs: {
    title: "Inputs",
    helpAbout: (label: string) => `About ${label}`,
    problems: (count: number) =>
      count === 1 ? "1 problem" : `${count} problems`,
    units: {
      tokens: "tokens",
      usd: "USD",
      usdPerToken: "USD",
      percent: "%",
      months: "mo",
      count: "",
      multiplier: "×",
    } satisfies Record<FieldUnit, string>,

    sections: {
      token: {
        title: "Token",
        intro: "Supply and price at launch.",
      },
      allocations: {
        title: "Allocations",
        intro:
          "Who holds the genesis supply, when it unlocks and how much of each unlock is sold.",
      },
      emissions: {
        title: "Emissions",
        intro: "New tokens minted after launch.",
      },
      staking: {
        title: "Staking",
        intro:
          "Staked tokens are left out of holder selling. You set the staked share; the model does not derive it from the yield.",
      },
      utility: {
        title: "Users and revenue",
        intro: "Demand that comes from people using the product.",
      },
      speculation: {
        title: "Speculative demand",
        intro:
          "Buying that does not come from use of the product. You set this assumption, and the simulated price depends on it.",
      },
      market: {
        title: "Market depth",
        intro: "How far a given amount of buying or selling moves the price.",
      },
      treasury: {
        title: "Treasury",
        intro:
          "Reserves, operating costs and the rule for selling treasury tokens.",
      },
      simulation: {
        title: "Simulation settings",
        intro:
          "Monte Carlo runs repeat the scenario with random shocks to the market, to user growth and to sell rates.",
      },
    } satisfies Record<SectionId, { title: string; intro: string }>,

    /** One line beside a closed section's title. */
    summaries: {
      allocations: (rows: number, total: string) =>
        `${rows === 1 ? "1 row" : `${rows} rows`} · ${total}`,
      horizon: (n: number) => months(n),
      noEmissions: "None",
      noCap: "no cap",
      runs: (n: string) => `${n} runs`,
    },

    tokenName: {
      label: "Token name",
      help: "Shown on the printed report and in exported files. Optional.",
    } satisfies FieldCopy,
    tokenNamePlaceholder: "Example Token",
    tokenSymbol: {
      label: "Symbol",
      help: "Up to 10 characters. Used as the unit for token amounts.",
    } satisfies FieldCopy,

    emissionMode: {
      label: "Emission model",
      help: "None keeps supply fixed at genesis. Inflation rate mints a share of the current supply every month, sized so that supply grows by the yearly rate over twelve months. Fixed amount mints a set number of tokens per month, with optional decay.",
      options: {
        none: "None",
        inflation: "Inflation rate",
        fixed: "Fixed amount",
      },
    } satisfies ChoiceCopy<EmissionMode>,
    decay: {
      label: "Decay",
      help: "Halving cuts monthly emissions in half at a fixed interval. Annual reduces them by a percentage once every 12 months.",
      options: { none: "None", halving: "Halving", annual: "Annual" },
    } satisfies ChoiceCopy<DecayMode>,
    capBasis: {
      label: "The cap counts",
      help: "Tokens ever minted: genesis supply plus everything emitted stays under the cap. Tokens outstanding: burned tokens free up room under the cap, so emission can resume after burns.",
      options: {
        minted: "Tokens ever minted",
        outstanding: "Tokens outstanding",
      },
    } satisfies ChoiceCopy<CapBasis>,
    maxSupplyPlaceholder: "No cap",
    sellTokens: {
      label: "Sell tokens to fund costs",
      help: "When on, the treasury sells its own unlocked tokens once reserves fall below the buffer.",
    } satisfies FieldCopy,
    scenario: {
      label: "Scenario",
      help: "Multiplies speculative buying by the factor set for it below.",
    } satisfies FieldCopy,
    outcomeMonths: {
      label: "Outcome months",
      help: "Months at which the holder table reports value and return multiples. Up to four, separated by commas.",
    } satisfies FieldCopy,
    outcomeMonthsInvalid:
      "Enter up to four different months between 1 and 120, separated by commas.",
    revenueSplitTitle: "Where revenue goes",
    revenueRemainder: (share: string) =>
      `The remaining ${share} leaves the model, for example to service providers.`,

    fields: {
      horizonMonths: {
        label: "Simulation length",
        help: "How many months after launch to simulate, from 12 to 120.",
      },
      "token.genesisSupply": {
        label: "Genesis supply",
        help: "Tokens created at launch. The allocations split this number, and emissions add to it later.",
      },
      "token.tgePriceUsd": {
        label: "Launch price",
        help: "Price at the token generation event (TGE), in USD. The model takes it as given and assumes no selling in month 0.",
      },
      "emissions.annualInflationRate": {
        label: "Annual inflation",
        help: "Yearly growth of the total supply from emissions. It is applied in monthly steps that add up to this rate over a year.",
      },
      "emissions.tokensPerMonth": {
        label: "Tokens per month",
        help: "Tokens emitted in month 1. Decay reduces the amount emitted in later months.",
      },
      "emissions.halvingEveryMonths": {
        label: "Halving every",
        help: "Months between halvings.",
      },
      "emissions.annualDecayRate": {
        label: "Annual decay",
        help: "Reduction applied to monthly emissions once every 12 months.",
      },
      "emissions.maxSupply": {
        label: "Maximum supply",
        help: "Hard cap in tokens. Leave it empty for no cap. It cannot be below genesis supply.",
      },
      "emissions.sellRate": {
        label: "Emissions sold",
        help: "Share of newly emitted tokens sold in the month they are emitted.",
      },
      "emissions.toStakersShare": {
        label: "Emissions paid to stakers",
        help: "The rest goes to other recipients, such as players or node operators. This setting changes the staking yield and nothing else.",
      },
      "staking.initialRatio": {
        label: "Staked at launch",
        help: "Share of circulating supply staked in month 0.",
      },
      "staking.targetRatio": {
        label: "Target staked share",
        help: "Share of circulating supply staked once the ramp ends.",
      },
      "staking.rampMonths": {
        label: "Ramp",
        help: "Months to move in a straight line from the launch share to the target. At 0, the target applies from launch.",
      },
      "utility.initialUsers": {
        label: "Users at launch",
        help: "Paying users in month 0.",
      },
      "utility.saturationUsers": {
        label: "User ceiling",
        help: "The number of users at which growth levels off.",
      },
      "utility.monthlyGrowthRate": {
        label: "Monthly growth",
        help: "Growth rate while users are far below the ceiling. Growth follows an S-curve and slows as users approach the ceiling.",
      },
      "utility.spendPerUserUsd": {
        label: "Spend per user",
        help: "USD each user spends per month. Multiplying users by spend gives the protocol's revenue.",
      },
      "utility.holdingMonths": {
        label: "Balance users hold",
        help: "Months of spend a user keeps as a token balance. Growing balances are bought on the market and shrinking ones are sold. At 0, users buy and spend in the same month, which adds no net demand.",
      },
      "revenueSplit.burnShare": {
        label: "Burned",
        help: "Share of revenue used to buy tokens on the market and burn them.",
      },
      "revenueSplit.treasuryShare": {
        label: "To the treasury",
        help: "Share of revenue paid to the treasury in USD.",
      },
      "revenueSplit.stakerShare": {
        label: "To stakers",
        help: "Share of revenue paid to stakers in USD. It raises the staking yield.",
      },
      "speculation.baseInflowUsd": {
        label: "Monthly buying",
        help: "USD of discretionary buying in month 1, before the scenario multiplier.",
      },
      "speculation.monthlyGrowth": {
        label: "Growth per month",
        help: "Monthly change in that buying, between −20% and 20%.",
      },
      "speculation.scenarioMultipliers.bear": {
        label: "Bear multiplier",
        help: "Factor applied to speculative buying in the bear scenario.",
      },
      "speculation.scenarioMultipliers.base": {
        label: "Base multiplier",
        help: "Factor applied to speculative buying in the base scenario.",
      },
      "speculation.scenarioMultipliers.bull": {
        label: "Bull multiplier",
        help: "Factor applied to speculative buying in the bull scenario.",
      },
      "speculation.momentum": {
        label: "Momentum",
        help: "How strongly last month's price change feeds into this month's buying. 0 switches it off. At 1, a 10% rise adds 10% to buying. The effect is limited to between half and double.",
      },
      "market.depthRatio": {
        label: "Depth",
        help: "The USD side of the pool that a month's trades pass through, as a share of last month's circulating market cap. Lower depth means larger price moves. It is a monthly absorption constant and does not describe an order book.",
      },
      "market.minDepthUsd": {
        label: "Minimum depth",
        help: "Floor for that pool in USD, so that depth cannot vanish when the price falls.",
      },
      "market.holderSellRate": {
        label: "Holder selling",
        help: "Share of the liquid, unstaked supply that existing holders sell each month.",
      },
      "treasury.startingUsd": {
        label: "Starting reserves",
        help: "USD or stablecoins the treasury holds at launch.",
      },
      "treasury.monthlyCostUsd": {
        label: "Monthly cost",
        help: "Operating cost in month 1, in USD.",
      },
      "treasury.annualCostGrowth": {
        label: "Cost growth",
        help: "Yearly change in operating cost.",
      },
      "treasury.bufferMonths": {
        label: "Buffer",
        help: "The treasury sells tokens when reserves fall below this many months of cost.",
      },
      "treasury.maxMonthlySaleShare": {
        label: "Monthly sale cap",
        help: "The most the treasury may sell in one month, as a share of last month's circulating supply.",
      },
      "monteCarlo.runs": {
        label: "Runs",
        help: "Number of random runs, from 50 to 2,000. More runs give smoother bands and take longer.",
      },
      "monteCarlo.seed": {
        label: "Seed",
        help: "Starting point of the random number generator. The same seed and inputs always produce the same bands.",
      },
      "monteCarlo.marketVolatility": {
        label: "Market volatility",
        help: "Size of the monthly random shock to speculative buying. A shock carries over into the following months and fades.",
      },
      "monteCarlo.growthVolatility": {
        label: "Growth uncertainty",
        help: "Spread of the user growth rate across runs. Each run draws one rate and keeps it.",
      },
      "monteCarlo.sellPropensityVolatility": {
        label: "Sell-rate uncertainty",
        help: "Spread of each allocation's sell rate across runs. Each run draws one rate per row and keeps it.",
      },
    } satisfies Record<ModelFieldPath, FieldCopy>,

    allocations: {
      columns: {
        name: {
          label: "Name",
          help: "Your label for the group.",
        },
        category: {
          label: "Type",
          help: "Treasury rows unlock into the treasury's token balance, not into circulation. Team, investor and advisor rows count as insiders in the health checks. Beyond that, the type only groups rows in the charts.",
        },
        share: {
          label: "Share",
          help: "Percentage of genesis supply. All rows must add up to 100%.",
        },
        tgeUnlock: {
          label: "At launch",
          help: "Percentage of the row that is unlocked at launch.",
        },
        cliffMonths: {
          label: "Cliff",
          help: "Months before vesting starts. If a vesting period follows, nothing unlocks on the day the cliff ends and the first tranche arrives one release interval later.",
        },
        vestingMonths: {
          label: "Vesting",
          help: "Months after the cliff over which the rest unlocks. At 0, everything left unlocks when the cliff ends.",
        },
        vestingStepMonths: {
          label: "Release every",
          help: "Months between releases. 1 is monthly, 3 is quarterly.",
        },
        sellPropensity: {
          label: "Sold on unlock",
          help: "Share of each month's unlock that is sold in that month. Tokens unlocked at launch are not sold in month 0. Treasury rows ignore this setting.",
        },
        purchasePriceUsd: {
          label: "Price paid",
          help: "USD per token this group paid. Used for cost basis and return multiples. Leave it empty for groups that paid nothing.",
        },
      } satisfies Record<"name" | "category" | AllocationFieldKey, FieldCopy>,
      categories: {
        team: "Team",
        investors: "Investors",
        advisors: "Advisors",
        treasury: "Treasury",
        ecosystem: "Ecosystem",
        community: "Community",
        public_sale: "Public sale",
        liquidity: "Liquidity",
      } satisfies Record<AllocationCategory, string>,
      /** Names for the rows of the presets, by row id. */
      presetRowNames: {
        team: "Team",
        seed: "Seed round",
        strategic: "Strategic round",
        series_a: "Series A",
        series_b: "Series B",
        investors: "Investors",
        advisors: "Advisors",
        treasury: "Treasury",
        foundation: "Foundation",
        dao: "DAO treasury",
        incentives: "Incentives",
        ecosystem: "Ecosystem",
        bootstrap: "Network bootstrap",
        airdrop: "Airdrop",
        public: "Public sale",
        liquidity: "Liquidity",
      } as Record<string, string>,
      tokens: "Tokens",
      schedule: "Unlock schedule",
      addRow: "Add row",
      removeRow: (name: string) => `Remove ${name}`,
      editRow: (name: string) => `Edit ${name}`,
      newRowName: "New allocation",
      total: "Total",
      totalOff: (total: string) =>
        `The rows add up to ${total}. They must add up to 100%.`,
      rowLimit: "A model can have up to 16 rows.",
      lastRow: "A model needs at least one row.",
      noPrice: "none",
    },
  },

  issues: {
    allocations_sum: "Allocation shares must add up to 100%.",
    allocations_empty: "Add at least one allocation row.",
    duplicate_id:
      "Two allocation rows share the same internal ID. Remove one of them and add it again.",
    no_initial_float:
      "No tokens circulate at launch. Give at least one non-treasury row an unlock at launch.",
    revenue_split_over_one: "The revenue split adds up to more than 100%.",
    max_supply_below_genesis: "Maximum supply is below genesis supply.",
    treasury_row_propensity_ignored:
      "Treasury rows ignore the sold-on-unlock rate. The treasury settings decide when it sells.",
    row_fully_unlocked_at_tge:
      "With no cliff and no vesting, this row unlocks in full at launch, whatever its launch percentage says.",
    starting_usd_exceeds_implied_raise:
      "Starting reserves are higher than the amount raised at the prices entered for investors. Check that this is intended.",
    initial_users_above_ceiling:
      "Users at launch are above the user ceiling. The run starts at the ceiling.",
    momentum_gain_high:
      "Momentum is high for this market depth. Price moves can feed on themselves.",
  } satisfies Record<IssueCode, string>,

  results: {
    title: "Results",
    scenarioNote:
      "A conditional scenario, not a forecast. Every figure follows from the inputs on this page.",
    invalidTitle: "Fix the inputs to update the results",
    invalidStale: "The figures and charts below show the last valid run.",
    warningsTitle: "Notes on your inputs",
    /** Row-level issues are prefixed with the row's name. */
    issueForRow: (row: string, message: string) => `${row}: ${message}`,
    month: (n: number) => `Month ${n}`,
    inMonth: (n: number) => `in month ${n}`,
    /** A figure of the pinned baseline, shown under the current one. */
    baselineValue: (value: string) => `Baseline: ${value}`,

    /** The bar that follows the inputs on a narrow screen. Its labels are
     *  short forms of the key figures' labels: three of them share a phone's
     *  width. */
    bar: {
      price: "End price",
      unlock: "Largest unlock",
      checks: "Checks",
    },

    kpis: {
      title: "Key figures",
      initialMarketCap: {
        label: "Market cap at launch",
        help: "Circulating supply at launch times the launch price.",
      },
      initialFloat: {
        label: "Float at launch",
        help: "Share of genesis supply that circulates in month 0.",
      },
      priceAtHorizon: {
        label: "Price at end of simulation",
        help: "Price in the last simulated month of the single run without random shocks. The price chart shows the range across random runs.",
      },
      largestUnlock: {
        label: "Largest monthly unlock",
        help: "The biggest month of vesting into circulation, measured against the supply circulating the month before.",
      },
      inflationYear1: {
        label: "Net supply growth, year 1",
        help: "Change in total supply over the first 12 months: emissions minus burns. Vesting is not counted, because it moves tokens that already exist.",
      },
      halfUnlocked: {
        label: "Half of supply unlocked",
        help: "Months until half of genesis supply has unlocked, from the vesting schedule alone.",
      },
      runway: {
        label: "Treasury runway",
        help: "The month in which the treasury can no longer pay its costs.",
      },
      belowLaunch: {
        label: "Runs below launch price",
        help: "Share of Monte Carlo runs in which the price at month 12 is below the launch price.",
      },
      fdv: (value: string) => `FDV ${value}`,
      marketCapToFdv: (value: string) => `${value} of FDV`,
      timesLaunch: (multiple: string) => `${multiple} the launch price`,
      atMonth: (n: number) => `At month ${n}`,
      atLaunch: "At launch",
      ninetyAfter: (n: number) =>
        n === 0 ? "90% at launch" : `90% after ${months(n)}`,
      notWithin: (n: number) => `Not within ${months(n)}`,
      noUnlocks: "No unlocks after launch",
      runwayBeyond: "Beyond the horizon",
      runwayStatic: (n: string) =>
        `${n} ${n === "1" ? "month" : "months"} at launch reserves and cost`,
      noCost: "No costs entered",
      atMonth12: "at month 12",
      waiting: "Running",
    } satisfies Record<KpiId, FieldCopy> & Record<string, unknown>,

    health: {
      title: "Health checks",
      intro:
        "These checks use fixed thresholds as rules of thumb. They do not replace a review of your design.",
      status: {
        pass: "Pass",
        watch: "Watch",
        risk: "Risk",
        na: "Not applicable",
      } satisfies Record<HealthStatus, string>,
      summary: (risk: number, watch: number) =>
        risk + watch === 0
          ? "All checks pass"
          : `${risk} at risk, ${watch} to watch`,
      pending: "Waiting for the Monte Carlo runs",
      neverExhausted: "Reserves last the whole simulation",
      exhaustedIn: (n: number) => `Reserves run out in month ${n}`,
      monthsFlagged: (n: number) =>
        n === 0 ? "No month hit a limit" : `${months(n)} hit a limit`,
      burnedOfEmitted: (share: string) =>
        `Burns offset ${share} of emissions over the last 12 months.`,
      checks: {
        insider_share: {
          title: "Insider share",
          detail:
            "Share of genesis supply held by team, investors and advisors. Above a third, insiders hold a blocking minority. Above half, a majority.",
          thresholds: (watch, risk) =>
            `Watch above ${watch}, risk above ${risk}`,
        },
        low_float: {
          title: "Float against fully diluted value",
          detail:
            "Market cap at launch divided by fully diluted value. With a 10% float, keeping the price steady through full unlock means the market has to absorb nine times the launch market cap.",
          thresholds: (watch, risk) =>
            `Watch below ${watch}, risk below ${risk}`,
        },
        unlock_shock: {
          title: "Largest unlock",
          detail:
            "The largest month of unlocks against the supply circulating the month before. In this model, at the default depth and with half of the unlock sold, a 5% unlock lowers the price by about 21% and a 15% unlock by about 47%, before any buying.",
          thresholds: (watch, risk) =>
            `Watch from ${watch}, risk from ${risk}`,
        },
        net_inflation: {
          title: "Net supply growth",
          detail:
            "The highest growth in total supply over any 12 months, emissions minus burns. A holder who earns no rewards is diluted by this much.",
          thresholds: (watch, risk) =>
            `Watch above ${watch} a year, risk above ${risk}`,
        },
        runway: {
          title: "Treasury runway",
          detail:
            "The month in which the treasury can no longer pay its costs. 18 months is about the length of a long down market. 36 months is about one funding cycle.",
          thresholds: (watch, risk) =>
            `Watch if reserves run out by month ${watch}, risk by month ${risk}`,
        },
        treasury_token_dependence: {
          title: "Costs paid from token sales",
          detail:
            "Share of all operating costs funded by selling treasury tokens. A budget funded this way shrinks when the price falls.",
          thresholds: (watch, risk) =>
            `Watch above ${watch}, risk above ${risk}`,
        },
        structural_demand: {
          title: "Demand from use",
          detail:
            "Over the last 12 months: buying from burns and from user balances, divided by the value of all tokens offered for sale. The rest of the selling is absorbed only by the speculative buying you entered.",
          thresholds: (watch, risk) =>
            `Watch below ${watch}, risk below ${risk}`,
        },
        model_range: {
          title: "Model limits",
          detail:
            "Months in which the run hit a limit of the model: the cap on monthly price moves, the depth floor or the cap on burns. Treat the figures for those months with caution.",
          thresholds: () => "Watch if any month hits a limit",
        },
        treasury_exhaustion_probability: {
          title: "Runs with a treasury shortfall",
          detail:
            "Share of Monte Carlo runs in which the treasury cannot pay its costs at some point. It reflects the three modelled shocks and nothing else.",
          thresholds: (watch, risk) =>
            `Watch from ${watch}, risk from ${risk}`,
        },
      } satisfies Record<
        HealthCheckId,
        { title: string; detail: string; thresholds: Thresholds }
      >,
    },

    charts: {
      label: "Charts",
      tabs: {
        supply: "Supply",
        unlocks: "Unlocks",
        allocation: "Allocation",
        price: "Price",
        valuation: "Market cap",
        flows: "Buying and selling",
        staking: "Inflation and staking",
        treasury: "Treasury",
      } satisfies Record<ChartTabId, string>,
      xAxis: "Months since launch",
      total: "Total",
      showSeries: (label: string) => `Show ${label}`,
      keyboardHint:
        "Use the left and right arrow keys to move through the months.",
      downloadPng: "Download as PNG",
      downloadFailed: "The image could not be created in this browser.",
      baseline: (label: string) => `${label}, baseline`,
      monteCarloProgress: (done: string, total: string) =>
        `Monte Carlo: ${done} of ${total} runs`,
      monteCarloDone: (runs: string) => `${runs} Monte Carlo runs`,

      supply: {
        title: "Token supply over time",
        byState: "Supply by state",
        byHolder: "Unlocked supply by holder group",
        view: "Break down by",
        viewState: "State",
        viewHolder: "Holder group",
        note: "Locked tokens have not vested yet. Unlocked treasury tokens are held by the treasury and do not circulate until it sells them.",
        holderNote:
          "Cumulative tokens unlocked for each group, plus emissions. Unlocked treasury tokens are included here although they do not circulate until sold.",
      },
      unlocks: {
        title: "Tokens unlocked each month",
        note: "Vesting by holder group, plus new emissions. The launch unlock is left out so that the later months stay readable.",
      },
      allocation: {
        title: "Allocation of genesis supply",
        center: "Genesis supply",
      },
      price: {
        title: "Token price",
        scale: "Scale",
        linear: "Linear",
        log: "Log",
        note: "The price level is the ratio of two inputs: the USD of buying and the tokens offered for sale. The bands cover three random shocks (market, user growth and sell rates) and are not confidence intervals. The median of the random runs is not the same line as the single run without shocks.",
      },
      valuation: {
        title: "Market cap and fully diluted value",
        note: "Market cap counts circulating tokens. Fully diluted value counts maximum supply, or total supply when there is no cap.",
      },
      flows: {
        title: "Buying and selling each month",
        net: "Buying less selling",
        note: "Buying is in USD. Selling is the tokens offered for sale, valued at the previous month's price, and is shown below zero.",
      },
      staking: {
        title: "Supply growth, staking and yield",
        note: "Yields are simple annual rates: the monthly rate times 12. The real yield subtracts net supply growth.",
      },
      treasury: {
        title: "Treasury reserves",
        flowsTitle: "Treasury income and costs each month",
        net: "Income less costs",
        note: "Reserves are in USD. Token sales appear only when reserves fall below the buffer.",
        exhausted: "Reserves run out",
      },

      series: {
        liquid: "Liquid",
        staked: "Staked",
        treasuryTokens: "Treasury, unlocked",
        locked: "Locked",
        emissions: "Emissions",
        totalSupply: "Total supply",
        circulating: "Circulating supply",
        price: "Price",
        median: "Median of random runs",
        band90: "5th to 95th percentile",
        band50: "25th to 75th percentile",
        launchPrice: "Launch price",
        marketCap: "Market cap",
        fdv: "Fully diluted value",
        speculativeBuying: "Speculative buying",
        burnBuying: "Buying for burns",
        balanceBuying: "User balances, buying",
        unlockSelling: "Unlock selling",
        emissionSelling: "Emission selling",
        holderSelling: "Holder selling",
        treasurySelling: "Treasury sales",
        balanceSelling: "User balances, selling",
        netInflation: "Net supply growth, annualised",
        stakedShare: "Staked share",
        yieldNominal: "Staking yield, nominal",
        yieldReal: "Staking yield, real",
        reserves: "Reserves",
        costs: "Costs",
        treasuryRevenue: "Revenue to the treasury",
        saleProceeds: "Token sale proceeds",
        unpaidCosts: "Unpaid costs",
      },
    },

    holders: {
      title: "Holder outcomes",
      intro:
        "Each allocation at the months you chose, valued at the simulated price. The paper multiple is the price divided by the price paid. The liquid multiple counts unlocked tokens only.",
      group: "Group",
      tokens: "Tokens",
      costBasis: "Cost basis",
      unlockedValue: "Unlocked value",
      lockedValue: "Locked value",
      paperMultiple: "Paper multiple",
      liquidMultiple: "Liquid multiple",
      monthSelect: "Month",
    },

    table: {
      title: "Monthly data",
      intro: "Every series behind the charts, one row per month.",
      show: "Show the table",
      hide: "Hide the table",
      download: "Download CSV",
      columns: {
        month: "Month",
        priceUsd: "Price (USD)",
        marketCapUsd: "Market cap (USD)",
        fdvUsd: "FDV (USD)",
        totalSupply: "Total supply",
        circulating: "Circulating",
        liquid: "Liquid",
        staked: "Staked",
        locked: "Locked",
        treasuryTokens: "Treasury tokens",
        burnedCum: "Burned, cumulative",
        emittedCum: "Emitted, cumulative",
        unlockTokens: "Unlocked",
        emissionTokens: "Emitted",
        burnTokens: "Burned",
        buyUsd: "Buying (USD)",
        sellPressureUsd: "Selling (USD)",
        treasuryUsd: "Reserves (USD)",
        users: "Users",
        stakedRatio: "Staked share",
        netInflationAnnualised: "Net supply growth, annualised",
        stakingYieldNominal: "Staking yield, nominal",
        stakingYieldReal: "Staking yield, real",
      },
    },
  },

  print: {
    title: (tokenName: string) =>
      tokenName ? `${tokenName}: tokenomics scenario` : "Tokenomics scenario",
    source: (url: string) => `Made with the Block Consult token simulator, ${url}`,
    inputs: "Inputs",
    disclaimer:
      "A conditional scenario built from the inputs listed here. It is not a forecast and not financial advice.",
  },

  failure: {
    title: "The simulator stopped",
    body: "An error stopped the simulator. Try again first. If it stops again, start from the default model. That removes the inputs saved in this browser.",
    retry: "Try again",
    startAgain: "Start from the default model",
  },
};
