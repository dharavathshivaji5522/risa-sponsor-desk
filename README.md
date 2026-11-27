# Sponsor Desk
RISA Labs Growth APM · Challenge B · Dharavath Shivaji

Bengaluru was selected for density of target sponsors and potential for local meetings. The [STPI Bengaluru overview](https://bengaluru.stpi.in/en/about-stpi-bengaluru) identifies the Electronic City technology cluster. Treat sponsor motivations and availability as hypotheses.

The [GitHub Pages demo](https://dharavathshivaji5522.github.io/risa-sponsor-desk/) uses a separate workspace per browser. Campaign edits and tasks save to IndexedDB and survive a reload. Each browser starts with the same simulated baseline. Start with Dashboard → Copilot, ask which campaign has the largest target gap, then ask for a follow-up task. Save the draft explicitly. In Campaigns, edit simulated cash or a funnel metric and ask again.

## Sources
- [Sponsor workbook in the assignment brief](https://docs.google.com/spreadsheets/d/1iVkqfl7FPr-uiAiBy5aFZtWS92_8O3zv/edit) and the [supplied copy](https://docs.google.com/spreadsheets/d/1-4G9XdDr6KwHvLc0igBXoPlzuWwwbDOf/edit?gid=1267637537). Download the [original XLSX](data/sponsorship-original.xlsx) in the repository or from Sources in the app.
- [Attendee workbook in the assignment brief](https://docs.google.com/spreadsheets/d/1o7JKPu3AWkhlblF4i4qf7BEH5YTgW0O0/edit) and the [supplied copy](https://docs.google.com/spreadsheets/d/13EEsGkM7Aic97XfZ4-oBtw4dg1vIMVYh/edit?gid=1874562926). The [original XLSX](data/attendee-original.xlsx) provides external check-ins linked by campaign ID. The app counts distinct stable person IDs. The workbook histories are fictional.
- Each XLSX export linked from the brief matched the corresponding supplied export and repository copy byte for byte. The app build carries those files into Sources, and the test suite checks their SHA-256 hashes.
- Historical snapshots use end of day IST, deduplicate stable interaction and history IDs, and select the latest eligible record. Goals use the effective-date target version. Engaged brands had a reply, held meeting, introduction, or inbound inquiry. Proposal counts are distinct opportunities ever reaching a proposal stage. Confirmed counts use current opportunity state and campaign association uses the opportunity's recorded origin.
- At 11 April 2025, the source records 24 confirmed partnerships, including 20 cash deals with ₹20 lakh confirmed and 4 in-kind deals worth ₹2.4 lakh. Median confirmed cash deal was ₹95,000. The source contains no bank receipts, sponsor spend, or payment dates. Creator referrals, warm introductions and the partner form accounted for the ₹20 lakh cash commitment. Historical association is not an incremental effect.

## Model and decisions
- Use a six-week pre-festival sprint with four volunteer owners and a total ₹1.20 lakh acquisition budget. Prioritize decision-maker access, student audience fit, the ability to approve spend before the festival, and non-conflicting categories. Assign each prospect to one strategy.
- Base plan: 180 prospects → 103 conversations → 65 proposals → 29 signed deals; ₹30.80 lakh signed × channel-level timing assumptions = ₹27,45,750 collected. Stretch: 210 → 131 → 90 → 39; ₹43.70 lakh signed × channel-level timing assumptions = ₹39,84,400 collected. The target is cumulative receipts before 12 April, with 11 April as the cutoff.
- The comparator is the historical ₹20 lakh confirmed cash value × an assumed 85% payment rate = ₹17 lakh. It is a planning benchmark, not observed historical cash. Channel increments are modeled base cash less that channel's comparator. Neither historical cohort assignment nor portfolio forecast establishes causal contribution.
- Expected cash = signed deals × average ticket × expected on-time collection fraction per channel. The live forecast retains simulated receipts, applies the scenario collection fraction to remaining signed value and forecast new deals, and caps additional deals at the remaining scenario signing goal. New deals use observed proposal pace plus open proposals. Close rate blends observed outcomes with six prior proposals at the scenario rate, then applies a 1.0× / 0.6× / 0× / 0.4× multiplier for scale / change / stop / collect data. Scenario targets, ticket sizes, budgets and thresholds are in data/plan.json. Rates are assumptions, with 75–90% collection in base and 80–92% in stretch.
- Score each idea from 1 to 5 for incremental cash, evidence, speed and ease. Weight 40%, 25%, 20% and 15% respectively. Rankings are 4.65 creator, 4.50 warm, 4.20 inbound, 2.65 revival, 1.90 cold. Fund creator and warm first, protect inbound triage, timebox revival, and keep cold outbound as a capped holdout.
- Cash deadlines: ask for a dated payment plan while negotiating. Review aging twice weekly. At D−14, require invoice approval for signed amounts. At D−7, escalate unpaid high-value deals. Exclude deferred cash and in-kind from the collection target. Planning data uses a fixed 27 March simulation date.

| Strategy | Base N / C / P / signed | Average deal | On-time fraction | Base cash | Historical benchmark | Increment |
| --- | --- | --- | --- | --- | --- | --- |
| Creator referrals | 45 / 32 / 22 / 11 | ₹1,05,000 | 90% | ₹10,39,500 | ₹6,16,250 | ₹4,23,250 |
| Warm introductions | 36 / 27 / 18 / 8 | ₹1,25,000 | 90% | ₹9,00,000 | ₹5,44,000 | ₹3,56,000 |
| Inbound fast lane | 30 / 22 / 15 / 7 | ₹1,00,000 | 90% | ₹6,30,000 | ₹5,39,750 | ₹90,250 |
| Revival micro-packages | 24 / 10 / 5 / 2 | ₹75,000 | 80% | ₹1,20,000 | ₹0 | ₹1,20,000 |
| Cold outbound holdout | 45 / 12 / 5 / 1 | ₹75,000 | 75% | ₹56,250 | ₹0 | ₹56,250 |

Stretch expected cash by strategy: ₹14,16,800 + ₹13,66,200 + ₹8,69,400 + ₹2,04,000 + ₹1,28,000 = ₹39,84,400. N / C / P = prospects / conversations / proposals. The same five source records power the slide assumptions and live UI.

## Setup
Node.js 22.13+ is sufficient. Run `npm run build`, then `npm start`. The build creates a static site in `docs/`. GitHub Pages publishes that directory. A browser Web Worker runs the analysis and IndexedDB stores the workspace. `npm test` runs the source calculations and app contract checks. The extraction script uses Python and openpyxl to preserve values from the two workbook exports. Rebuild the submission slides with `python design/build-slides.py` after installing ReportLab; the PDF uses the same app scenario data.

## How Copilot answers

Copilot resolves the historical or simulated scope, date, campaign, metric, and operation before calculating a result. Explicit metrics take precedence over the statistical intent model, which handles broader questions. The dashboard and chatbot use the same forecast code and saved campaign revision. Exact names and IDs take precedence over close spellings. Copilot asks for clarification when it finds multiple possible brands, and it flags missing records and undefined ratios.

- **Historical.** Use a date, brand, opportunity ID, or the Sources filters. Workbook records support commitments, opportunity status, outreach, and linked attendee check-ins. Verified sponsor receipts, spend, invoice dates, and the causal impact of activations are unavailable.
- **Workspace.** Ask for conversions, campaign rankings, arithmetic, cost per funnel stage, cash realization, actual or projected target achievement, or one of three distinct balances. “Unpaid” is signed value less receipts. “Cash still needed” is target less receipts. “Forecast gap” is target less projected cash. Unallocated acquisition budget is budget less spend.
- **Scenarios.** Try “Reduce collection by 10 percentage points” in a what-if question. An absolute rate replaces the assumption, a point change adds or subtracts from it, and a relative change scales it. The model retains receipts, applies new ticket sizes only to projected deals, and keeps the existing signing cap. Changing the leading signal can change the decision and forecast. Changing acquisition budget updates headroom and modeled cash per budget rupee. The model has no estimated relationship between additional budget and conversion or cash.
- **Execution.** Start with “Which campaign has the biggest forecast gap?”, follow with “Why?”, then ask “What happens if we improve it to 90%?” To act, ask “Create a task for this,” choose **Review task draft**, and confirm in the editor. The draft carries the owner, due date, action, and signal threshold. Typed confirmation points to the editor. Confirmed tasks persist and can be queried from Copilot.

## Verification

- `npm test` checks baseline figures, funnel ratios, thresholds, snapshots, changed data, validation, task idempotency, and prompt regressions. Run `npm run test:report` to reproduce the [question-by-question report](TEST-/Users/nunavathpoojitha/Documents/ChatGPT/project_1/risa-sponsor-desk-githubRT.md).
- For browser checks, install Playwright with `npm install --no-save --package-lock=false playwright` and `npx playwright install chromium webkit`. Start the built site with `npm start`, then run `SPONSOR_DESK_ENGINES=chromium,webkit npm run test:browser`. Set `SPONSOR_DESK_URL` to check the public deployment. Optional environment variables `PLAYWRIGHT_MODULE` and `CHROMIUM_EXECUTABLE` point to an existing Playwright installation and Chrome binary.
- Browser checks use fresh contexts. They cover the dashboard, scenario switching, data edits, task confirmation and refresh persistence, historical filters, the original XLSX download, stale-tab conflicts, mobile keyboard and reduced-motion support, and a corrupted record that stays intact.
- Release results on 27 November 2026. The source suite passed 292 checks with 0 failures. The report contains 174 checked responses with 0 failures, including cases also covered by the source suite. The local browser suite passed 38 checks and workflow groups with 0 failures across Chrome and WebKit.

## Assignment review

| RISA criterion | Submission evidence |
| --- | --- |
| Ambition and quantitative reasoning (20%) | Slide 1 gives the observed commitment benchmark, sponsor criteria, funnel conversion, and base and stretch cash cases. |
| Prioritization and tradeoffs (20%) | Slide 2 ranks five strategies, allocates budget, and shows modeled incremental contributions and pilot plans. |
| Experimentation and adaptability (15%) | Slide 3 links sample sizes, leading indicators, and scale, change, or stop thresholds to corrective actions. |
| Dashboard and management (20%) | The live app shows campaign-level KPI changes and persists edits and confirmed tasks. |
| Copilot utility (20%) | The report covers numerical diagnosis, contextual follow-ups, scenario recalculation, missing evidence, and the draft-to-confirmation workflow. |
| Ownership and communication (5%) | This README records data provenance, calculation assumptions, setup, tests, and delivery limitations. |

## Tools and limits
Codex assisted with implementation. Data extraction uses openpyxl. The dashboard uses HTML, CSS, vanilla JavaScript, a Web Worker, IndexedDB, and GitHub Pages. The [strategy PDF](docs/strategy.pdf) uses ReportLab. Its cover uses the official wordmark from the [RISA Labs website](https://www.risalabs.ai/), and its analytical charts reference [Microsoft Power BI sample reports](https://github.com/microsoft/powerbi-desktop-samples). Browser testing uses Playwright with Chrome and WebKit.

Copilot runs locally in the browser with a small statistical classifier and dataset-backed calculations. Natural-language coverage is limited to Sponsor Desk questions and supported ways of combining metrics. Cash-efficiency ratios assess simulated receipts or modeled cash against acquisition cost. Profit and ROI would require full festival costs. Workspaces save to IndexedDB on the current browser profile. Tabs share revisions, and stale edits are rejected. Clearing site data resets the workspace. Multiple devices have independent demo workspaces.
