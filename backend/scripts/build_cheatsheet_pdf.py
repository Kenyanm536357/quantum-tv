"""Generate the Quantum TV developer cheat-sheet PDF.

Run with:  python /app/backend/scripts/build_cheatsheet_pdf.py

Outputs: /app/backend/storage/quantum-tv-cheatsheet.pdf
The FastAPI backend serves this via `/api/cheatsheet`.
"""

from pathlib import Path
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.colors import HexColor, white
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether,
)

OUT = Path(__file__).resolve().parent.parent / "storage" / "quantum-tv-cheatsheet.pdf"
OUT.parent.mkdir(parents=True, exist_ok=True)

# ---- Brand palette (matches app logo) ---------------------------------
PURPLE = HexColor("#8B5CF6")
CYAN   = HexColor("#67E8F9")
MAGENTA = HexColor("#EC4899")
DARK   = HexColor("#0B0518")
INK    = HexColor("#1a1a1a")
MUTED  = HexColor("#4B5563")
SOFT   = HexColor("#EEF2FF")
CODEBG = HexColor("#0F172A")

styles = getSampleStyleSheet()

def P(text, size=10, color=INK, leading=None, bold=False, family="Helvetica", space=4):
    fam = f"{family}-Bold" if bold else family
    return Paragraph(
        text,
        ParagraphStyle(
            "p", parent=styles["BodyText"],
            fontName=fam, fontSize=size,
            textColor=color, leading=leading or size + 3,
            spaceAfter=space, alignment=TA_LEFT,
        ),
    )

def H1(text):
    return Paragraph(
        text,
        ParagraphStyle(
            "h1", parent=styles["Heading1"],
            fontName="Helvetica-Bold", fontSize=22,
            textColor=PURPLE, spaceAfter=6, leading=26,
        ),
    )

def H2(text):
    return Paragraph(
        text,
        ParagraphStyle(
            "h2", parent=styles["Heading2"],
            fontName="Helvetica-Bold", fontSize=14,
            textColor=DARK, spaceBefore=10, spaceAfter=6, leading=18,
        ),
    )

def H3(text):
    return Paragraph(
        text,
        ParagraphStyle(
            "h3", parent=styles["Heading3"],
            fontName="Helvetica-Bold", fontSize=11,
            textColor=PURPLE, spaceBefore=6, spaceAfter=2, leading=14,
        ),
    )

def code_block(text):
    """Dark code block, monospace, cyan text."""
    lines = text.strip("\n").split("\n")
    escaped = "<br/>".join(
        l.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;") or "&nbsp;"
        for l in lines
    )
    para = Paragraph(
        escaped,
        ParagraphStyle(
            "code", fontName="Courier", fontSize=8.5,
            textColor=CYAN, leading=11, leftIndent=8, rightIndent=8,
        ),
    )
    t = Table([[para]], colWidths=[6.9 * inch])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), CODEBG),
        ("BOX", (0, 0), (-1, -1), 0.5, PURPLE),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    return t

def callout(icon, title, body, color=CYAN):
    """A right-side callout box (tip / warning / note)."""
    header = Paragraph(
        f"<font color='#0B0518'><b>{icon} {title}</b></font>",
        ParagraphStyle("callh", fontName="Helvetica-Bold", fontSize=9.5,
                       textColor=DARK, leading=12),
    )
    text = Paragraph(
        body,
        ParagraphStyle("callb", fontName="Helvetica", fontSize=9,
                       textColor=INK, leading=12),
    )
    inner = Table([[header], [text]], colWidths=[6.9 * inch])
    inner.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), SOFT),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LINEBEFORE", (0, 0), (0, -1), 3, color),
    ]))
    return inner

def table_grid(rows, col_widths):
    """Two-column reference table with a coloured header."""
    header = rows[0]
    body = rows[1:]
    styled = [
        [Paragraph(f"<b>{c}</b>", ParagraphStyle("th", fontName="Helvetica-Bold",
                                                 fontSize=9.5, textColor=white,
                                                 leading=12))
         for c in header],
    ]
    for r in body:
        styled.append([
            Paragraph(c, ParagraphStyle("td", fontName="Helvetica", fontSize=9,
                                        textColor=INK, leading=12)) for c in r
        ])
    t = Table(styled, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PURPLE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, SOFT]),
        ("BOX", (0, 0), (-1, -1), 0.4, PURPLE),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, HexColor("#C7D2FE")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return t

# ============================================================
# Page decoration — brand ribbon at top, footer at bottom
# ============================================================
def draw_frame(canvas, doc):
    canvas.saveState()
    # Top ribbon
    canvas.setFillColor(PURPLE)
    canvas.rect(0, LETTER[1] - 0.35 * inch, LETTER[0], 0.35 * inch, fill=1, stroke=0)
    canvas.setFillColor(CYAN)
    canvas.rect(0, LETTER[1] - 0.40 * inch, LETTER[0], 0.05 * inch, fill=1, stroke=0)
    canvas.setFillColor(white)
    canvas.setFont("Helvetica-Bold", 12)
    canvas.drawString(0.5 * inch, LETTER[1] - 0.24 * inch, "QUANTUM TV")
    canvas.setFont("Helvetica", 8.5)
    canvas.drawString(1.75 * inch, LETTER[1] - 0.24 * inch, "Developer Cheat Sheet")
    canvas.setFont("Helvetica", 8)
    canvas.drawRightString(LETTER[0] - 0.5 * inch, LETTER[1] - 0.24 * inch,
                           f"Page {canvas.getPageNumber()}")
    # Footer
    canvas.setStrokeColor(HexColor("#E5E7EB"))
    canvas.line(0.5 * inch, 0.5 * inch, LETTER[0] - 0.5 * inch, 0.5 * inch)
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica-Oblique", 8)
    canvas.drawString(0.5 * inch, 0.32 * inch,
                      "quantumtv.app  |  Local dev + Expo OTA workflow  |  v1.0")
    canvas.drawRightString(LETTER[0] - 0.5 * inch, 0.32 * inch,
                           "Keep this handy!")
    canvas.restoreState()

# ============================================================
# Content
# ============================================================
def build():
    doc = SimpleDocTemplate(
        str(OUT), pagesize=LETTER,
        leftMargin=0.6 * inch, rightMargin=0.6 * inch,
        topMargin=0.65 * inch, bottomMargin=0.65 * inch,
        title="Quantum TV — Developer Cheat Sheet",
        author="Quantum TV",
    )

    story = []

    # ---- COVER ----
    story.append(Spacer(1, 0.15 * inch))
    story.append(H1("Quantum TV — Developer Cheat Sheet"))
    story.append(P(
        "Everything you need to edit code locally in Visual Studio / VS Code and ship it to your "
        "Fire TV, web app, and backend without burning Emergent credits.",
        size=10.5, color=MUTED, leading=14, space=8,
    ))

    # ---- QUICK REFERENCE TABLE ----
    story.append(H2("At a glance — where each change goes"))
    story.append(table_grid([
        ["Change type", "How to ship it", "Cost"],
        ["Mobile UI / JS / colors / layout (React Native)",
         "eas-cli update --branch firetv",
         "FREE"],
        ["Backend endpoints, MongoDB schema (/app/backend)",
         "Emergent 'Deploy' button (replaces existing slot)",
         "no extra ECU"],
        ["Web admin frontend (/app/frontend)",
         "Emergent 'Deploy' button (replaces existing slot)",
         "no extra ECU"],
        ["New native module or version bump",
         "eas build --platform android → reinstall APK",
         "Expo free tier"],
        ["Bug fix that already crashed the app",
         "eas-cli update — Fire TV picks it up on next launch",
         "FREE"],
    ], col_widths=[2.4 * inch, 3.3 * inch, 1.2 * inch]))
    story.append(Spacer(1, 0.15 * inch))

    story.append(callout(
        "TIP",
        "99% of your changes will be React Native UI edits — that means 'eas update' is your daily driver.",
        "Backend / web only when you add or change an API endpoint.",
        color=CYAN,
    ))

    story.append(PageBreak())

    # ============================================================
    # PART 1 — ONE-TIME SETUP
    # ============================================================
    story.append(H1("Part 1 — One-Time Setup (Windows)"))
    story.append(P("Do this once. After that, skip straight to Part 2.",
                   color=MUTED, size=10, space=8))

    story.append(H3("1.1  Install Node.js (comes with npm)"))
    story.append(P("Download the <b>LTS installer</b> from nodejs.org, run it, keep 'Add to PATH' checked."))
    story.append(code_block("https://nodejs.org/en/download"))

    story.append(H3("1.2  Install Yarn (needed by Expo)"))
    story.append(code_block("npm install -g yarn"))

    story.append(H3("1.3  Install Git (if you'll commit from PowerShell)"))
    story.append(P("Skip if you use Visual Studio's built-in Git panel or GitHub Desktop."))
    story.append(code_block("https://git-scm.com/download/win"))

    story.append(H3("1.4  Clone your repo (or use Visual Studio → Clone Repository)"))
    story.append(code_block(
        "cd C:\\Users\\kenya\\source\\repos\n"
        "git clone https://github.com/YOUR_USERNAME/quantum-tv.git\n"
        "cd quantum-tv\\mobile\n"
        "yarn install"
    ))

    story.append(H3("1.5  Save your Expo token permanently"))
    story.append(P("Run once in PowerShell — never retype it again:"))
    story.append(code_block(
        "[Environment]::SetEnvironmentVariable(\"EXPO_TOKEN\", "
        "\"m13wDTu6yFAQp8ybB3ckxqWc41IfuX7lAERYCAz5\", \"User\")"
    ))
    story.append(P("<i>Close and reopen PowerShell after running this.</i>",
                   color=MUTED, size=9))

    story.append(callout(
        "SECURITY",
        "Never commit .env files or paste your Expo/GitHub tokens into public chats, screenshots, or code files.",
        "If leaked → immediately revoke on expo.dev/settings/access-tokens or github.com/settings/tokens.",
        color=MAGENTA,
    ))

    story.append(H3("1.6  Verify everything works"))
    story.append(code_block(
        "node --version         # v20.x or higher\n"
        "yarn --version         # 1.22 or 4.x\n"
        "git --version          # 2.x\n"
        "npx eas-cli whoami     # prints your Expo username"
    ))

    story.append(PageBreak())

    # ============================================================
    # PART 2 — DAILY LOOP
    # ============================================================
    story.append(H1("Part 2 — Daily Loop: Push a Change"))
    story.append(P("The 3-step loop after you edit any React Native code in VS Code:",
                   color=MUTED, space=6))

    story.append(H2("Step 1 — Commit & push code to GitHub"))
    story.append(H3("Option A — Visual Studio (GUI, easiest)"))
    story.append(P("1. Open the <b>Git Changes</b> panel (View → Git Changes)<br/>"
                   "2. Type a commit message at the top<br/>"
                   "3. Click <b>Commit All</b> → then click the blue up-arrow <b>Push</b>"))

    story.append(H3("Option B — PowerShell terminal"))
    story.append(code_block(
        "cd C:\\Users\\kenya\\source\\repos\\quantum-tv\n"
        "git add .\n"
        "git commit -m \"describe what you changed\"\n"
        "git push"
    ))

    story.append(H2("Step 2 — Push OTA to Fire TV via Expo"))
    story.append(code_block(
        "cd C:\\Users\\kenya\\source\\repos\\quantum-tv\\mobile\n"
        "npx eas-cli update --branch firetv --message \"describe what you changed\""
    ))
    story.append(P("Takes ~2 minutes. You'll see:"))
    story.append(code_block(
        "OK Published!\n"
        "Branch     firetv\n"
        "Update ID  019f7ab4-f6ec-7e36-99b3-5c7e38aa47dd"
    ))

    story.append(H2("Step 3 — Install on Fire TV"))
    story.append(P("Open the Fire TV app. The cyan <b>'Update Available'</b> toast pops up in "
                   "the top-right within a few seconds → click <b>Install</b> → the app reloads "
                   "with your new code."))

    story.append(callout(
        "SHORTCUT",
        "Full copy-paste one-shot loop:",
        "cd C:\\Users\\kenya\\source\\repos\\quantum-tv ; git add . ; "
        "git commit -m \"msg\" ; git push ; cd mobile ; "
        "npx eas-cli update --branch firetv --message \"msg\"",
        color=CYAN,
    ))

    story.append(PageBreak())

    # ============================================================
    # PART 3 — BACKEND / WEB REDEPLOY
    # ============================================================
    story.append(H1("Part 3 — Backend / Web Redeploy (Emergent)"))
    story.append(P(
        "For changes in <b>/app/backend/</b> (Python FastAPI) or <b>/app/frontend/</b> (React web admin) — "
        "these need Emergent to redeploy the server. Fire TV OTA does NOT help.",
        color=MUTED, space=6,
    ))

    story.append(H3("3.1  Push code to GitHub first"))
    story.append(P("Same Step 1 as above — commit & push."))

    story.append(H3("3.2  Pull the updated repo into Emergent"))
    story.append(P("1. Open your Emergent chat<br/>"
                   "2. Click the <b>GitHub icon</b> next to the message input<br/>"
                   "3. Select your quantum-tv repository — it imports into the workspace"))

    story.append(H3("3.3  Redeploy"))
    story.append(P("Tell the Emergent agent: <b>&quot;redeploy production&quot;</b><br/>"
                   "Or click the top-right <b>Deploy</b> button and select your existing slot."))

    story.append(callout(
        "COST",
        "Redeploying an existing slot = 0 extra ECU. First-time deploy = 50 ECU (one-time).",
        "Rollback to a previous deploy is also free.",
        color=CYAN,
    ))

    story.append(H3("3.4  Verify"))
    story.append(code_block(
        "# In PowerShell — test the deployed backend\n"
        "curl https://quantumtv.app/api/livetv/channels"
    ))

    story.append(Spacer(1, 0.15 * inch))

    # ============================================================
    # PART 4 — FULL APK REBUILD (rare)
    # ============================================================
    story.append(H1("Part 4 — Full APK Rebuild"))
    story.append(P("Only needed when you add a native dependency, change app.json version, or "
                   "modify android permissions. Takes ~30-60 min on Expo's cloud builders.",
                   color=MUTED, space=6))

    story.append(H3("4.1  Bump the version if user-facing"))
    story.append(P("Edit <b>mobile/app.json</b>:"))
    story.append(code_block(
        '{\n'
        '  "expo": {\n'
        '    "version": "1.0.14",      // bump this\n'
        '    "android": {\n'
        '      "versionCode": 19       // bump this too\n'
        '    }\n'
        '  }\n'
        '}'
    ))

    story.append(H3("4.2  Trigger the build"))
    story.append(code_block(
        "cd C:\\Users\\kenya\\source\\repos\\quantum-tv\\mobile\n"
        "npx eas-cli build --platform android --profile production"
    ))

    story.append(H3("4.3  Wait for the download link"))
    story.append(P("Expo will email you a URL to the .apk file when the build finishes. "
                   "Download it, then re-upload it to your Emergent backend via the "
                   "<b>Admin → Fire TV</b> page so users can grab it from Downloader."))

    story.append(PageBreak())

    # ============================================================
    # PART 5 — LM STUDIO + GITHUB MCP
    # ============================================================
    story.append(H1("Part 5 — LM Studio + GitHub MCP"))
    story.append(P(
        "Let your local AI (running on your CPU) read and edit your Quantum TV repo.",
        color=MUTED, space=6,
    ))

    story.append(H3("5.1  Generate a GitHub Personal Access Token"))
    story.append(code_block("https://github.com/settings/tokens?type=beta"))
    story.append(P("Create a <b>fine-grained token</b>:<br/>"
                   "• <b>Name:</b> LM Studio Quantum TV<br/>"
                   "• <b>Expiration:</b> 90 days<br/>"
                   "• <b>Repository access:</b> select your quantum-tv repo only<br/>"
                   "• <b>Permissions:</b> Contents, Pull requests, Issues → Read &amp; write"))

    story.append(H3("5.2  Paste the token into LM Studio"))
    story.append(P("Open LM Studio → <b>Connected Apps → GitHub</b>:<br/>"
                   "• Authentication: <b>Access token</b><br/>"
                   "• Paste the <b>github_pat_...</b> string<br/>"
                   "• Click <b>Connect</b>"))

    story.append(callout(
        "CAUTION",
        "The Expo token is NOT a GitHub token.",
        "Expo tokens go in PowerShell (for eas-cli). GitHub tokens go in LM Studio. Never swap them.",
        color=MAGENTA,
    ))

    # ============================================================
    # PART 6 — TROUBLESHOOTING
    # ============================================================
    story.append(H1("Part 6 — Troubleshooting"))

    story.append(table_grid([
        ["Error", "Fix"],
        ["yarn : term not recognized",
         "npm install -g yarn (after installing Node.js). Then close + reopen PowerShell."],
        ["git : term not recognized",
         "Install Git for Windows OR use Visual Studio's Git Changes panel instead."],
        ["EXPO_TOKEN not set",
         "Run: [Environment]::SetEnvironmentVariable(\"EXPO_TOKEN\",\"...\",\"User\") — then reopen PowerShell."],
        ["eas update — Not logged in",
         "$env:EXPO_TOKEN before running eas-cli, or run 'npx eas-cli login'."],
        ["Fire TV app doesn't pick up OTA",
         "Force-close & reopen the app. OTAs only reach the SAME runtimeVersion (1.0.13 right now)."],
        ["'Property Image does not exist'",
         "Missing 'import { Image } from \"react-native\"' in a screen file. Add the import + push OTA."],
        ["Metro bundler hangs",
         "npx expo start --clear   (clears cache)"],
        ["ECU going down fast",
         "Only use Emergent for backend redeploys. Do UI edits locally in VS Code + eas update."],
    ], col_widths=[2.4 * inch, 4.5 * inch]))

    story.append(Spacer(1, 0.2 * inch))

    # ============================================================
    # PART 7 — KEY URLS & CREDENTIALS REFERENCE
    # ============================================================
    story.append(H1("Part 7 — Key URLs Reference"))
    story.append(table_grid([
        ["What", "URL"],
        ["Production API", "https://quantumtv.app"],
        ["APK downloader (Fire TV)", "https://quantumtv.app/api/q"],
        ["Emergent preview", "https://tv-ui-staging-1.preview.emergentagent.com"],
        ["Expo dashboard", "https://expo.dev/accounts/kenyanm/projects/quantum-tv"],
        ["Expo access tokens", "https://expo.dev/settings/access-tokens"],
        ["GitHub tokens (fine-grained)", "https://github.com/settings/tokens?type=beta"],
        ["Node.js download", "https://nodejs.org/en/download"],
        ["Git for Windows", "https://git-scm.com/download/win"],
    ], col_widths=[2.2 * inch, 4.7 * inch]))

    story.append(Spacer(1, 0.15 * inch))
    story.append(H2("Admin credentials (dev / test only)"))
    story.append(code_block(
        "Admin login:  admin / Quantum2024\n"
        "Test user:    test  / Test12345"
    ))

    story.append(Spacer(1, 0.3 * inch))
    story.append(P(
        "&#9829; Built for Quantum TV. Print this out, tape it to your monitor.",
        color=MUTED, size=9, space=0,
    ))

    doc.build(story, onFirstPage=draw_frame, onLaterPages=draw_frame)
    print(f"OK Wrote {OUT}")
    print(f"   Size: {OUT.stat().st_size / 1024:.1f} KB")


if __name__ == "__main__":
    build()
