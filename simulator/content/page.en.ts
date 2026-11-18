/**
 * Copy of the simulator page outside the tool itself: metadata, header and
 * footer, the introduction, the method, the questions and the notice.
 * Rendered on the server. The German file is typed against this one.
 *
 * Every statement about the model here describes simulator/engine. When the
 * engine changes, this text changes with it.
 */

interface SiteLink {
  label: string;
  /** Unprefixed path on the main site. */
  path: string;
}

interface MethodSection {
  title: string;
  paragraphs: string[];
  /** Shown after the paragraphs. */
  list?: string[];
}

export const pageEn = {
  meta: {
    title: "Tokenomics simulator",
    description:
      "Free tokenomics simulator. Model allocations, vesting, emissions, staking, burns, price scenarios and treasury runway, then share the result. No sign-up, and your inputs stay in your browser.",
    imageAlt:
      "Tokenomics simulator by Block Consult: supply, unlocks, price scenarios and treasury runway",
  },

  chrome: {
    toolName: "Token simulator",
    nav: [
      { label: "Token design", path: "/services/tokenomics" },
      { label: "Web3", path: "/web3" },
      { label: "Blog", path: "/blog" },
    ] as SiteLink[],
    navLabel: "Block Consult",
    contact: "Talk to us",
    footerLinks: [
      { label: "Legal", path: "/legal" },
      { label: "Privacy Policy", path: "/privacy" },
      { label: "Contact", path: "/contact" },
    ] as SiteLink[],
    footerNote:
      "The simulator produces conditional scenarios from the inputs you enter. It is not a forecast and not financial advice.",
  },

  hero: {
    eyebrow: "Free tool",
    title: "Tokenomics simulator",
    lead: "Enter your allocations, vesting, emissions, demand and treasury assumptions. The simulator shows how those assumptions affect supply, unlocks, price and runway month by month.",
    facts: [
      "No sign-up",
      "Runs on your device",
      "Inputs are not sent to a server",
    ],
  },

  method: {
    eyebrow: "Method",
    title: "How the model works",
    lead: "The model runs in monthly steps, in a fixed order. The steps and limitations below explain how to interpret the results.",
    sections: [
      {
        title: "One month at a time",
        paragraphs: [
          "The run starts at the token generation event, month 0, and advances in monthly steps to the horizon you set. In month 0 the launch unlocks are in circulation, the price is the launch price you entered and nothing is traded.",
          "Every later month runs the same steps in the same order. Decisions inside a month use the previous month's price and supply, so no step depends on a value that is still being computed.",
        ],
        list: [
          "Market depth is set from the previous month's circulating market cap.",
          "Vested tokens unlock, and a share of each allocation's unlock is offered for sale.",
          "Emissions are minted up to the supply cap, and a share of them is offered for sale.",
          "The user count grows along an S-curve. Multiplying users by spend gives revenue, which is split between a burn, the treasury and stakers.",
          "Speculative buying is computed from the inflow you entered, the scenario and the previous month's price change.",
          "The treasury checks its reserves against its buffer and decides whether to sell tokens.",
          "All of the month's buying and selling passes through the market in one trade, which sets the new price.",
          "Tokens bought for the burn are destroyed, the treasury books its income and costs, and the staked share moves to its target.",
        ],
      },
      {
        title: "How the price is set",
        paragraphs: [
          "The price comes from a constant-product pool, the pricing rule used by automated market makers. The USD side of the pool equals the depth setting times the previous month's circulating market cap, with a floor in USD.",
          "The month's buying, in USD, and the month's selling, in tokens, trade against that pool together. The model uses the exact outcome for two flows that arrive evenly through the month, so the result does not depend on how finely the month is sliced. The price moves from last month's level towards the ratio of USD buying to tokens sold and never passes it.",
          "At the default depth of 20%, one dollar of net buying moves the market cap by about ten dollars. That figure is an assumption. It is not calibrated to any market. A single month's price change is limited to a factor of five in either direction, and months that reach the limit are flagged in the health checks.",
        ],
      },
      {
        title: "Where demand comes from",
        paragraphs: [
          "Speculative demand is an input. You enter the monthly buying in USD and how it grows. The scenario multiplies it, and momentum raises or lowers it with the previous month's price change, limited to between half and double.",
          "Demand from use is counted net. Revenue that is routed to the burn buys tokens on the market. Users who keep a working balance of tokens buy as the total balance grows and sell as it shrinks. Gross spending by users is not counted as buying, because whoever receives those tokens sells them again.",
        ],
      },
      {
        title: "Supply and selling",
        paragraphs: [
          "Each allocation has an unlock at launch, a cliff and a vesting period with a release interval. When a vesting period follows the cliff, nothing unlocks on the day the cliff ends, and the first tranche arrives one interval later. Without a vesting period, the rest unlocks when the cliff ends. Treasury allocations unlock into the treasury's own balance and reach the market only when the treasury sells.",
          "Selling has four sources: a share of each month's unlock, a share of each month's emissions, a fixed monthly share of the liquid supply held by existing holders, and treasury sales. Staked tokens are left out of holder selling. Tokens unlocked at launch are not sold in month 0, because the launch price is taken as given.",
          "Emissions follow either a yearly inflation rate on current supply or a fixed monthly amount with optional halving or annual decay. A supply cap can count every token ever minted, or only tokens outstanding, in which case burns make room for new emissions. Net supply growth is emissions minus burns. Vesting is not counted as inflation, because it moves tokens that already exist.",
        ],
      },
      {
        title: "The treasury",
        paragraphs: [
          "The treasury starts with the reserves you enter, receives its share of revenue each month and pays an operating cost that grows at a yearly rate.",
          "If token sales are switched on and reserves fall below the buffer, the treasury sells unlocked tokens to refill it. The sale amount increases to account for its expected effect on price and is limited by the monthly cap and by the tokens the treasury holds. Runway ends in the first month in which more than 1% of the month's cost goes unpaid.",
        ],
      },
      {
        title: "Monte Carlo runs",
        paragraphs: [
          "Each random run repeats the scenario with three sources of variation. A market factor multiplies speculative buying, changes every month and carries most of its value into the next month. Each run draws one user growth rate and one sell rate for each allocation.",
          "The bands on the price and market cap charts show the 5th to 95th and the 25th to 75th percentile across runs. Runs are seeded, so the same seed and inputs always give the same bands. The shocks are centred, but the median of the runs is not the same line as the single run without shocks.",
        ],
      },
      {
        title: "What the model leaves out",
        paragraphs: [
          "The results are conditional scenarios. They show what follows from a set of assumptions, and they are most useful for comparing two designs under the same assumptions.",
        ],
        list: [
          "The price level is the ratio of two inputs, buying in USD and tokens offered for sale. Nothing in the model pulls the price towards a fair value.",
          "Depth is a monthly absorption constant. It does not describe an order book, and because it scales with market cap it shrinks when the price falls.",
          "Sellers do not react to the price. They sell the same share of their tokens at any level.",
          "Monthly steps smooth out what happens inside a month, such as the day a cliff ends.",
          "The staked share is an input. The model does not derive it from the yield.",
          "The bands cover three shocks and are not confidence intervals.",
          "The model has no trading fees, taxes, lending markets or second token.",
        ],
      },
    ] as MethodSection[],
  },

  faq: {
    title: "Questions about the simulator",
    items: [
      {
        q: "Is the simulator free?",
        a: "Yes. There is no account, no email form and no limit on how often you use it.",
      },
      {
        q: "Where do my inputs go?",
        a: "They stay in your browser. The calculation runs on your device, and the model is saved in your browser's local storage so that it is still there when you come back. A share link stores the model in the part of the address after the # sign, which browsers do not send to a server.",
      },
      {
        q: "Can it predict the price of my token?",
        a: "No. The price in the simulator depends on the speculative buying you enter and on an assumption about market depth. Use it to compare designs under the same assumptions, for example to see how a longer cliff or a lower emission rate changes sell pressure, float and runway.",
      },
      {
        q: "Which token designs can I model?",
        a: "Fixed supply, yearly inflation, fixed emissions with halving or decay, supply caps, burn and mint, staking funded by emissions or by revenue, and buy-and-burn from revenue. The simulator does not model rebasing tokens, bonding curves, vote-escrow locks or systems with two tokens.",
      },
      {
        q: "What do the bands on the price chart mean?",
        a: "They show the range of prices across the random runs: the middle half of the runs and the middle 90%. They reflect three modelled shocks, to the market, to user growth and to sell rates. They are not confidence intervals for a real price.",
      },
      {
        q: "How do the health checks work?",
        a: "Each check compares one figure from the run with two fixed thresholds, for example the share of supply held by insiders or the largest monthly unlock. The thresholds and the reasoning are shown with each check. They are rules of thumb.",
      },
      {
        q: "How do I save or share a model?",
        a: "Copy the share link to send the model to someone else, or download it as a JSON file and load it again later. You can also download the monthly data as a CSV file and print the page as a PDF report.",
      },
      {
        q: "Can Block Consult review my token design?",
        a: "Yes. Token design and stress-testing is one of our services. Send us your share link through the contact page and tell us what you want to test.",
      },
    ],
  },

  notice: {
    title: "A scenario, not a forecast",
    body: "The simulator turns the assumptions you enter into a conditional scenario. It does not forecast prices and it is not financial, investment, legal or tax advice. Block Consult gives no warranty for the results, and decisions based on them are your own.",
  },

  cta: {
    title: "When your project needs its own model",
    body: "The simulator covers the common token designs. A project with its own mechanisms needs a model built for it. Block Consult designs token economies and stress-tests them against demand, price and adversarial scenarios.",
    button: "Talk to us",
    path: "/contact",
    secondary: "About our token design service",
    secondaryPath: "/services/tokenomics",
  },

  breadcrumb: { home: "Block Consult", tool: "Tokenomics simulator" },

  /** The pointer to the tool on the token design service page. */
  serviceCallout: {
    eyebrow: "Free tool",
    title: "Token simulator",
    body: "Enter allocations, vesting, emissions and demand, and see supply, unlocks, price scenarios and treasury runway month by month. No sign-up.",
    button: "Open the simulator",
  },
};
