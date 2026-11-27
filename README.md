# Sponsor Desk
RISA Labs Growth APM · Challenge B · Dharavath Shivaji

Bengaluru was selected for density of target sponsors and potential for local meetings. The [STPI Bengaluru overview](https://bengaluru.stpi.in/en/about-stpi-bengaluru) identifies the Electronic City technology cluster. Treat sponsor motivations and availability as hypotheses.

The [GitHub Pages demo](https://dharavathshivaji5522.github.io/risa-sponsor-desk/) uses a separate workspace per browser. Campaign edits and tasks save to IndexedDB and survive a reload. Each browser starts with the same simulated baseline. Start with Dashboard → Copilot, ask which campaign has the largest target gap, then ask for a follow-up task. Save the draft explicitly. In Campaigns, edit simulated cash or a funnel metric and ask again.

## Sources
- [Original sponsorship dataset](https://docs.google.com/spreadsheets/d/1-4G9XdDr6KwHvLc0igBXoPlzuWwwbDOf/edit?gid=1267637537). The [original export](data/sponsorship-original.xlsx) remains available inside the app and repository.
- [Attendee dataset](https://docs.google.com/spreadsheets/d/13EEsGkM7Aic97XfZ4-oBtw4dg1vIMVYh/edit?gid=1874562926). The [original export](data/attendee-original.xlsx) is also in the repository. Used only for observed external check-ins linked by campaign ID. Stable person IDs are counted distinctly. The workbook histories are fictional.
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

## Tools and limits
Codex assisted with implementation. Data extraction uses openpyxl; the dashboard uses HTML, CSS, vanilla JavaScript, a Web Worker, IndexedDB, and GitHub Pages. The [strategy PDF](docs/strategy.pdf) uses ReportLab. Its color and type direction reference the [RISA Labs visual identity](https://www.risalabs.ai/), and its analytical charts reference [Microsoft Power BI sample reports](https://github.com/microsoft/powerbi-desktop-samples). Browser testing uses Playwright and Chrome.

Copilot uses a small statistical intent model in the browser worker and deterministic, dataset-backed calculations. It supports date and campaign comparisons, follow-up context, budget, forecast sensitivity and task drafts. It explains when the sources cannot support a calculation. It does not use a remote general-purpose LLM. Mentioning an unsupported topic may return a request for a data-backed reformulation. No real festival operation, bank or payment integration is included. Workspaces are browser-scoped. Clearing site data resets a workspace. Multiple devices have independent demo workspaces.
