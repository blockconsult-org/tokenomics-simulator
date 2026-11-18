import type { SimulatorUi } from "./index";

/**
 * Interface text of the simulator, German. Swiss Standard German: ss, Sie,
 * and an apostrophe as the thousands separator, as the number formatter
 * prints it. Typed against ui.en.ts; keys and their order mirror that file.
 */

const months = (n: number) => (n === 1 ? "1 Monat" : `${n} Monate`);

/** After "nach" and "von" the plural takes the dative: "nach 12 Monaten". */
const monthsDative = (n: number) => (n === 1 ? "1 Monat" : `${n} Monaten`);

export const de: SimulatorUi = {
  months,

  toolbar: {
    label: "Modell",
    preset: "Vorlage",
    presets: {
      defi_governance: {
        name: "DeFi-Governance-Token",
        description:
          "Keine Emissionen. Team und zwei Investorenrunden mit einjährigem Cliff, ein grosser Anreizpool und ein tiefer Float beim Launch.",
      },
      staking_network: {
        name: "Staking-Netzwerk",
        description:
          "6% jährliche Inflation an die Staker, eine Ziel-Staking-Quote von 60% und Gebühren, die zwischen einem Burn und den Stakern aufgeteilt werden.",
      },
      consumer_game: {
        name: "Consumer- oder Game-Token",
        description:
          "Rewards an die Spieler mit jährlicher Abnahme und einer Obergrenze für das Angebot. Die Spieler halten ein Token-Guthaben für ihre Ausgaben.",
      },
      depin: {
        name: "DePIN, Burn-and-Mint",
        description:
          "Der gesamte Umsatz kauft Token und verbrennt sie. Die Emissionen gehen grösstenteils an die Betreiber, halbieren sich alle zwei Jahre und unterliegen einer Obergrenze für die ausstehenden Token.",
      },
      fair_launch: {
        name: "Fair Launch",
        description:
          "Keine Allokation für Team oder Investoren. 60% gehen beim Launch in den Public Sale, die Emissionen halbieren sich jedes Jahr.",
      },
    },
    /** Shown in the preset list for a model loaded from a link or a file. */
    customModel: "Geladenes Modell",
    customModelDescription:
      "Aus einem geteilten Link oder einer Datei geladen. Wählen Sie eine Vorlage, um neu zu beginnen.",
    scenario: "Szenario",
    scenarios: {
      bear: "Bear",
      base: "Base",
      bull: "Bull",
    },
    undo: "Rückgängig",
    reset: "Auf Vorlage zurücksetzen",
    pinBaseline: "Als Referenz festhalten",
    clearBaseline: "Referenz entfernen",
    baselineNote:
      "Eine Referenz ist festgehalten. Die Diagramme zeigen sie als gestrichelte Linie, und unter jeder Kennzahl steht der Wert der Referenz.",
    share: "Link zum Teilen kopieren",
    shareCopied: "Link kopiert",
    shareFailed:
      "Der Link konnte nicht kopiert werden. Kopieren Sie ihn aus der Adresszeile.",
    shareNote:
      "Der Link enthält Ihre Eingaben im Teil der Adresse nach dem #. Dieser Teil wird nie an einen Server gesendet.",
    more: "Export und Import",
    exportJson: "Modell herunterladen (JSON)",
    exportCsv: "Monatsdaten herunterladen (CSV)",
    print: "Drucken oder als PDF speichern",
    importJson: "Modelldatei laden",
    importDone: "Modell geladen",
    importFailed:
      "Diese Datei ist kein Modell, das mit diesem Simulator gespeichert wurde.",
    linkLoaded:
      "Modell aus dem Link geladen. Ihr eigenes Modell bleibt gespeichert, und «Rückgängig» holt es zurück.",
    linkInvalid:
      "Der Link enthielt kein lesbares Modell. Angezeigt werden deshalb Ihre zuletzt gespeicherten Eingaben.",
    skipToResults: "Zu den Ergebnissen springen",
  },

  inputs: {
    title: "Eingaben",
    helpAbout: (label: string) => `Erklärung: ${label}`,
    problems: (count: number) =>
      count === 1 ? "1 Problem" : `${count} Probleme`,
    units: {
      tokens: "Token",
      usd: "USD",
      usdPerToken: "USD",
      percent: "%",
      months: "Mt.",
      count: "",
      multiplier: "×",
    },

    sections: {
      token: {
        title: "Token",
        intro: "Das Angebot beim Launch und der Launch-Preis.",
      },
      allocations: {
        title: "Allokationen",
        intro:
          "Wer das Genesis-Angebot hält, wann es frei wird und wie viel von jedem Unlock verkauft wird.",
      },
      emissions: {
        title: "Emissionen",
        intro: "Neue Token, die nach dem Launch geprägt werden.",
      },
      staking: {
        title: "Staking",
        intro:
          "Gestakte Token sind von den Verkäufen der Halter ausgenommen. Die Staking-Quote legen Sie fest. Das Modell leitet sie nicht aus der Rendite ab.",
      },
      utility: {
        title: "Nutzer und Umsatz",
        intro: "Nachfrage, die aus der Nutzung des Produkts entsteht.",
      },
      speculation: {
        title: "Spekulative Nachfrage",
        intro:
          "Käufe, die nicht aus der Nutzung des Produkts stammen. Diese Annahme geben Sie selbst ein, und das Preisniveau hängt von ihr ab.",
      },
      market: {
        title: "Markttiefe",
        intro:
          "Wie stark ein bestimmtes Kauf- oder Verkaufsvolumen den Preis bewegt.",
      },
      treasury: {
        title: "Treasury",
        intro:
          "Reserven, Betriebskosten und die Regel für den Verkauf von Treasury-Token.",
      },
      simulation: {
        title: "Simulationseinstellungen",
        intro:
          "Monte-Carlo-Läufe wiederholen das Szenario mit Zufallsschocks auf den Markt, das Nutzerwachstum und die Verkaufsquoten.",
      },
    },

    /** One line beside a closed section's title. */
    summaries: {
      allocations: (rows: number, total: string) =>
        `${rows === 1 ? "1 Zeile" : `${rows} Zeilen`} · ${total}`,
      horizon: (n: number) => months(n),
      noEmissions: "Keine",
      noCap: "ohne Obergrenze",
      runs: (n: string) => `${n} Läufe`,
    },

    tokenName: {
      label: "Token-Name",
      help: "Erscheint im gedruckten Bericht und in exportierten Dateien. Optional.",
    },
    tokenNamePlaceholder: "Beispiel-Token",
    tokenSymbol: {
      label: "Symbol",
      help: "Bis zu 10 Zeichen. Dient als Einheit für Token-Mengen.",
    },

    emissionMode: {
      label: "Emissionsmodell",
      help: "Keine: Das Angebot bleibt auf dem Stand des Genesis-Angebots. Inflationsrate: Jeden Monat wird ein Anteil des aktuellen Angebots geprägt, so bemessen, dass das Angebot über zwölf Monate um die Jahresrate wächst. Feste Menge: Pro Monat wird eine feste Anzahl Token geprägt, wahlweise mit Abnahme.",
      options: {
        none: "Keine",
        inflation: "Inflationsrate",
        fixed: "Feste Menge",
      },
    },
    decay: {
      label: "Abnahme",
      help: "Halving halbiert die monatlichen Emissionen in einem festen Abstand. Jährlich senkt sie einmal alle 12 Monate um einen Prozentsatz.",
      options: { none: "Keine", halving: "Halving", annual: "Jährlich" },
    },
    capBasis: {
      label: "Die Obergrenze zählt",
      help: "Alle je geprägten Token: Das Genesis-Angebot plus alle Emissionen bleibt unter der Obergrenze. Ausstehende Token: Verbrannte Token schaffen wieder Platz unter der Obergrenze, sodass nach Burns erneut emittiert werden kann.",
      options: {
        minted: "Alle je geprägten Token",
        outstanding: "Ausstehende Token",
      },
    },
    maxSupplyPlaceholder: "Keine Obergrenze",
    sellTokens: {
      label: "Token verkaufen, um Kosten zu decken",
      help: "Ist die Option aktiv, verkauft die Treasury ihre eigenen freigegebenen Token, sobald die Reserven unter den Puffer fallen.",
    },
    scenario: {
      label: "Szenario",
      help: "Multipliziert die spekulativen Käufe mit dem Faktor, der unten für das Szenario festgelegt ist.",
    },
    outcomeMonths: {
      label: "Auswertungsmonate",
      help: "Monate, für die die Haltertabelle Wert und Multiples ausweist. Bis zu vier, durch Kommas getrennt.",
    },
    outcomeMonthsInvalid:
      "Geben Sie bis zu vier verschiedene Monate zwischen 1 und 120 ein, durch Kommas getrennt.",
    revenueSplitTitle: "Verwendung des Umsatzes",
    revenueRemainder: (share: string) =>
      `Der Rest von ${share} fliesst aus dem Modell ab, zum Beispiel an Dienstleister.`,

    fields: {
      horizonMonths: {
        label: "Simulationsdauer",
        help: "Wie viele Monate nach dem Launch simuliert werden, von 12 bis 120.",
      },
      "token.genesisSupply": {
        label: "Genesis-Angebot",
        help: "Token, die beim Launch erzeugt werden. Die Allokationen teilen diese Menge auf, Emissionen kommen später hinzu.",
      },
      "token.tgePriceUsd": {
        label: "Launch-Preis",
        help: "Preis beim Token Generation Event (TGE), in USD. Das Modell nimmt ihn als gegeben an und geht davon aus, dass in Monat 0 nichts verkauft wird.",
      },
      "emissions.annualInflationRate": {
        label: "Jährliche Inflation",
        help: "Jährliches Wachstum des Gesamtangebots durch Emissionen. Die Rate wird in Monatsschritten angewendet, die über ein Jahr zusammen diese Rate ergeben.",
      },
      "emissions.tokensPerMonth": {
        label: "Token pro Monat",
        help: "In Monat 1 emittierte Token. Die Abnahme reduziert die in späteren Monaten emittierte Menge.",
      },
      "emissions.halvingEveryMonths": {
        label: "Halving alle",
        help: "Monate zwischen zwei Halvings.",
      },
      "emissions.annualDecayRate": {
        label: "Jährliche Abnahme",
        help: "Kürzung der monatlichen Emissionen, einmal alle 12 Monate.",
      },
      "emissions.maxSupply": {
        label: "Maximales Angebot",
        help: "Harte Obergrenze in Token. Lassen Sie das Feld leer, wenn es keine Obergrenze gibt. Sie darf nicht unter dem Genesis-Angebot liegen.",
      },
      "emissions.sellRate": {
        label: "Verkaufte Emissionen",
        help: "Anteil der neu emittierten Token, der im Monat der Emission verkauft wird.",
      },
      "emissions.toStakersShare": {
        label: "Emissionen an Staker",
        help: "Der Rest geht an andere Empfänger, etwa Spieler oder Node-Betreiber. Diese Einstellung ändert die Staking-Rendite und sonst nichts.",
      },
      "staking.initialRatio": {
        label: "Staking-Quote beim Launch",
        help: "Anteil der Umlaufmenge, der in Monat 0 gestakt ist.",
      },
      "staking.targetRatio": {
        label: "Ziel-Staking-Quote",
        help: "Anteil der Umlaufmenge, der am Ende des Übergangszeitraums gestakt ist.",
      },
      "staking.rampMonths": {
        label: "Zeit bis zur Zielquote",
        help: "Monate, in denen die Quote linear vom Launch-Wert zum Zielwert läuft. Bei 0 gilt der Zielwert ab dem Launch.",
      },
      "utility.initialUsers": {
        label: "Nutzer beim Launch",
        help: "Zahlende Nutzer in Monat 0.",
      },
      "utility.saturationUsers": {
        label: "Maximale Nutzerzahl",
        help: "Die Nutzerzahl, bei der das Wachstum abflacht.",
      },
      "utility.monthlyGrowthRate": {
        label: "Monatliches Wachstum",
        help: "Wachstumsrate, solange die Nutzerzahl weit unter dem Maximum liegt. Das Wachstum folgt einer S-Kurve und verlangsamt sich, je näher die Nutzerzahl dem Maximum kommt.",
      },
      "utility.spendPerUserUsd": {
        label: "Ausgaben pro Nutzer",
        help: "USD, die jeder Nutzer pro Monat ausgibt. Die Nutzerzahl multipliziert mit den Ausgaben pro Nutzer ergibt den Umsatz des Protokolls.",
      },
      "utility.holdingMonths": {
        label: "Guthaben der Nutzer",
        help: "Anzahl Monatsausgaben, die ein Nutzer als Token-Guthaben hält. Wachsende Guthaben werden am Markt gekauft, schrumpfende verkauft. Bei 0 kaufen die Nutzer Token und geben sie im selben Monat aus. Das schafft keine Nettonachfrage.",
      },
      "revenueSplit.burnShare": {
        label: "Verbrannt",
        help: "Anteil des Umsatzes, mit dem Token am Markt gekauft und verbrannt werden.",
      },
      "revenueSplit.treasuryShare": {
        label: "An die Treasury",
        help: "Anteil des Umsatzes, der in USD an die Treasury geht.",
      },
      "revenueSplit.stakerShare": {
        label: "An die Staker",
        help: "Anteil des Umsatzes, der in USD an die Staker geht. Er erhöht die Staking-Rendite.",
      },
      "speculation.baseInflowUsd": {
        label: "Monatliche Käufe",
        help: "Diskretionäre Käufe in Monat 1 in USD, vor dem Szenario-Multiplikator.",
      },
      "speculation.monthlyGrowth": {
        label: "Wachstum pro Monat",
        help: "Monatliche Veränderung dieser Käufe, zwischen −20% und 20%.",
      },
      "speculation.scenarioMultipliers.bear": {
        label: "Multiplikator Bear",
        help: "Faktor für die spekulativen Käufe im Bear-Szenario.",
      },
      "speculation.scenarioMultipliers.base": {
        label: "Multiplikator Base",
        help: "Faktor für die spekulativen Käufe im Base-Szenario.",
      },
      "speculation.scenarioMultipliers.bull": {
        label: "Multiplikator Bull",
        help: "Faktor für die spekulativen Käufe im Bull-Szenario.",
      },
      "speculation.momentum": {
        label: "Momentum",
        help: "Wie stark die Preisänderung des Vormonats in die Käufe des laufenden Monats einfliesst. 0 schaltet den Effekt aus. Bei 1 erhöht ein Anstieg um 10% die Käufe um 10%. Der Effekt ist auf die Hälfte bis das Doppelte begrenzt.",
      },
      "market.depthRatio": {
        label: "Tiefe",
        help: "Die USD-Seite des Pools, über den der Handel eines Monats läuft, als Anteil der zirkulierenden Marktkapitalisierung des Vormonats. Geringere Tiefe bedeutet grössere Preisbewegungen. Der Wert ist eine monatliche Absorptionskonstante und beschreibt kein Orderbuch.",
      },
      "market.minDepthUsd": {
        label: "Mindesttiefe",
        help: "Untergrenze für diesen Pool in USD, damit die Tiefe bei fallendem Preis nicht verschwindet.",
      },
      "market.holderSellRate": {
        label: "Verkäufe der Halter",
        help: "Anteil des liquiden, nicht gestakten Angebots, den bestehende Halter pro Monat verkaufen.",
      },
      "treasury.startingUsd": {
        label: "Anfangsreserven",
        help: "USD oder Stablecoins, die die Treasury beim Launch hält.",
      },
      "treasury.monthlyCostUsd": {
        label: "Monatliche Kosten",
        help: "Betriebskosten in Monat 1, in USD.",
      },
      "treasury.annualCostGrowth": {
        label: "Kostenwachstum",
        help: "Jährliche Veränderung der Betriebskosten.",
      },
      "treasury.bufferMonths": {
        label: "Puffer",
        help: "Anzahl Monatskosten, die als Reservepuffer dienen. Die Treasury verkauft Token, sobald die Reserven darunter liegen.",
      },
      "treasury.maxMonthlySaleShare": {
        label: "Verkaufsobergrenze pro Monat",
        help: "Höchstmenge, die die Treasury in einem Monat verkaufen darf, als Anteil der Umlaufmenge des Vormonats.",
      },
      "monteCarlo.runs": {
        label: "Läufe",
        help: "Anzahl Zufallsläufe, von 50 bis 2'000. Mehr Läufe ergeben glattere Bänder und dauern länger.",
      },
      "monteCarlo.seed": {
        label: "Seed",
        help: "Startwert des Zufallszahlengenerators. Derselbe Seed und dieselben Eingaben ergeben immer dieselben Bänder.",
      },
      "monteCarlo.marketVolatility": {
        label: "Marktvolatilität",
        help: "Grösse des monatlichen Zufallsschocks auf die spekulativen Käufe. Ein Schock wirkt in den Folgemonaten nach und klingt ab.",
      },
      "monteCarlo.growthVolatility": {
        label: "Unsicherheit beim Wachstum",
        help: "Streuung der Nutzerwachstumsrate über die Läufe. Pro Lauf wird eine Rate gezogen und für den gesamten Lauf beibehalten.",
      },
      "monteCarlo.sellPropensityVolatility": {
        label: "Unsicherheit bei den Verkaufsquoten",
        help: "Streuung der Verkaufsquote jeder Allokation über die Läufe. Pro Lauf wird für jede Zeile eine Quote gezogen und für den gesamten Lauf beibehalten.",
      },
    },

    allocations: {
      columns: {
        name: {
          label: "Name",
          help: "Ihre Bezeichnung für die Gruppe.",
        },
        category: {
          label: "Typ",
          help: "Unlocks aus Treasury-Zeilen gehen in den Token-Bestand der Treasury, nicht in den Umlauf. Zeilen für Team, Investoren und Berater zählen in den Health Checks als Insider. Darüber hinaus gruppiert der Typ die Zeilen nur in den Diagrammen.",
        },
        share: {
          label: "Anteil",
          help: "Prozentsatz des Genesis-Angebots. Alle Zeilen müssen zusammen 100% ergeben.",
        },
        tgeUnlock: {
          label: "Beim Launch",
          help: "Prozentsatz der Zeile, der beim Launch frei ist.",
        },
        cliffMonths: {
          label: "Cliff",
          help: "Monate bis zum Beginn des Vestings. Folgt eine Vesting-Dauer, wird am Tag, an dem das Cliff endet, nichts frei, und die erste Tranche folgt ein Freigabeintervall später.",
        },
        vestingMonths: {
          label: "Vesting",
          help: "Monate nach dem Cliff, über die der Rest frei wird. Bei 0 wird alles Übrige frei, sobald das Cliff endet.",
        },
        vestingStepMonths: {
          label: "Freigabe alle",
          help: "Monate zwischen zwei Freigaben. 1 heisst monatlich, 3 heisst vierteljährlich.",
        },
        sellPropensity: {
          label: "Bei Unlock verkauft",
          help: "Anteil des Unlocks eines Monats, der im selben Monat verkauft wird. Beim Launch freigegebene Token werden in Monat 0 nicht verkauft. Treasury-Zeilen ignorieren diese Einstellung.",
        },
        purchasePriceUsd: {
          label: "Einstandspreis",
          help: "USD pro Token, die diese Gruppe bezahlt hat. Dient für Einstandswert und Multiples. Lassen Sie das Feld leer bei Gruppen, die nichts bezahlt haben.",
        },
      },
      categories: {
        team: "Team",
        investors: "Investoren",
        advisors: "Berater",
        treasury: "Treasury",
        ecosystem: "Ökosystem",
        community: "Community",
        public_sale: "Public Sale",
        liquidity: "Liquidität",
      },
      /** Names for the rows of the presets, by row id. */
      presetRowNames: {
        team: "Team",
        seed: "Seed-Runde",
        strategic: "Strategische Runde",
        series_a: "Series A",
        series_b: "Series B",
        investors: "Investoren",
        advisors: "Berater",
        treasury: "Treasury",
        foundation: "Stiftung",
        dao: "DAO-Treasury",
        incentives: "Anreize",
        ecosystem: "Ökosystem",
        bootstrap: "Netzwerkaufbau",
        airdrop: "Airdrop",
        public: "Public Sale",
        liquidity: "Liquidität",
      },
      tokens: "Token",
      schedule: "Unlock-Plan",
      addRow: "Zeile hinzufügen",
      removeRow: (name: string) => `${name} entfernen`,
      editRow: (name: string) => `${name} bearbeiten`,
      newRowName: "Neue Allokation",
      total: "Total",
      totalOff: (total: string) =>
        `Die Zeilen ergeben zusammen ${total}. Sie müssen 100% ergeben.`,
      rowLimit: "Ein Modell kann bis zu 16 Zeilen haben.",
      lastRow: "Ein Modell braucht mindestens eine Zeile.",
      noPrice: "keiner",
    },
  },

  issues: {
    allocations_sum:
      "Die Anteile der Allokationen müssen zusammen 100% ergeben.",
    allocations_empty: "Fügen Sie mindestens eine Allokationszeile hinzu.",
    duplicate_id:
      "Zwei Allokationszeilen haben dieselbe interne ID. Entfernen Sie eine davon und fügen Sie sie neu hinzu.",
    no_initial_float:
      "Beim Launch sind keine Token im Umlauf. Geben Sie mindestens einer Zeile, die keine Treasury-Zeile ist, einen Unlock beim Launch.",
    revenue_split_over_one:
      "Die Aufteilung des Umsatzes ergibt mehr als 100%.",
    max_supply_below_genesis:
      "Das maximale Angebot liegt unter dem Genesis-Angebot.",
    treasury_row_propensity_ignored:
      "Treasury-Zeilen ignorieren den Wert «Bei Unlock verkauft». Wann die Treasury verkauft, bestimmen die Treasury-Einstellungen.",
    row_fully_unlocked_at_tge:
      "Ohne Cliff und ohne Vesting wird diese Zeile beim Launch vollständig frei, unabhängig vom eingetragenen Launch-Prozentsatz.",
    starting_usd_exceeds_implied_raise:
      "Die Anfangsreserven sind höher als der Betrag, der zu den eingetragenen Investorenpreisen aufgenommen wurde. Prüfen Sie, ob das beabsichtigt ist.",
    initial_users_above_ceiling:
      "Die Nutzer beim Launch liegen über der maximalen Nutzerzahl. Die Simulation beginnt bei der maximalen Nutzerzahl.",
    momentum_gain_high:
      "Das Momentum ist für diese Markttiefe hoch. Preisbewegungen können sich selbst verstärken.",
  },

  results: {
    title: "Ergebnisse",
    scenarioNote:
      "Ein bedingtes Szenario, keine Prognose. Jede Zahl ergibt sich aus den Eingaben auf dieser Seite.",
    invalidTitle:
      "Korrigieren Sie die Eingaben, um die Ergebnisse zu aktualisieren",
    invalidStale:
      "Die Kennzahlen und Diagramme unten zeigen den letzten gültigen Lauf.",
    warningsTitle: "Hinweise zu Ihren Eingaben",
    /** Row-level issues are prefixed with the row's name. */
    issueForRow: (row: string, message: string) => `${row}: ${message}`,
    month: (n: number) => `Monat ${n}`,
    inMonth: (n: number) => `in Monat ${n}`,
    /** A figure of the pinned baseline, shown under the current one. */
    baselineValue: (value: string) => `Referenz: ${value}`,

    /** The bar that follows the inputs on a narrow screen. Its labels are
     *  short forms of the key figures' labels: three of them share a phone's
     *  width. */
    bar: {
      price: "Endpreis",
      unlock: "Grösster Unlock",
      checks: "Checks",
    },

    kpis: {
      title: "Kennzahlen",
      initialMarketCap: {
        label: "Marktkapitalisierung beim Launch",
        help: "Umlaufmenge beim Launch mal Launch-Preis.",
      },
      initialFloat: {
        label: "Float beim Launch",
        help: "Anteil des Genesis-Angebots, der in Monat 0 im Umlauf ist.",
      },
      priceAtHorizon: {
        label: "Preis am Simulationsende",
        help: "Preis im letzten simulierten Monat des Einzellaufs ohne Zufallsschocks. Das Preisdiagramm zeigt die Spannweite über die Zufallsläufe.",
      },
      largestUnlock: {
        label: "Grösster monatlicher Unlock",
        help: "Der Monat mit der grössten Vesting-Freigabe im Verhältnis zur Umlaufmenge des Vormonats.",
      },
      inflationYear1: {
        label: "Nettowachstum des Angebots, Jahr 1",
        help: "Veränderung des Gesamtangebots in den ersten 12 Monaten: Emissionen minus Burns. Vesting zählt nicht mit, weil es Token bewegt, die bereits existieren.",
      },
      halfUnlocked: {
        label: "Hälfte des Angebots frei",
        help: "Monate, bis die Hälfte des Genesis-Angebots frei ist, allein aus dem Vesting-Plan.",
      },
      runway: {
        label: "Treasury-Runway",
        help: "Der Monat, in dem die Treasury ihre Kosten nicht mehr bezahlen kann.",
      },
      belowLaunch: {
        label: "Läufe unter dem Launch-Preis",
        help: "Anteil der Monte-Carlo-Läufe, in denen der Preis in Monat 12 unter dem Launch-Preis liegt.",
      },
      fdv: (value: string) => `FDV ${value}`,
      marketCapToFdv: (value: string) => `${value} der FDV`,
      timesLaunch: (multiple: string) => `${multiple} Launch-Preis`,
      atMonth: (n: number) => `In Monat ${n}`,
      atLaunch: "Beim Launch",
      ninetyAfter: (n: number) =>
        n === 0 ? "90% beim Launch" : `90% nach ${monthsDative(n)}`,
      notWithin: (n: number) => `Nicht innerhalb von ${monthsDative(n)}`,
      noUnlocks: "Keine Unlocks nach dem Launch",
      runwayBeyond: "Über das Simulationsende hinaus",
      runwayStatic: (n: string) =>
        `${n} ${n === "1" ? "Monat" : "Monate"} bei Reserven und Kosten wie beim Launch`,
      noCost: "Keine Kosten eingetragen",
      atMonth12: "in Monat 12",
      waiting: "Läuft",
    },

    health: {
      title: "Health Checks",
      intro:
        "Diese Checks verwenden feste Schwellenwerte als Faustregeln. Sie ersetzen keine Prüfung Ihres Designs.",
      status: {
        pass: "Bestanden",
        watch: "Beobachten",
        risk: "Risiko",
        na: "Nicht anwendbar",
      },
      summary: (risk: number, watch: number) =>
        risk + watch === 0
          ? "Alle Checks bestanden"
          : `${risk} mit Risiko, ${watch} zu beobachten`,
      pending: "Wartet auf die Monte-Carlo-Läufe",
      neverExhausted: "Die Reserven reichen für die ganze Simulation",
      exhaustedIn: (n: number) =>
        `Die Reserven sind in Monat ${n} aufgebraucht`,
      monthsFlagged: (n: number) =>
        n === 0
          ? "Kein Monat hat eine Modellgrenze erreicht"
          : n === 1
            ? "1 Monat hat eine Modellgrenze erreicht"
            : `${n} Monate haben eine Modellgrenze erreicht`,
      burnedOfEmitted: (share: string) =>
        `Burns gleichen in den letzten 12 Monaten ${share} der Emissionen aus.`,
      checks: {
        insider_share: {
          title: "Insider-Anteil",
          detail:
            "Anteil des Genesis-Angebots, den Team, Investoren und Berater halten. Über einem Drittel haben Insider eine Sperrminorität, über der Hälfte eine Mehrheit.",
          thresholds: (watch, risk) =>
            `Beobachten über ${watch}, Risiko über ${risk}`,
        },
        low_float: {
          title: "Float gegenüber der vollständig verwässerten Bewertung",
          detail:
            "Marktkapitalisierung beim Launch geteilt durch die vollständig verwässerte Bewertung. Bei einem Float von 10% muss der Markt das Neunfache der Marktkapitalisierung beim Launch aufnehmen, damit der Preis bis zum vollständigen Unlock stabil bleibt.",
          thresholds: (watch, risk) =>
            `Beobachten unter ${watch}, Risiko unter ${risk}`,
        },
        unlock_shock: {
          title: "Grösster Unlock",
          detail:
            "Der Monat mit den grössten Unlocks im Verhältnis zur Umlaufmenge des Vormonats. In diesem Modell senkt ein Unlock von 5% den Preis um rund 21% und ein Unlock von 15% um rund 47%, wenn die Tiefe auf dem Standardwert steht und die Hälfte des Unlocks verkauft wird. Käufe sind dabei nicht berücksichtigt.",
          thresholds: (watch, risk) =>
            `Beobachten ab ${watch}, Risiko ab ${risk}`,
        },
        net_inflation: {
          title: "Nettowachstum des Angebots",
          detail:
            "Das höchste Wachstum des Gesamtangebots in einem beliebigen Zeitraum von 12 Monaten, Emissionen minus Burns. Um so viel wird ein Halter verwässert, der keine Rewards erhält.",
          thresholds: (watch, risk) =>
            `Beobachten über ${watch} pro Jahr, Risiko über ${risk}`,
        },
        runway: {
          title: "Treasury-Runway",
          detail:
            "Der Monat, in dem die Treasury ihre Kosten nicht mehr bezahlen kann. 18 Monate entsprechen etwa der Dauer eines langen Bärenmarkts, 36 Monate etwa einem Finanzierungszyklus.",
          thresholds: (watch, risk) =>
            `Beobachten, wenn die Reserven bis Monat ${watch} aufgebraucht sind, Risiko bis Monat ${risk}`,
        },
        treasury_token_dependence: {
          title: "Kosten aus Token-Verkäufen",
          detail:
            "Anteil aller Betriebskosten, der durch den Verkauf von Treasury-Token finanziert wird. Ein so finanziertes Budget schrumpft, wenn der Preis fällt.",
          thresholds: (watch, risk) =>
            `Beobachten über ${watch}, Risiko über ${risk}`,
        },
        structural_demand: {
          title: "Nachfrage aus Nutzung",
          detail:
            "Über die letzten 12 Monate: Käufe für Burns und für Nutzerguthaben, geteilt durch den Wert aller zum Verkauf angebotenen Token. Den Rest der Verkäufe nehmen nur die spekulativen Käufe auf, die Sie eingegeben haben.",
          thresholds: (watch, risk) =>
            `Beobachten unter ${watch}, Risiko unter ${risk}`,
        },
        model_range: {
          title: "Modellgrenzen",
          detail:
            "Monate, in denen der Lauf eine Modellgrenze erreicht hat: die Begrenzung der monatlichen Preisbewegung, die Mindesttiefe oder die Obergrenze für Burns. Behandeln Sie die Zahlen dieser Monate mit Vorsicht.",
          thresholds: () =>
            "Beobachten, sobald ein Monat eine Modellgrenze erreicht",
        },
        treasury_exhaustion_probability: {
          title: "Läufe mit einem Treasury-Fehlbetrag",
          detail:
            "Anteil der Monte-Carlo-Läufe, in denen die Treasury ihre Kosten irgendwann nicht bezahlen kann. Er bildet die drei modellierten Schocks ab und sonst nichts.",
          thresholds: (watch, risk) =>
            `Beobachten ab ${watch}, Risiko ab ${risk}`,
        },
      },
    },

    charts: {
      label: "Diagramme",
      tabs: {
        supply: "Angebot",
        unlocks: "Unlocks",
        allocation: "Allokation",
        price: "Preis",
        valuation: "Marktkapitalisierung",
        flows: "Käufe und Verkäufe",
        staking: "Inflation und Staking",
        treasury: "Treasury",
      },
      xAxis: "Monate seit Launch",
      total: "Total",
      showSeries: (label: string) => `${label} anzeigen`,
      keyboardHint:
        "Mit den Pfeiltasten links und rechts wechseln Sie zwischen den Monaten.",
      downloadPng: "Als PNG herunterladen",
      downloadFailed:
        "Das Bild konnte in diesem Browser nicht erstellt werden.",
      baseline: (label: string) => `${label}, Referenz`,
      monteCarloProgress: (done: string, total: string) =>
        `Monte Carlo: ${done} von ${total} Läufen`,
      monteCarloDone: (runs: string) => `${runs} Monte-Carlo-Läufe`,

      supply: {
        title: "Token-Angebot im Zeitverlauf",
        byState: "Angebot nach Status",
        byHolder: "Freigegebenes Angebot nach Haltergruppe",
        view: "Aufschlüsseln nach",
        viewState: "Status",
        viewHolder: "Haltergruppe",
        note: "Gesperrte Token sind noch nicht gevestet. Freigegebene Treasury-Token hält die Treasury. Sie sind erst im Umlauf, wenn die Treasury sie verkauft.",
        holderNote:
          "Kumulierte freigegebene Token je Gruppe, dazu die Emissionen. Freigegebene Treasury-Token sind hier enthalten, obwohl sie erst nach einem Verkauf im Umlauf sind.",
      },
      unlocks: {
        title: "Freigegebene Token pro Monat",
        note: "Vesting nach Haltergruppe, dazu neue Emissionen. Der Unlock beim Launch ist weggelassen, damit die späteren Monate lesbar bleiben.",
      },
      allocation: {
        title: "Allokation des Genesis-Angebots",
        center: "Genesis-Angebot",
      },
      price: {
        title: "Token-Preis",
        scale: "Skala",
        linear: "Linear",
        log: "Log",
        note: "Das Preisniveau ist das Verhältnis zweier Eingaben: der Käufe in USD und der zum Verkauf angebotenen Token. Die Bänder decken drei Zufallsschocks ab (Markt, Nutzerwachstum und Verkaufsquoten) und sind keine Konfidenzintervalle. Der Median der Zufallsläufe ist nicht dieselbe Linie wie der Einzellauf ohne Schocks.",
      },
      valuation: {
        title: "Marktkapitalisierung und vollständig verwässerte Bewertung",
        note: "Die Marktkapitalisierung zählt die Token im Umlauf. Die vollständig verwässerte Bewertung zählt das maximale Angebot oder, ohne Obergrenze, das Gesamtangebot.",
      },
      flows: {
        title: "Käufe und Verkäufe pro Monat",
        net: "Käufe abzüglich Verkäufe",
        note: "Käufe sind in USD angegeben. Verkäufe sind die zum Verkauf angebotenen Token, bewertet zum Preis des Vormonats, und stehen unter der Nulllinie.",
      },
      staking: {
        title: "Angebotswachstum, Staking und Rendite",
        note: "Renditen sind einfache Jahresraten: die Monatsrate mal 12. Die reale Rendite zieht das Nettowachstum des Angebots ab.",
      },
      treasury: {
        title: "Reserven der Treasury",
        flowsTitle: "Einnahmen und Kosten der Treasury pro Monat",
        net: "Einnahmen abzüglich Kosten",
        note: "Reserven sind in USD angegeben. Token-Verkäufe erscheinen nur, wenn die Reserven unter den Puffer fallen.",
        exhausted: "Reserven aufgebraucht",
      },

      series: {
        liquid: "Liquide",
        staked: "Gestakt",
        treasuryTokens: "Treasury, freigegeben",
        locked: "Gesperrt",
        emissions: "Emissionen",
        totalSupply: "Gesamtangebot",
        circulating: "Umlaufmenge",
        price: "Preis",
        median: "Median der Zufallsläufe",
        band90: "5. bis 95. Perzentil",
        band50: "25. bis 75. Perzentil",
        launchPrice: "Launch-Preis",
        marketCap: "Marktkapitalisierung",
        fdv: "Vollständig verwässerte Bewertung",
        speculativeBuying: "Spekulative Käufe",
        burnBuying: "Käufe für Burns",
        balanceBuying: "Nutzerguthaben, Käufe",
        unlockSelling: "Verkäufe aus Unlocks",
        emissionSelling: "Verkäufe aus Emissionen",
        holderSelling: "Verkäufe der Halter",
        treasurySelling: "Verkäufe der Treasury",
        balanceSelling: "Nutzerguthaben, Verkäufe",
        netInflation: "Nettowachstum des Angebots, annualisiert",
        stakedShare: "Staking-Quote",
        yieldNominal: "Staking-Rendite, nominal",
        yieldReal: "Staking-Rendite, real",
        reserves: "Reserven",
        costs: "Kosten",
        treasuryRevenue: "Umsatzanteil der Treasury",
        saleProceeds: "Erlös aus Token-Verkäufen",
        unpaidCosts: "Unbezahlte Kosten",
      },
    },

    holders: {
      title: "Ergebnisse der Halter",
      intro:
        "Jede Allokation in den von Ihnen gewählten Monaten, bewertet zum simulierten Preis. Das Buch-Multiple ist der Preis geteilt durch den Einstandspreis. Das liquide Multiple zählt nur freigegebene Token.",
      group: "Gruppe",
      tokens: "Token",
      costBasis: "Einstandswert",
      unlockedValue: "Freigegebener Wert",
      lockedValue: "Gesperrter Wert",
      paperMultiple: "Buch-Multiple",
      liquidMultiple: "Liquides Multiple",
      monthSelect: "Monat",
    },

    table: {
      title: "Monatsdaten",
      intro: "Alle Datenreihen hinter den Diagrammen, eine Zeile pro Monat.",
      show: "Tabelle anzeigen",
      hide: "Tabelle ausblenden",
      download: "CSV herunterladen",
      columns: {
        month: "Monat",
        priceUsd: "Preis (USD)",
        marketCapUsd: "Marktkapitalisierung (USD)",
        fdvUsd: "FDV (USD)",
        totalSupply: "Gesamtangebot",
        circulating: "Im Umlauf",
        liquid: "Liquide",
        staked: "Gestakt",
        locked: "Gesperrt",
        treasuryTokens: "Treasury-Token",
        burnedCum: "Verbrannt, kumuliert",
        emittedCum: "Emittiert, kumuliert",
        unlockTokens: "Freigegeben",
        emissionTokens: "Emittiert",
        burnTokens: "Verbrannt",
        buyUsd: "Käufe (USD)",
        sellPressureUsd: "Verkäufe (USD)",
        treasuryUsd: "Reserven (USD)",
        users: "Nutzer",
        stakedRatio: "Staking-Quote",
        netInflationAnnualised: "Nettowachstum des Angebots, annualisiert",
        stakingYieldNominal: "Staking-Rendite, nominal",
        stakingYieldReal: "Staking-Rendite, real",
      },
    },
  },

  print: {
    title: (tokenName: string) =>
      tokenName ? `${tokenName}: Tokenomics-Szenario` : "Tokenomics-Szenario",
    source: (url: string) =>
      `Erstellt mit dem Token-Simulator von Block Consult, ${url}`,
    inputs: "Eingaben",
    disclaimer:
      "Ein bedingtes Szenario auf Grundlage der hier aufgeführten Eingaben. Es ist keine Prognose und keine Finanzberatung.",
  },

  failure: {
    title: "Der Simulator wurde angehalten",
    body: "Ein Fehler hat den Simulator angehalten. Versuchen Sie es zuerst erneut. Wenn er wieder anhält, beginnen Sie mit dem Standardmodell. Dabei werden die in diesem Browser gespeicherten Eingaben entfernt.",
    retry: "Erneut versuchen",
    startAgain: "Mit dem Standardmodell beginnen",
  },
};
