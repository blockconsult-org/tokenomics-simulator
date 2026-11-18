import type { SimulatorPage } from "./page";

/**
 * Copy of the simulator page outside the tool itself, German. Swiss Standard
 * German: ss, Sie. Typed against page.en.ts; keys, order and every `path`
 * mirror that file.
 *
 * Every statement about the model here describes simulator/engine. When the
 * engine changes, this text changes with the English.
 */

export const pageDe: SimulatorPage = {
  meta: {
    title: "Tokenomics-Simulator",
    description:
      "Kostenloser Tokenomics-Simulator. Modellieren Sie Allokationen, Vesting, Emissionen, Staking, Burns, Preisszenarien und Treasury-Runway und teilen Sie das Ergebnis. Ohne Anmeldung, und Ihre Eingaben bleiben in Ihrem Browser.",
    imageAlt:
      "Tokenomics-Simulator von Block Consult: Angebot, Unlocks, Preisszenarien und Treasury-Runway",
  },

  chrome: {
    toolName: "Token-Simulator",
    nav: [
      { label: "Token-Design", path: "/services/tokenomics" },
      { label: "Web3", path: "/web3" },
      { label: "Blog", path: "/blog" },
    ],
    navLabel: "Block Consult",
    contact: "Sprechen Sie mit uns",
    footerLinks: [
      { label: "Impressum", path: "/legal" },
      { label: "Datenschutzerklärung", path: "/privacy" },
      { label: "Kontakt", path: "/contact" },
    ],
    footerNote:
      "Der Simulator erstellt bedingte Szenarien aus Ihren Eingaben. Er liefert keine Prognose und keine Finanzberatung.",
  },

  hero: {
    eyebrow: "Kostenloses Tool",
    title: "Tokenomics-Simulator",
    lead: "Geben Sie Ihre Annahmen zu Allokationen, Vesting, Emissionen, Nachfrage und Treasury ein. Der Simulator zeigt, wie sich Angebot, Unlocks, Preis und Runway unter diesen Annahmen Monat für Monat entwickeln.",
    facts: [
      "Ohne Anmeldung",
      "Läuft in Ihrem Browser",
      "Eingaben werden nicht an einen Server gesendet",
    ],
  },

  method: {
    eyebrow: "Methode",
    title: "So funktioniert das Modell",
    lead: "Das Modell rechnet in Monatsschritten mit einer festen Reihenfolge. Die folgenden Schritte und Grenzen erklären, wie Sie die Ergebnisse einordnen können.",
    sections: [
      {
        title: "Monat für Monat",
        paragraphs: [
          "Der Lauf beginnt beim Token Generation Event, Monat 0, und reicht in Monatsschritten bis zum gewählten Simulationsende. In Monat 0 sind die Unlocks vom Launch im Umlauf, der Preis ist der eingegebene Launch-Preis, und es wird nichts gehandelt.",
          "Jeder spätere Monat durchläuft dieselben Schritte in derselben Reihenfolge. Entscheidungen innerhalb eines Monats verwenden Preis und Angebot des Vormonats. So hängt kein Schritt von einem Wert ab, der noch berechnet wird.",
        ],
        list: [
          "Die Markttiefe wird aus der zirkulierenden Marktkapitalisierung des Vormonats abgeleitet.",
          "Gevestete Token werden frei, und ein Teil des Unlocks jeder Allokation wird zum Verkauf angeboten.",
          "Emissionen werden bis zur Obergrenze des Angebots geprägt, und ein Teil davon wird zum Verkauf angeboten.",
          "Die Nutzerzahl wächst entlang einer S-Kurve. Die Nutzerzahl multipliziert mit den Ausgaben pro Nutzer ergibt den Umsatz, der auf Burn, Treasury und Staker aufgeteilt wird.",
          "Die spekulativen Käufe ergeben sich aus dem eingegebenen Zufluss, dem Szenario und der Preisänderung des Vormonats.",
          "Die Treasury vergleicht ihre Reserven mit dem Puffer und entscheidet, ob sie Token verkauft.",
          "Alle Käufe und Verkäufe des Monats laufen in einem einzigen Trade durch den Markt. Daraus ergibt sich der neue Preis.",
          "Die für den Burn gekauften Token werden vernichtet, die Treasury verbucht Einnahmen und Kosten, und die Staking-Quote bewegt sich auf ihren Zielwert zu.",
        ],
      },
      {
        title: "Wie der Preis entsteht",
        paragraphs: [
          "Der Preis entsteht in einem Constant-Product-Pool, der Preisregel von Automated Market Makern. Die USD-Seite des Pools entspricht der eingestellten Tiefe mal der zirkulierenden Marktkapitalisierung des Vormonats, mit einer Untergrenze in USD.",
          "Die Käufe des Monats in USD und die Verkäufe des Monats in Token werden gemeinsam gegen diesen Pool gehandelt. Das Modell verwendet das exakte Ergebnis für zwei Flüsse, die gleichmässig über den Monat eintreffen. Das Resultat hängt deshalb nicht davon ab, wie fein der Monat unterteilt wird. Der Preis bewegt sich vom Niveau des Vormonats in Richtung des Verhältnisses von USD-Käufen zu verkauften Token und überschreitet es nie.",
          "Bei der Standardtiefe von 20% bewegt ein Dollar Nettokäufe die Marktkapitalisierung um rund zehn Dollar. Dieser Wert ist eine Annahme. Er ist an keinem Markt kalibriert. Die Preisänderung eines einzelnen Monats ist in beide Richtungen auf den Faktor fünf begrenzt, und Monate, die diese Grenze erreichen, werden in den Health Checks markiert.",
        ],
      },
      {
        title: "Woher die Nachfrage kommt",
        paragraphs: [
          "Die spekulative Nachfrage ist eine Eingabe. Sie geben die monatlichen Käufe in USD ein und wie sie wachsen. Das Szenario multipliziert sie, und das Momentum erhöht oder senkt sie mit der Preisänderung des Vormonats, begrenzt auf die Hälfte bis das Doppelte.",
          "Die Nachfrage aus Nutzung wird netto gezählt. Umsatz, der in den Burn fliesst, kauft Token am Markt. Nutzer, die ein Token-Guthaben für ihre Ausgaben halten, kaufen, wenn das Gesamtguthaben wächst, und verkaufen, wenn es schrumpft. Die Bruttoausgaben der Nutzer zählen nicht als Käufe, weil der Empfänger dieser Token sie wieder verkauft.",
        ],
      },
      {
        title: "Angebot und Verkäufe",
        paragraphs: [
          "Jede Allokation hat einen Unlock beim Launch, ein Cliff und eine Vesting-Dauer mit Freigabeintervall. Folgt auf das Cliff eine Vesting-Dauer, wird am Tag, an dem das Cliff endet, nichts frei, und die erste Tranche folgt ein Intervall später. Ohne Vesting-Dauer wird der Rest frei, sobald das Cliff endet. Unlocks aus Treasury-Allokationen gehen in den eigenen Bestand der Treasury und erreichen den Markt erst, wenn die Treasury verkauft.",
          "Verkäufe haben vier Quellen: einen Teil des Unlocks jedes Monats, einen Teil der Emissionen jedes Monats, einen festen monatlichen Anteil des liquiden Angebots der bestehenden Halter sowie Verkäufe der Treasury. Gestakte Token sind von den Verkäufen der Halter ausgenommen. Beim Launch freigegebene Token werden in Monat 0 nicht verkauft, weil der Launch-Preis als gegeben gilt.",
          "Emissionen folgen entweder einer jährlichen Inflationsrate auf das aktuelle Angebot oder einer festen Monatsmenge, wahlweise mit Halving oder jährlicher Abnahme. Eine Obergrenze für das Angebot kann alle je geprägten Token zählen oder nur die ausstehenden Token. Im zweiten Fall schaffen Burns Platz für neue Emissionen. Das Nettowachstum des Angebots ist Emissionen minus Burns. Vesting zählt nicht als Inflation, weil es Token bewegt, die bereits existieren.",
        ],
      },
      {
        title: "Die Treasury",
        paragraphs: [
          "Die Treasury startet mit den Reserven, die Sie eingeben, erhält jeden Monat ihren Anteil am Umsatz und bezahlt Betriebskosten, die mit einer Jahresrate wachsen.",
          "Sind Token-Verkäufe eingeschaltet und fallen die Reserven unter den Puffer, verkauft die Treasury freigegebene Token, um ihn wieder aufzufüllen. Die Verkaufsmenge wird erhöht, um den erwarteten Einfluss auf den Preis zu berücksichtigen. Sie ist durch die monatliche Obergrenze sowie durch den Token-Bestand der Treasury begrenzt. Der Runway endet im ersten Monat, in dem mehr als 1% der Monatskosten unbezahlt bleibt.",
        ],
      },
      {
        title: "Monte-Carlo-Läufe",
        paragraphs: [
          "Jeder Zufallslauf wiederholt das Szenario mit drei Quellen von Streuung. Ein Marktfaktor multipliziert die spekulativen Käufe, ändert sich jeden Monat und nimmt den grössten Teil seines Werts in den Folgemonat mit. Eine Nutzerwachstumsrate wird einmal pro Lauf gezogen. Eine Verkaufsquote für jede Allokation wird einmal pro Lauf gezogen.",
          "Die Bänder in den Diagrammen zu Preis und Marktkapitalisierung zeigen das 5. bis 95. und das 25. bis 75. Perzentil über die Läufe. Die Läufe starten mit einem Seed. Derselbe Seed und dieselben Eingaben ergeben deshalb immer dieselben Bänder. Die Schocks sind zentriert, der Median der Läufe ist aber nicht dieselbe Linie wie der Einzellauf ohne Schocks.",
        ],
      },
      {
        title: "Was das Modell weglässt",
        paragraphs: [
          "Die Ergebnisse sind bedingte Szenarien. Sie zeigen, was aus einem Satz von Annahmen folgt, und sind am nützlichsten, um zwei Designs unter denselben Annahmen zu vergleichen.",
        ],
        list: [
          "Das Preisniveau ist das Verhältnis zweier Eingaben: Käufe in USD und zum Verkauf angebotene Token. Nichts im Modell zieht den Preis zu einem fairen Wert hin.",
          "Die Tiefe ist eine monatliche Absorptionskonstante. Sie beschreibt kein Orderbuch, und weil sie mit der Marktkapitalisierung skaliert, schrumpft sie, wenn der Preis fällt.",
          "Verkäufer reagieren nicht auf den Preis. Sie verkaufen auf jedem Niveau denselben Anteil ihrer Token.",
          "Monatsschritte glätten, was innerhalb eines Monats geschieht, etwa den Tag, an dem ein Cliff endet.",
          "Die Staking-Quote ist eine Eingabe. Das Modell leitet sie nicht aus der Rendite ab.",
          "Die Bänder decken drei Schocks ab und sind keine Konfidenzintervalle.",
          "Das Modell kennt keine Handelsgebühren, keine Steuern, keine Lending-Märkte und keinen zweiten Token.",
        ],
      },
    ],
  },

  faq: {
    title: "Fragen zum Simulator",
    items: [
      {
        q: "Ist der Simulator kostenlos?",
        a: "Ja. Es gibt kein Konto, kein E-Mail-Formular und keine Begrenzung, wie oft Sie ihn nutzen.",
      },
      {
        q: "Wohin gehen meine Eingaben?",
        a: "Sie bleiben in Ihrem Browser. Die Berechnung läuft auf Ihrem Gerät, und das Modell wird im lokalen Speicher Ihres Browsers abgelegt, damit es bei Ihrem nächsten Besuch noch da ist. Ein Link zum Teilen speichert das Modell im Teil der Adresse nach dem Zeichen #, den Browser nicht an einen Server senden.",
      },
      {
        q: "Kann der Simulator den Preis meines Tokens vorhersagen?",
        a: "Nein. Der Preis im Simulator hängt von den spekulativen Käufen ab, die Sie eingeben, und von einer Annahme zur Markttiefe. Nutzen Sie ihn, um Designs unter denselben Annahmen zu vergleichen, zum Beispiel um zu sehen, wie ein längeres Cliff oder eine tiefere Emissionsrate Verkaufsdruck, Float und Runway verändert.",
      },
      {
        q: "Welche Token-Designs kann ich modellieren?",
        a: "Festes Angebot, jährliche Inflation, feste Emissionen mit Halving oder Abnahme, Obergrenzen für das Angebot, Burn-and-Mint, Staking, das aus Emissionen oder aus Umsatz finanziert wird, und Buy-and-Burn aus Umsatz. Nicht modelliert werden Rebasing-Token, Bonding Curves, Vote-Escrow-Locks und Systeme mit zwei Token.",
      },
      {
        q: "Was bedeuten die Bänder im Preisdiagramm?",
        a: "Sie zeigen die Spannweite der Preise über die Zufallsläufe: die mittlere Hälfte der Läufe und die mittleren 90%. Sie bilden drei modellierte Schocks ab: auf den Markt, das Nutzerwachstum und die Verkaufsquoten. Sie sind keine Konfidenzintervalle für einen realen Preis.",
      },
      {
        q: "Wie funktionieren die Health Checks?",
        a: "Jeder Check vergleicht eine Zahl aus dem Lauf mit zwei festen Schwellenwerten, zum Beispiel den Anteil des Angebots in der Hand von Insidern oder den grössten monatlichen Unlock. Schwellenwerte und Begründung stehen bei jedem Check. Es sind Faustregeln.",
      },
      {
        q: "Wie speichere oder teile ich ein Modell?",
        a: "Kopieren Sie den Link zum Teilen, um das Modell weiterzugeben, oder laden Sie es als JSON-Datei herunter und laden Sie es später wieder. Die Monatsdaten können Sie zudem als CSV-Datei herunterladen und die Seite als PDF-Bericht drucken.",
      },
      {
        q: "Kann Block Consult mein Token-Design prüfen?",
        a: "Ja. Token-Design und Stresstests gehören zu unseren Leistungen. Senden Sie uns Ihren Link zum Teilen über die Kontaktseite und sagen Sie uns, was Sie testen möchten.",
      },
    ],
  },

  notice: {
    title: "Ein Szenario, keine Prognose",
    body: "Der Simulator macht aus Ihren Annahmen ein bedingtes Szenario. Er prognostiziert keine Preise und ist keine Finanz-, Anlage-, Rechts- oder Steuerberatung. Block Consult übernimmt keine Gewähr für die Ergebnisse, und Entscheidungen auf dieser Grundlage treffen Sie in eigener Verantwortung.",
  },

  cta: {
    title: "Wenn Ihr Projekt ein eigenes Modell braucht",
    body: "Der Simulator deckt die gängigen Token-Designs ab. Ein Projekt mit eigenen Mechanismen braucht ein dafür gebautes Modell. Block Consult entwirft Token-Ökonomien und unterzieht sie Stresstests in Nachfrage-, Preis- und Angriffsszenarien.",
    button: "Sprechen Sie mit uns",
    path: "/contact",
    secondary: "Zu unserer Leistung im Token-Design",
    secondaryPath: "/services/tokenomics",
  },

  breadcrumb: { home: "Block Consult", tool: "Tokenomics-Simulator" },

  /** The pointer to the tool on the token design service page. */
  serviceCallout: {
    eyebrow: "Kostenloses Tool",
    title: "Token-Simulator",
    body: "Geben Sie Allokationen, Vesting, Emissionen und Nachfrage ein und sehen Sie Angebot, Unlocks, Preisszenarien und Treasury-Runway Monat für Monat. Ohne Anmeldung.",
    button: "Simulator öffnen",
  },
};
