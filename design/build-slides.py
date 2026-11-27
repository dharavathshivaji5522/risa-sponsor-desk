"""Build the three-slide Sponsor Desk submission from the app's scenario model."""
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from subprocess import check_output
import argparse
import json

from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph

W, H = 1600, 900
ROOT = Path(__file__).resolve().parent.parent
AUTHOR = "Dharavath Shivaji"
ROLL_NO = "23MT10022"
RISA_LOGO = ROOT / "design/risa-wordmark.png"
PLAN = json.loads((ROOT / "data/plan.json").read_text())
ROWS = PLAN["campaigns"]
LIVE = "https://dharavathshivaji5522.github.io/risa-sponsor-desk/"
GITHUB = "https://github.com/dharavathshivaji5522/risa-sponsor-desk"
README = GITHUB + "#readme"
WORKBOOK = GITHUB + "/blob/main/data/sponsorship-original.xlsx"
CITY = "https://bengaluru.stpi.in/en/about-stpi-bengaluru"
parser = argparse.ArgumentParser()
parser.add_argument("output", nargs="?", type=Path, default=ROOT / "docs/strategy.pdf")
args = parser.parse_args()
c = canvas.Canvas(str(args.output), pagesize=(W, H), pageCompression=1)
c.setTitle("Sponsor Desk | RISA Labs Growth APM")
c.setAuthor(AUTHOR)
c.setSubject("Challenge B | Cash collected before CampusFest Bengaluru")

for name, weight in (("regular", "Regular"), ("bold", "Bold")):
    path = ROOT / f"design/fonts/NotoSans-{weight}.ttf"
    if path.exists():
        font = TTFont(name, str(path))
    else:
        font = TTFont(name, "/System/Library/Fonts/HelveticaNeue.ttc", subfontIndex=weight == "Bold")
    assert 0x20B9 in font.face.charWidths
    pdfmetrics.registerFont(font)
pdfmetrics.registerFontFamily("regular", normal="regular", bold="bold")

PALETTE = {
    "paper": "#F7F5F3", "white": "#FFFFFF", "ink": "#121418", "muted": "#536170",
    "quiet": "#697687", "line": "#E3E6EB", "grid": "#E8ECF0", "blue": "#0F5BFF",
    "blueDark": "#123999", "bluePale": "#EAF1FF", "blueLight": "#86ABFF",
    "forest": "#0C2521", "teal": "#087C72", "mint": "#DDEFE9", "mintBright": "#99DDC6",
    "gold": "#B9802F", "goldDark": "#805018", "sand": "#F5E7CD", "amber": "#D89237",
    "rose": "#A4445D", "redPale": "#F6E3E7", "grayPale": "#F0F2F5", "violet": "#7C69BF"
}

def color(k):
    return HexColor(PALETTE.get(k, k))


def box(x, top, w, h, fill, border=None, radius=0):
    c.setFillColor(color(fill))
    if border:
        c.setLineWidth(.9)
        c.setStrokeColor(color(border))
    if radius:
        c.roundRect(x, H-top-h, w, h, radius, fill=1, stroke=bool(border))
    else:
        c.rect(x, H-top-h, w, h, fill=1, stroke=bool(border))


def stroke(x1, y1, x2, y2, fill="grid", width=1, dash=None):
    c.setStrokeColor(color(fill))
    c.setLineWidth(width)
    c.setDash(dash or [])
    c.line(x1, H-y1, x2, H-y2)
    c.setDash([])


def dot(x, y, r, fill):
    c.setFillColor(color(fill))
    c.circle(x, H-y, r, fill=1, stroke=0)


def text(s, x, top, size=18, font="regular", fill="ink", align="left"):
    s = s.replace("−", "-").replace("–", "-")
    c.setFillColor(color(fill))
    c.setFont(font, size)
    drawer = {"left": c.drawString, "center": c.drawCentredString, "right": c.drawRightString}[align]
    drawer(x, H-top-size, s)
    return pdfmetrics.stringWidth(s, font, size)


def paragraph(s, x, top, w, size=16, leading=22, fill="muted", bottom=None):
    style = ParagraphStyle("body", fontName="regular", fontSize=size, leading=leading,
                           textColor=color(fill), spaceAfter=0, spaceBefore=0)
    p = Paragraph(s.replace("−", "-").replace("–", "-"), style)
    _, height = p.wrap(w, H)
    if bottom is not None and top + height > bottom:
        raise ValueError(f"{top+height}>{bottom}: {s}")
    p.drawOn(c, x, H-top-height)
    return height


def link(s, url, x, top, size=14, fill="blueDark"):
    w = text(s, x, top, size, "bold", fill)
    c.linkURL(url, (x, H-top-size-6, x+w, H-top+2), relative=0)


def pill(s, x, top, w, fill, fg="ink", size=14, url=None, h=34):
    box(x, top, w, h, fill, radius=h/2)
    text(s, x+w/2, top+(h-size)/2-2, size, "bold", fg, "center")
    if url:
        c.linkURL(url, (x, H-top-h, x+w, H-top), relative=0)


def heading(num, section, title, lead):
    box(0, 0, W, H, "paper")
    box(0, 0, W, 204, "#FCFBF8")
    box(52, 32, 16, 4, "blue", radius=2)
    text(section, 78, 24, 16, "bold", "blueDark")
    text(title, 50, 52, 51, "bold", "forest")
    if num == 1:
        text("RISA Labs Growth APM assignment", 1386, 29, 16, "bold", "muted", "right")
        box(1403, 15, 145, 52, "ink", radius=10)
        c.drawImage(str(RISA_LOGO), 1418, H-61, 115, 40, mask="auto")
        text(lead, 53, 120, 19, "regular", "muted")
        name_width = text(AUTHOR, 52, 153, 22, "bold", "ink")
        text(f"IIT Kharagpur  ·  {ROLL_NO}", 52+name_width+21, 157, 17, "regular", "muted")
        pill("Open live app", 1053, 123, 232, "blue", "white", size=22, url=LIVE, h=55)
        pill("GitHub README", 1299, 123, 249, "bluePale", "blueDark", size=22, url=README, h=55)
        stroke(52, 193, 1548, 193, "line")
    else:
        text("RISA Labs Growth APM  /  Challenge B", 1548, 24, 15, "bold", "muted", "right")
        text(lead, 53, 124, 19, "regular", "muted")
        stroke(52, 171, 1548, 171, "line")
    stroke(52, 848, 1548, 848, "line")
    text(AUTHOR, 52, 865, 15, "bold", "ink")
    text("IIT Kharagpur", 208, 865, 15, "regular", "muted")
    text(f"{num} / 3", 1548, 864, 15, "bold", "muted", "right")


def panel(x, top, w, h, title, note=None):
    box(x, top, w, h, "white", "line", 17)
    text(title, x+22, top+16, 23, "bold", "ink")
    if note:
        text(note, x+22, top+52, 15, "regular", "muted")


def lakh(n, decimals=2, symbol=True):
    value = (Decimal(n) / Decimal(100000)).quantize(Decimal(10) ** -decimals, rounding=ROUND_HALF_UP)
    return ("₹" if symbol else "") + f"{value:.{decimals}f}L"


def sign_lakh(n):
    return ("+" if n >= 0 else "−") + lakh(abs(n))


def data_value(row, scenario):
    _, _, _, signed, price, on_time = row[scenario]
    return round(signed * price * on_time)


def historic_comparator(row):
    return round(row["proof"] * PLAN["baselineCollectionRate"])


def priority(row):
    return sum(a*b for a, b in zip(row["criteria"], PLAN["scoreWeights"], strict=True))


BASE = sum(data_value(r, "base") for r in ROWS)
STRETCH = sum(data_value(r, "stretch") for r in ROWS)
BENCH = sum(historic_comparator(r) for r in ROWS)
TOP_THREE = round(100 * sum(data_value(r, "base") for r in ROWS[:3]) / BASE)
BUDGET = sum(r["budget"] for r in ROWS)
N = [[sum(r[s][stage] for r in ROWS) for stage in range(4)] for s in ("base", "stretch")]
BOOKED = [sum(r[s][3]*r[s][4] for r in ROWS) for s in ("base", "stretch")]
assert (BASE, STRETCH, BENCH, BUDGET, TOP_THREE) == (2745750, 3984400, 1700000, 120000, 94)
overview_script = """
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const data = runInNewContext('const PLAN='+readFileSync('data/plan.json','utf8')+';'+readFileSync('src/analytics.js','utf8')+';overview(initial())');
process.stdout.write(JSON.stringify(data));
"""
live = json.loads(check_output(["node", "--input-type=module", "-e", overview_script], cwd=ROOT))
assert (live["totals"]["cash"], live["projection"], live["target"]-live["projection"]) == (950000, 2634980, 110770)

# Slide 1. Stage volumes, payment conversion, and sponsor selection.
heading(1, "Challenge B  /  Sponsorship growth", "How much cash can CampusFest collect?",
        "Bengaluru’s tech cluster makes it easier to reach employers and meet sponsors locally.")

kpis = [
    ("BENCHMARK", lakh(BENCH), "₹20.00L previously pledged × 85% assumed to pay on time", "sand", "goldDark"),
    ("BASE CASE", lakh(BASE), f"{N[0][3]} deals · {lakh(Decimal(BOOKED[0])/N[0][3])} average · {lakh(BOOKED[0])} signed", "mint", "forest"),
    ("STRETCH CASE", lakh(STRETCH), f"{N[1][3]} deals · {lakh(Decimal(BOOKED[1])/N[1][3])} average · {lakh(BOOKED[1])} signed", "bluePale", "blueDark"),
]
for i, (name, value, caption, fill, fg) in enumerate(kpis):
    x = 52+i*505
    box(x, 207, 486, 106, fill, radius=15)
    text(name, x+20, 217, 14, "bold", fg)
    text(value, x+18, 239, 38, "bold", fg)
    paragraph(caption, x+20, 283, 448, 14, 17, fg, 308)

panel(52, 326, 912, 410, "From prospect to signed deal", "Each prospect counts once. Rates compare with the previous stage.")
dot(648, 367, 5, "teal"); text("Base", 662, 355, 15, "bold", "muted")
dot(749, 367, 5, "blue"); text("Stretch", 763, 355, 15, "bold", "muted")
stages = ["Prospects", "Conversations", "Proposals", "Signed deals"]
centres = [182, 392, 602, 812]
start_y, step, scale = 560, 55, 124/210
for y in (435, 476, 518, 560):
    stroke(116,y,919,y)
for idx, (name, x) in enumerate(zip(stages, centres, strict=True)):
    for case, fill, offset in [(0,"teal",-31),(1,"blue",12)]:
        v=N[case][idx]
        h=v*scale
        box(x+offset, start_y-h, 31, h, fill, radius=3)
        text(str(v),x+offset+15.5,start_y-h-24,17,"bold",fill,"center")
    text(name,x,572,16,"bold","ink","center")
    if idx:
        rates=[round(100*ns[idx]/ns[idx-1]) for ns in N]
        text(f"{rates[0]}%   /   {rates[1]}%",x,598,15,"regular","muted","center")
    else:
        text("Named brands",x,598,15,"regular","muted","center")
stroke(74,633,942,633,"line")
box(76,649,864,67,"grayPale",radius=9)
text("Cash collected by 11 April",92,658,17,"bold","ink")
text(f"{lakh(BASE)} base ({BASE/BOOKED[0]:.1%})", 384,659,16,"bold","teal")
text(f"{lakh(STRETCH)} stretch ({STRETCH/BOOKED[1]:.1%})", 662,659,16,"bold","blueDark")
text("Signed deals × average deal size × on-time payment rate, summed across channels.",92,686,14,"regular","muted")

panel(984,326,564,410,"Where to find sponsors","Past cash commitments by source")
series = [("Creator referrals",725000,"teal"),("Warm introductions",640000,"blue"),("Partner interest form",635000,"violet")]
for i,(label,val,fill) in enumerate(series):
    y=410+32*i
    text(label,1007,y,15,"bold","ink")
    box(1202,y+6,254,10,"grayPale",radius=4)
    box(1202,y+6,254*val/725000,10,fill,radius=4)
    text(lakh(val),1526,y-1,15,"bold","muted","right")
text("₹20.00L total   /   20 cash deals   /   ₹95k median",1007,512,14,"bold","muted")
stroke(1006,538,1526,538,"line")
sponsors=[
  ("Tech and career brands","Student demos and opt-in recruiting leads."),
  ("Consumer brands","Category exclusivity and on-site trials."),
  ("Local businesses","Fixed-price booths and early payment approval.")
]
for i,(label,description) in enumerate(sponsors):
    y=549+39*i
    dot(1012,y+10,4,"blue" if i==0 else "teal" if i==1 else "gold")
    text(label,1025,y,15,"bold","ink")
    text(description,1025,y+18,14,"regular","muted")
box(1006,675,520,45,"grayPale",radius=8)
text("Screen for student fit, access to a budget owner,",1017,680,13,"bold","forest")
text("payment by 11 April, and no category conflicts.",1017,697,13,"regular","muted")

box(52,756,1496,69,"forest",radius=13)
text("Six weeks to sell",72,769,19,"bold","white")
text("₹1.20L acquisition budget",355,770,18,"bold","mintBright")
text("4 owners × 6 conversations/week",713,770,18,"bold","white")
text("144-conversation capacity",1526,770,16,"regular","mintBright","right")
text("Cash cutoff 11 Apr 2025",72,797,14,"regular","mintBright")
text("The workbook records pledges. We estimate how much arrives by the cutoff.",355,797,15,"regular","white")
link("Source workbook",WORKBOOK,355,866)
link("Bengaluru source",CITY,520,866)
c.showPage()

# Slide 2. An explicit waterfall from modeled comparator to base target.
heading(2,"Channel priorities","Put the first ₹90k into proven channels",
        f"Creator referrals, warm introductions and inbound account for {TOP_THREE}% of projected base-case cash.")

panel(52,224,857,400,"How the base case adds ₹10.46L","Expected cash above the ₹17.00L benchmark")
plot_x, plot_y, plot_bottom, chart_h = 115, 327, 540, 195
for level in (0, 10, 20, 30):
    y=plot_bottom-level/30*chart_h
    stroke(plot_x,y,881,y)
    text(f"₹{level}L",105,y-11,13,"regular","quiet","right")
names=["Benchmark","Creator","Warm","Inbound","Revival","Cold","Base case"]
weights=[BENCH]+[data_value(r,"base")-historic_comparator(r) for r in ROWS]+[BASE]
colors=["gold","teal","blue","violet","amber","rose","forest"]
running=0
for i,(name,amount,fill) in enumerate(zip(names,weights,colors,strict=True)):
    xc=164+i*111
    low=0 if i in (0,6) else running
    high=amount if i in (0,6) else running+amount
    y_hi=plot_bottom-high/3000000*chart_h
    y_lo=plot_bottom-low/3000000*chart_h
    box(xc-31,y_hi,62,max(2,y_lo-y_hi),fill,radius=4)
    lab=sign_lakh(amount) if 0<i<6 else lakh(amount)
    text(lab,xc,y_hi-26,14,"bold","ink","center")
    text(name,xc,554,14,"bold","muted","center")
    if i < 6:
        stroke(xc+31,y_hi,xc+80,y_hi,"quiet",0.8,[3,3])
        running=high
text("Each step shows how much a channel adds above its share of the benchmark.",74,594,14,"regular","muted")

panel(52,644,857,178,"Budget split","Share of ₹1.20L")
budget_colors=["teal","blue","violet","amber","rose"]
total_width=804
left=74
for row,fill in zip(ROWS,budget_colors,strict=True):
    width=total_width*row["budget"]/BUDGET
    box(left,715,width,23,fill)
    text(f"₹{row['budget']//1000}k",left+width/2,716,14,"bold","white" if fill!="amber" else "ink","center")
    left+=width
for i,(label,fill) in enumerate(zip(["Creator","Warm","Inbound","Revival","Cold"],budget_colors,strict=True)):
    x=74+i*160
    dot(x+5,768,5,fill)
    text(label,x+16,756,14,"bold","muted")
text("75% to the three established sources",74,789,15,"bold","forest")

panel(931,224,617,598,"What we’ll test first","40% cash lift · 25% evidence · 20% speed · 15% ease")
descriptions={
    "creator": ("Creator intros build trust and open doors for demos.", "10 introductions by D−28 / qualification rate"),
    "warm": ("Alumni introductions get us to budget owners.", "10 introductions by D−28 / decision-maker calls"),
    "inbound": ("A same-day quote makes it easier to act on interest.", "10 inquiries by D−21 / 24-hour first response"),
    "revival": ("A smaller offer may reopen stalled deals.", "15 dormant leads by D−24 / positive reply rate"),
    "cold": ("A capped email test reaches untapped categories.", "25 delivered emails by D−25 / positive reply rate")
}
for i,(row,fill) in enumerate(zip(ROWS,budget_colors,strict=True)):
    y=303+i*93
    dot(965,y+14,16,fill)
    text(str(i+1),965,y+2,15,"bold","ink" if fill=="amber" else "white","center")
    text(row["name"],994,y-2,19,"bold","ink")
    text(f"{priority(row):.2f} / 5",1526,y-2,15,"bold","muted","right")
    text(descriptions[row["id"]][0],995,y+24,15,"regular","muted")
    text(descriptions[row["id"]][1],995,y+48,14,"bold","forest")
    text(f"{lakh(data_value(row,'base'))} base",1526,y+28,14,"bold","blueDark","right")
    text(f"{row['owner']}  /  {row['window']}",1526,y+49,13,"regular","muted","right")
    stroke(951,y+79,1526,y+79)
text("Assign each prospect to one channel. Keep revival and cold outreach small.",952,776,13,"bold","muted")
text("Pause cold outreach below 6% positive replies after 25 delivered emails.",952,795,13,"regular","muted")
link("Full channel assumptions",README,355,866)
text("D is festival day, 12 Apr 2025.",1456,866,13,"regular","muted","right")
c.showPage()

# Slide 3. Diverging forecast gaps, operational decisions and saved workflow.
gap = live["target"]-live["projection"]
heading(3,"Weekly review","Fix inbound response time first",
        f"With 16 days left, the cash forecast is {lakh(gap)} below target. Inbound accounts for {lakh(live['details'][2]['gap'])} of the shortfall.")
kpi3=[
    ("COLLECTED",lakh(live["totals"]["cash"]),"10 simulated deals with receipts","mint","forest"),
    ("ON-TIME FORECAST",lakh(live["projection"]),"Base target ₹27.46L","bluePale","blueDark"),
    ("FORECAST GAP",lakh(gap),"Simulation as of 27 Mar 2025","sand","goldDark"),
]
for i,(label,value,note,fill,fg) in enumerate(kpi3):
    x=52+i*505
    box(x,185,486,98,fill,radius=14)
    text(label,x+18,197,14,"bold",fg)
    text(value,x+17,219,38,"bold",fg)
    text(note,x+469,247,14,"regular",fg,"right")

panel(52,305,516,335,"Where cash is ahead or behind","Projected cash minus the base target")
baseline_x=398
scale=133/110320
text("0",baseline_x,375,12,"bold","quiet","center")
stroke(baseline_x,392,baseline_x,579,"quiet",1)
for i,row in enumerate(live["details"]):
    v=row["projection"]-row["plan"]["cash"]
    y=400+34*i
    width=abs(v)*scale
    fill="teal" if v>=0 else "rose"
    text(row["short"],73,y,14,"bold","ink")
    box(baseline_x if v>=0 else baseline_x-width,y+4,width,12,fill,radius=3)
    text(sign_lakh(v),545,y-1,14,"bold",fill,"right")
box(73,596,475,23,"redPale",radius=5)
text("Inbound gap ₹1.10L · first replies within 24h at 74%",83,597,13,"bold","rose")

panel(52,653,516,168,"Payment checkpoints")
for i,(deadline,task) in enumerate([
    ("D−14","Verify invoice approval on signed deals."),
    ("D−7","Escalate high-value unpaid deals to finance."),
    ("D−1","Count receipts cleared by the cutoff.")
]):
    y=702+31*i
    box(73,y,59,22,"bluePale",radius=5)
    text(deadline,102,y+2,13,"bold","blueDark","center")
    text(task,144,y+1,14,"regular","muted")

panel(591,305,957,390,"What to do about each campaign","Make the call once the pilot reaches its minimum sample.")
xvals=[608,813,951,1090,1127,1203]
for label,x in zip(["Campaign / risk","Signal / n","Scale / change / stop","Min.","Decision","Next move"],xvals,strict=True):
    text(label,x,391,12 if x==951 else 13,"bold","muted")
decisions={
 "creator":("Low-fit brands","Qual. intro rate","Add matched creators"),
 "warm":("Budget approval","Decision-call rate","Extend alumni referrals"),
 "inbound":("Slow response","Reply within 24h","Reassign triage"),
 "revival":("Low interest","Positive replies","Narrow the offer"),
 "cold":("List fatigue","Positive replies","Pause the list")
}
response_paths={
 "creator":"Prune weak matches or pause new payouts.",
 "warm":"Find the budget owner or stop broad asks.",
 "inbound":"Expand at 85%+ or pause below 65%.",
 "revival":"Scale at 25%+ or stop the cohort below 12%.",
 "cold":"Retarget once if replies recover to 6%."
}
for i,row in enumerate(live["details"]):
    name,metric,action=decisions[row["id"]]
    y=418+49*i
    if i%2==0:
        box(605,y-3,928,46,"grayPale",radius=6)
    text(row["short"],608,y,15,"bold","ink")
    text(name,608,y+20,12,"regular","muted")
    text(f"{row['actual']['signal']}%   /   {row['actual']['sample']}",813,y,15,"bold","ink")
    text(metric,813,y+20,12,"regular","muted")
    text(f"{row['scale']}+ / {row['change']}–<{row['scale']} / <{row['change']}",951,y+1,14,"bold","ink")
    text("Percent",951,y+21,12,"regular","muted")
    text(str(row["min"]),1090,y+4,16,"bold","ink")
    state=row["decision"]
    bg,fg=("mint","teal") if state=="Scale" else ("sand","goldDark") if state=="Change" else ("redPale","rose")
    pill(state,1118,y+4,72,bg,fg,12,h=23)
    text(action,1203,y+1,14,"bold","ink")
    text(response_paths[row["id"]],1203,y+21,12,"regular","muted")
text("If a campaign needs a change, adjust the pitch or assign a new owner and check the next batch.",609,673,13,"regular","muted")

panel(591,711,957,110,"Review in Sponsor Desk")
text("Ask “Which campaign has the biggest forecast gap?” Then follow up with “Why?”",609,757,14,"regular","muted")
steps = [(608,"Dashboard flags inbound"),(851,"Copilot explains the 74% signal"),(1124,"Confirm Kabir’s task")]
for j,(x,title) in enumerate(steps, start=1):
    dot(x+11,795,10,"blue")
    text(str(j),x+11,785,12,"bold","white","center")
    text(title,x+28,783,15,"bold","ink")
pill("Open live app",1323,757,203,"blue","white",size=19,url=LIVE,h=48)
link("Model and test notes",README,355,866)
text("Page 3 shows the app’s simulated workspace.",1456,866,13,"regular","muted","right")
c.showPage()
c.save()
print(args.output)
