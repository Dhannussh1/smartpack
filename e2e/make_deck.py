import sys
from pathlib import Path
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR

ROOT = Path(sys.argv[1])
SHOTS = ROOT / "e2e" / "out" / "shots"
OUT = ROOT / "deliverables" / "SmartPack-pitch.pptx"

PAGE = RGBColor(0xF7, 0xF5, 0xEF)
INK = RGBColor(0x1B, 0x1F, 0x1D)
SOFT = RGBColor(0x5A, 0x61, 0x5D)
BRAND = RGBColor(0x1F, 0x6F, 0x4A)
BRAND_SOFT = RGBColor(0xE6, 0xEF, 0xE7)
BAD = RGBColor(0xC2, 0x41, 0x2D)
LINE = RGBColor(0xE5, 0xE1, 0xD6)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
NIGHT = RGBColor(0x14, 0x21, 0x1B)
SERIF = "Georgia"
SANS = "Segoe UI"

prs = Presentation()
prs.slide_width, prs.slide_height = Inches(13.333), Inches(7.5)
W, H = prs.slide_width, prs.slide_height
BLANK = prs.slide_layouts[6]


def bg(slide, color=PAGE):
    f = slide.background.fill
    f.solid()
    f.fore_color.rgb = color


def text(slide, x, y, w, h, s, size=18, color=INK, bold=False, font=SANS, align=PP_ALIGN.LEFT, italic=False):
    tb = slide.shapes.add_textbox(x, y, w, h)
    tf = tb.text_frame
    tf.word_wrap = True
    lines = s if isinstance(s, list) else [s]
    for i, line in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        r = p.add_run()
        r.text = line
        r.font.size = Pt(size)
        r.font.bold = bold
        r.font.italic = italic
        r.font.name = font
        r.font.color.rgb = color
        p.space_after = Pt(size * 0.45)
    return tb


def eyebrow(slide, s, x=Inches(0.8), y=Inches(0.7), color=BRAND):
    text(slide, x, y, Inches(8), Inches(0.4), s.upper(), size=12, color=color, bold=True)


def title(slide, s, x=Inches(0.8), y=Inches(1.05), w=Inches(11.5), size=40, color=INK):
    text(slide, x, y, w, Inches(1.4), s, size=size, color=color, font=SERIF)


def rect(slide, x, y, w, h, fill, line=None, shape=MSO_SHAPE.ROUNDED_RECTANGLE):
    r = slide.shapes.add_shape(shape, x, y, w, h)
    r.fill.solid()
    r.fill.fore_color.rgb = fill
    if line:
        r.line.color.rgb = line
        r.line.width = Pt(1)
    else:
        r.line.fill.background()
    if shape == MSO_SHAPE.ROUNDED_RECTANGLE:
        r.adjustments[0] = 0.08
    r.shadow.inherit = False
    return r


def image(slide, name, x, y, w=None, h=None, border=True):
    p = SHOTS / f"{name}.png"
    if not p.exists():
        return None
    pic = slide.shapes.add_picture(str(p), x, y, width=w, height=h)
    if border:
        pic.line.color.rgb = LINE
        pic.line.width = Pt(1)
    return pic


def notes(slide, s):
    slide.notes_slide.notes_text_frame.text = s


def bullets(slide, items, x, y, w, size=17, gap=0.62):
    for i, (head, body) in enumerate(items):
        yy = y + Inches(gap * i * 1.0) if isinstance(gap, float) else y
        dot = slide.shapes.add_shape(MSO_SHAPE.OVAL, x, yy + Inches(0.12), Inches(0.12), Inches(0.12))
        dot.fill.solid(); dot.fill.fore_color.rgb = BRAND; dot.line.fill.background()
        tb = slide.shapes.add_textbox(x + Inches(0.3), yy, w, Inches(gap))
        tf = tb.text_frame; tf.word_wrap = True
        p = tf.paragraphs[0]
        r1 = p.add_run(); r1.text = head; r1.font.bold = True; r1.font.size = Pt(size); r1.font.color.rgb = INK; r1.font.name = SANS
        if body:
            r2 = p.add_run(); r2.text = "  " + body; r2.font.size = Pt(size - 1); r2.font.color.rgb = SOFT; r2.font.name = SANS


# 1 ─ title
s = prs.slides.add_slide(BLANK); bg(s, NIGHT)
text(s, Inches(0.8), Inches(0.7), Inches(6), Inches(0.5), "SMARTPACK", size=14, color=RGBColor(0xC8, 0xE6, 0xA0), bold=True)
text(s, Inches(0.8), Inches(1.6), Inches(6.2), Inches(3), ["The label says healthy.", "We tell you if it's", "safe for you."], size=44, color=WHITE, font=SERIF)
text(s, Inches(0.8), Inches(5.0), Inches(5.8), Inches(1.2), "Point your phone at any food packet. SmartPack reads the label, uncovers hidden ingredients, catches misleading claims and checks it against your own health reports.", size=16, color=RGBColor(0xC9, 0xD1, 0xCC))
image(s, "desktop-01-landing", Inches(7.2), Inches(1.3), w=Inches(5.6), border=False)
notes(s, "Hold up a packet. 'This says No Added Sugar. Would you trust it?'")

# 2 ─ problem
s = prs.slides.add_slide(BLANK); bg(s)
eyebrow(s, "The problem")
title(s, "Food labels are tiny, technical and designed to persuade.")
cards = [
    ("Hidden ingredients", "Sugar hides under names like maltodextrin, dextrose and invert syrup. Salt hides in MSG and sodium additives."),
    ("Misleading claims", "'No added sugar', 'Multigrain', 'Baked not fried' sit on the front; the back of the pack often says otherwise."),
    ("One label, many bodies", "A biscuit that is fine for a gym-goer can be harmful for someone with diabetes, high BP or an allergy."),
]
for i, (h, b) in enumerate(cards):
    x = Inches(0.8 + i * 4.0)
    rect(s, x, Inches(3.0), Inches(3.7), Inches(3.4), WHITE, LINE)
    text(s, x + Inches(0.35), Inches(3.35), Inches(3.0), Inches(0.6), h, size=20, color=INK, bold=True)
    text(s, x + Inches(0.35), Inches(4.05), Inches(3.0), Inches(2.2), b, size=15, color=SOFT)
notes(s, "Every family buys packaged food daily. People with diabetes, hypertension or allergies are guessing.")

# 3 ─ solution
s = prs.slides.add_slide(BLANK); bg(s)
eyebrow(s, "The solution")
title(s, "Scan. Understand. Choose better.")
steps = [("1", "Tell us about you", "Conditions, goals, allergies, diet, plus your checkup report."), ("2", "Scan up to 4 photos", "Ingredients, nutrition table, front of pack, dates. Camera or upload."), ("3", "Get your verdict", "SAFE / LIMIT / AVOID, how much you can eat, and why, in English or Tamil.")]
for i, (n, h, b) in enumerate(steps):
    x = Inches(0.8 + i * 4.0)
    rect(s, x, Inches(2.9), Inches(3.7), Inches(3.2), WHITE, LINE)
    text(s, x + Inches(0.35), Inches(3.1), Inches(1), Inches(0.9), n, size=40, color=BRAND, font=SERIF)
    text(s, x + Inches(0.35), Inches(4.1), Inches(3.0), Inches(0.5), h, size=19, bold=True)
    text(s, x + Inches(0.35), Inches(4.7), Inches(3.0), Inches(1.3), b, size=14, color=SOFT)
text(s, Inches(0.8), Inches(6.5), Inches(12), Inches(0.5), "Works on any packet, even local brands with no barcode-database entry, because it reads the label itself.", size=14, color=SOFT, italic=True)

# 4 ─ demo: scan
s = prs.slides.add_slide(BLANK); bg(s)
eyebrow(s, "Live demo · 1")
title(s, "Up to four photos of any packet.", size=34)
image(s, "desktop-05-scan-photos", Inches(0.8), Inches(2.2), w=Inches(7.6))
bullets(s, [("Camera or upload", "mix both"), ("Guided slots", "ingredients, nutrition, front, dates"), ("Auto-compressed", "fast on mobile data")], Inches(8.9), Inches(2.6), Inches(3.9), size=16, gap=0.9)
notes(s, "Ask a judge for any packet from their bag and scan it live.")

# 5 ─ demo: verdict
s = prs.slides.add_slide(BLANK); bg(s)
eyebrow(s, "Live demo · 2")
title(s, "A verdict for you, not for the average person.", size=34)
image(s, "desktop-06-result-top", Inches(0.8), Inches(2.2), w=Inches(7.6))
bullets(s, [("Safe amount today", "from your personal limits"), ("Reasons quote your reports", "e.g. 'your BP 142/92', 'HbA1c 7.4%'"), ("Listen", "English and Tamil voice")], Inches(8.9), Inches(2.6), Inches(3.9), size=16, gap=0.95)
notes(s, "Read out the reason line that quotes the user's own lab value.")

# 6 ─ lie detector
s = prs.slides.add_slide(BLANK); bg(s)
eyebrow(s, "Live demo · 3", color=BAD)
title(s, "The Label Lie Detector.", size=34)
image(s, "desktop-07-result-details", Inches(0.8), Inches(2.2), w=Inches(7.6))
bullets(s, [("Every claim checked", "against ingredients + nutrition table"), ("Hidden ingredients highlighted", "sugars in red, additives in amber"), ("Plain-language notes", "what each flagged ingredient means")], Inches(8.9), Inches(2.6), Inches(3.9), size=16, gap=0.95)

# 7 ─ personal memory
s = prs.slides.add_slide(BLANK); bg(s)
eyebrow(s, "Personalisation")
title(s, "It remembers your health reports.", size=34)
image(s, "desktop-04-documents", Inches(0.8), Inches(2.2), w=Inches(6.0))
image(s, "desktop-08-ask", Inches(7.1), Inches(2.2), w=Inches(5.4))
text(s, Inches(0.8), Inches(6.55), Inches(12), Inches(0.6), "Upload a checkup report → lab values are extracted → stored as private vectors → retrieved for every scan, question and chat.", size=14, color=SOFT)

# 8 ─ assistant
s = prs.slides.add_slide(BLANK); bg(s)
eyebrow(s, "Assistant")
title(s, "Ask anything about food.", size=34)
image(s, "desktop-09-assistant", Inches(0.8), Inches(2.2), w=Inches(7.6))
bullets(s, [("Knows your profile", "conditions, diet, limits"), ("Uses your reports", "and your recent scans"), ("Follow-up suggestions", "plus Tamil voice")], Inches(8.9), Inches(2.6), Inches(3.9), size=16, gap=0.9)

# 9 ─ mobile
s = prs.slides.add_slide(BLANK); bg(s)
eyebrow(s, "Mobile first")
title(s, "Built for the phone in your hand.", size=34)
for i, n in enumerate(["mobile-03-overview", "mobile-06-result-top", "mobile-09-assistant", "mobile-04-menu"]):
    image(s, n, Inches(0.8 + i * 3.1), Inches(2.2), h=Inches(4.9))

# 10 ─ architecture
s = prs.slides.add_slide(BLANK); bg(s)
eyebrow(s, "How it works")
title(s, "AI reads and explains. Code decides the facts.", size=32)
def box(x, y, w, h, head, body, fill=WHITE, hc=INK):
    rect(s, x, y, w, h, fill, LINE)
    text(s, x + Inches(0.25), y + Inches(0.18), w - Inches(0.4), Inches(0.5), head, size=15, bold=True, color=hc)
    text(s, x + Inches(0.25), y + Inches(0.62), w - Inches(0.4), h - Inches(0.7), body, size=12, color=SOFT)
box(Inches(0.8), Inches(2.4), Inches(3.4), Inches(3.6), "Phone / browser (PWA)", ["Camera + multi-photo", "Deterministic engine:", "hidden sugars, allergens,", "safe quantity, expiry", "Hosted on GitHub Pages"])
box(Inches(4.75), Inches(2.4), Inches(3.9), Inches(3.6), "Supabase", ["Auth (Google + email)", "Postgres + row-level security", "pgvector (HNSW) report memory", "Private storage for reports", "Edge Functions (API keys server-side)"], fill=BRAND_SOFT, hc=BRAND)
box(Inches(9.2), Inches(2.4), Inches(3.3), Inches(3.6), "Gemini", ["Vision: read the label", "Reasoning: personal verdict", "Embeddings: report search", "Failover: 3 models × 3 keys"])
for x in (Inches(4.25), Inches(8.7)):
    a = s.shapes.add_shape(MSO_SHAPE.RIGHT_ARROW, x, Inches(4.0), Inches(0.45), Inches(0.35)); a.fill.solid(); a.fill.fore_color.rgb = BRAND; a.line.fill.background()
text(s, Inches(0.8), Inches(6.35), Inches(12), Inches(0.6), "Allergens and expiry are hard rules the AI cannot override. Numbers come from the label, not from the model.", size=14, color=INK, italic=True)

# 11 ─ trust / tested
s = prs.slides.add_slide(BLANK); bg(s)
eyebrow(s, "Tested")
title(s, "Working end to end, on desktop and mobile.", size=34)
stats = [("28 / 28", "automated checks passed\n(14 desktop + 14 mobile)"), ("~12–25 s", "per scan with 1–2 photos\n(measured)"), ("9 / 9", "lab values read correctly\nfrom a sample report")]
for i, (big, small) in enumerate(stats):
    x = Inches(0.8 + i * 4.0)
    rect(s, x, Inches(2.6), Inches(3.7), Inches(2.6), WHITE, LINE)
    text(s, x + Inches(0.35), Inches(2.85), Inches(3.2), Inches(1), big, size=38, color=BRAND, font=SERIF)
    text(s, x + Inches(0.35), Inches(3.95), Inches(3.2), Inches(1.2), small.split("\n"), size=14, color=SOFT)
bullets(s, [("Private by design", "row-level security; each user only sees their own data"), ("Keys never in the browser", "all AI calls go through server functions")], Inches(0.8), Inches(5.6), Inches(11.5), size=15, gap=0.55)
notes(s, "Add your measured accuracy on 20 real packets here once the test-label set is done.")

# 12 ─ close
s = prs.slides.add_slide(BLANK); bg(s, NIGHT)
text(s, Inches(0.8), Inches(2.2), Inches(11.5), Inches(1.5), "Food safety shouldn't need a nutrition degree.", size=40, color=WHITE, font=SERIF)
text(s, Inches(0.8), Inches(3.6), Inches(11.5), Inches(1), "Scan. Understand. Choose better.", size=26, color=RGBColor(0xC8, 0xE6, 0xA0), font=SERIF, italic=True)
text(s, Inches(0.8), Inches(5.4), Inches(11.5), Inches(0.5), "Live: dhannussh1.github.io/smartpack   ·   Next: family profiles, offline mode, more Indian languages", size=15, color=RGBColor(0xC9, 0xD1, 0xCC))

OUT.parent.mkdir(exist_ok=True)
prs.save(OUT)
print("saved", OUT, "slides:", len(prs.slides))
