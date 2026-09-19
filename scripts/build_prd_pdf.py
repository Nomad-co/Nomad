#!/usr/bin/env python3
"""Build the presentation-ready Nomad PRD PDF from the Markdown source."""

from __future__ import annotations

import html
import re
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    Image,
    KeepTogether,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.platypus.tableofcontents import TableOfContents


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs" / "Nomad_PRD_v2.1.md"
OUTPUT = ROOT / "output" / "pdf" / "Nomad_PRD_v2.1.pdf"
MOCKUPS = [
    (
        "Direction A - Calm Passport",
        "Employee passport, context provenance, connected tools, and one pending decision. Concept with sample data.",
        ROOT / "prototype" / "mockups" / "light-a-calm-passport.png",
    ),
    (
        "Direction B - Decision Inbox",
        "Field-level request detail: proposed value, source, scope, expiration, and approve, edit, or deny. Concept with sample data.",
        ROOT / "prototype" / "mockups" / "light-b-decision-inbox.png",
    ),
    (
        "Direction C - Policy Studio",
        "Enterprise policy ceiling intersected with employee choice, plus a compact evidence view. Concept with sample data.",
        ROOT / "prototype" / "mockups" / "light-c-policy-studio.png",
    ),
]

INK = colors.HexColor("#25262B")
ACCENT = colors.HexColor("#A25B43")
ACCENT_LIGHT = colors.HexColor("#F4E9E2")
SLATE = colors.HexColor("#4A4D55")
MUTED = colors.HexColor("#6B6E76")
LIGHT = colors.HexColor("#F8F6F2")
BORDER = colors.HexColor("#E6E2DC")
WARNING = colors.HexColor("#B45309")


class NomadDocTemplate(BaseDocTemplate):
    def afterFlowable(self, flowable):
        if isinstance(flowable, Paragraph):
            level = getattr(flowable, "toc_level", None)
            if level is not None:
                text = flowable.getPlainText()
                key = f"heading-{self.page}-{abs(hash(text))}"
                self.canv.bookmarkPage(key)
                self.canv.addOutlineEntry(text, key, level=level, closed=False)
                if level == 0:
                    self.notify("TOCEntry", (level, text, self.page, key))


def cover_page(canvas, doc):
    width, height = letter
    canvas.saveState()
    canvas.setFillColor(LIGHT)
    canvas.rect(0, 0, width, height, fill=1, stroke=0)
    canvas.setFillColor(ACCENT_LIGHT)
    canvas.circle(width + 36, height - 70, 180, fill=1, stroke=0)
    canvas.setStrokeColor(colors.HexColor("#DEC9BD"))
    canvas.setLineWidth(1.5)
    canvas.circle(width + 32, height - 64, 128, fill=0, stroke=1)
    canvas.setFillColor(ACCENT)
    canvas.roundRect(48, height - 120, 52, 52, 12, fill=1, stroke=0)
    canvas.setStrokeColor(colors.white)
    canvas.setLineWidth(2.2)
    canvas.line(64, height - 95, 73, height - 104)
    canvas.line(73, height - 104, 86, height - 86)
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 9)
    canvas.drawString(48, 44, "PRODUCT REQUIREMENTS DOCUMENT  /  VERSION 2.1  /  SEPTEMBER 2026")
    canvas.restoreState()


def regular_page(canvas, doc):
    width, height = letter
    canvas.saveState()
    canvas.setFillColor(colors.white)
    canvas.rect(0, 0, width, height, fill=1, stroke=0)
    canvas.setStrokeColor(BORDER)
    canvas.line(48, height - 42, width - 48, height - 42)
    canvas.setFillColor(ACCENT)
    canvas.setFont("Helvetica-Bold", 8)
    canvas.drawString(48, height - 31, "NOMAD")
    canvas.setFillColor(MUTED)
    canvas.setFont("Helvetica", 8)
    canvas.drawRightString(width - 48, height - 31, "ENTERPRISE AI CONTEXT CONTROL PLANE")
    canvas.setStrokeColor(BORDER)
    canvas.line(48, 40, width - 48, 40)
    canvas.setFillColor(MUTED)
    canvas.drawString(48, 27, "Nomad PRD v2.1")
    canvas.drawRightString(width - 48, 27, str(doc.page))
    canvas.restoreState()


def inline_markup(text: str) -> str:
    escaped = html.escape(text.strip())
    escaped = re.sub(r"`([^`]+)`", r'<font name="Courier">\1</font>', escaped)
    escaped = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", escaped)
    url_pattern = re.compile(r"(https?://[^\s<]+)")
    escaped = url_pattern.sub(r'<link href="\1" color="#A25B43"><u>source</u></link>', escaped)
    return escaped


def styles():
    base = getSampleStyleSheet()
    return {
        "cover_kicker": ParagraphStyle(
            "CoverKicker", parent=base["Normal"], fontName="Helvetica-Bold", fontSize=10,
            leading=14, textColor=ACCENT, spaceAfter=16, uppercase=True,
        ),
        "cover_title": ParagraphStyle(
            "CoverTitle", parent=base["Title"], fontName="Helvetica-Bold", fontSize=34,
            leading=39, textColor=INK, spaceAfter=18,
        ),
        "cover_sub": ParagraphStyle(
            "CoverSub", parent=base["Normal"], fontName="Helvetica", fontSize=15,
            leading=22, textColor=SLATE, spaceAfter=24,
        ),
        "h1": ParagraphStyle(
            "Heading1Nomad", parent=base["Heading1"], fontName="Helvetica-Bold", fontSize=19,
            leading=23, textColor=ACCENT, spaceBefore=12, spaceAfter=10, keepWithNext=True,
        ),
        "h2": ParagraphStyle(
            "Heading2Nomad", parent=base["Heading2"], fontName="Helvetica-Bold", fontSize=13.5,
            leading=17, textColor=SLATE, spaceBefore=10, spaceAfter=6, keepWithNext=True,
        ),
        "h3": ParagraphStyle(
            "Heading3Nomad", parent=base["Heading3"], fontName="Helvetica-Bold", fontSize=11,
            leading=14, textColor=ACCENT, spaceBefore=7, spaceAfter=5, keepWithNext=True,
        ),
        "body": ParagraphStyle(
            "BodyNomad", parent=base["BodyText"], fontName="Helvetica", fontSize=9.4,
            leading=13.6, textColor=SLATE, spaceAfter=7,
        ),
        "bullet": ParagraphStyle(
            "BulletNomad", parent=base["BodyText"], fontName="Helvetica", fontSize=9.2,
            leading=13.2, leftIndent=14, firstLineIndent=-8, bulletIndent=4, textColor=SLATE,
            spaceAfter=4,
        ),
        "quote": ParagraphStyle(
            "QuoteNomad", parent=base["BodyText"], fontName="Helvetica-Bold", fontSize=13,
            leading=18, leftIndent=18, rightIndent=18, borderColor=ACCENT, borderWidth=0,
            borderPadding=12, backColor=ACCENT_LIGHT, textColor=INK, spaceBefore=6, spaceAfter=12,
        ),
        "caption": ParagraphStyle(
            "CaptionNomad", parent=base["BodyText"], fontName="Helvetica", fontSize=8.5,
            leading=12, textColor=MUTED, alignment=TA_LEFT, spaceAfter=10,
        ),
        "toc_title": ParagraphStyle(
            "TOCTitle", parent=base["Title"], fontName="Helvetica-Bold", fontSize=25,
            leading=30, textColor=INK, spaceAfter=20,
        ),
    }


def parse_table(lines, style_map):
    rows = []
    for line in lines:
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if all(re.fullmatch(r":?-{3,}:?", cell) for cell in cells):
            continue
        rows.append([Paragraph(inline_markup(cell), style_map["body"]) for cell in cells])
    if not rows:
        return Spacer(1, 1)
    widths = [doc_width / len(rows[0])] * len(rows[0])
    table = Table(rows, colWidths=widths, repeatRows=1, hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), ACCENT_LIGHT),
        ("TEXTCOLOR", (0, 0), (-1, 0), INK),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), .5, BORDER),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT]),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    return table


def markdown_story(text: str, style_map):
    story = []
    lines = text.splitlines()
    index = 0
    while index < len(lines):
        raw = lines[index].rstrip()
        stripped = raw.strip()
        if not stripped:
            index += 1
            continue
        if stripped.startswith("# "):
            index += 1
            continue
        if stripped.startswith("**Version:") or stripped.startswith("**Status:") or stripped.startswith("**Product category:") or stripped.startswith("**Replaces:"):
            meta = []
            while index < len(lines) and lines[index].strip().startswith("**"):
                meta.append(Paragraph(inline_markup(lines[index].strip().rstrip("  ")), style_map["body"]))
                index += 1
            box = Table([[meta]], colWidths=[doc_width])
            box.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
                ("BOX", (0, 0), (-1, -1), .7, BORDER),
                ("LEFTPADDING", (0, 0), (-1, -1), 14),
                ("RIGHTPADDING", (0, 0), (-1, -1), 14),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]))
            story.extend([box, Spacer(1, 12)])
            continue
        if stripped == "## 20. References":
            heading = Paragraph("20. References", style_map["h1"])
            heading.toc_level = 0
            index += 1
            references = []
            while index < len(lines) and (not lines[index].strip() or lines[index].strip().startswith("- ")):
                candidate = lines[index].strip()
                if candidate.startswith("- "):
                    references.append(Paragraph(inline_markup(candidate[2:]), style_map["caption"]))
                index += 1
            rows = []
            for position in range(0, len(references), 2):
                row = references[position:position + 2]
                if len(row) == 1:
                    row.append(Paragraph("", style_map["caption"]))
                rows.append(row)
            reference_table = Table(rows, colWidths=[doc_width / 2, doc_width / 2])
            reference_table.setStyle(TableStyle([
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                ("TOPPADDING", (0, 0), (-1, -1), 2),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ]))
            story.append(KeepTogether([heading, reference_table]))
            continue
        if stripped.startswith("## "):
            heading = Paragraph(inline_markup(stripped[3:]), style_map["h1"])
            heading.toc_level = 0
            story.append(heading)
            index += 1
            continue
        if stripped.startswith("### "):
            heading = Paragraph(inline_markup(stripped[4:]), style_map["h2"])
            heading.toc_level = 1
            story.append(heading)
            index += 1
            continue
        if stripped.startswith("#### "):
            heading = Paragraph(inline_markup(stripped[5:]), style_map["h3"])
            heading.toc_level = 2
            story.append(heading)
            index += 1
            continue
        if stripped.startswith("> "):
            quote_lines = []
            while index < len(lines) and lines[index].strip().startswith("> "):
                quote_lines.append(lines[index].strip()[2:])
                index += 1
            story.append(Paragraph(inline_markup(" ".join(quote_lines)), style_map["quote"]))
            continue
        if stripped.startswith("|"):
            table_lines = []
            while index < len(lines) and lines[index].strip().startswith("|"):
                table_lines.append(lines[index].strip())
                index += 1
            story.extend([parse_table(table_lines, style_map), Spacer(1, 9)])
            continue
        if re.match(r"^[-*] ", stripped):
            while index < len(lines) and re.match(r"^[-*] ", lines[index].strip()):
                item = re.sub(r"^[-*] ", "", lines[index].strip())
                story.append(Paragraph(inline_markup(item), style_map["bullet"], bulletText="-"))
                index += 1
            story.append(Spacer(1, 3))
            continue
        if re.match(r"^\d+\. ", stripped):
            number = 1
            while index < len(lines) and re.match(r"^\d+\. ", lines[index].strip()):
                item = re.sub(r"^\d+\. ", "", lines[index].strip())
                story.append(Paragraph(inline_markup(item), style_map["bullet"], bulletText=f"{number}."))
                number += 1
                index += 1
            story.append(Spacer(1, 3))
            continue
        paragraph_lines = [stripped]
        index += 1
        while index < len(lines):
            candidate = lines[index].strip()
            if not candidate or candidate.startswith(("#", ">", "|", "- ", "* ")) or re.match(r"^\d+\. ", candidate):
                break
            paragraph_lines.append(candidate)
            index += 1
        story.append(Paragraph(inline_markup(" ".join(paragraph_lines)), style_map["body"]))
    return story


def add_mockups(story, style_map):
    story.append(PageBreak())
    heading = Paragraph("Interface directions", style_map["h1"])
    heading.toc_level = 0
    story.append(heading)
    story.append(Paragraph(
        "Three light concepts test different product entry points using sample data. No production interface direction is selected yet; the user will choose a starting direction after review.",
        style_map["body"],
    ))
    for position, (title, caption, path) in enumerate(MOCKUPS):
        if position:
            story.append(PageBreak())
        subheading = Paragraph(title, style_map["h2"])
        subheading.toc_level = 1
        story.append(subheading)
        story.append(Paragraph(caption, style_map["caption"]))
        image = Image(str(path))
        max_width = doc_width
        max_height = 7.2 * inch
        scale = min(max_width / image.imageWidth, max_height / image.imageHeight)
        image.drawWidth = image.imageWidth * scale
        image.drawHeight = image.imageHeight * scale
        image.hAlign = "CENTER"
        story.append(image)
        story.append(Spacer(1, 10))
        if position == 0:
            story.append(Paragraph("Selection pending. This concept prioritizes employee understanding of context and access.", style_map["caption"]))
        elif position == 1:
            story.append(Paragraph("Selection pending. This concept prioritizes clear, reversible consent decisions.", style_map["caption"]))
        else:
            story.append(Paragraph("Selection pending. This concept prioritizes enterprise policy and evidence.", style_map["caption"]))


def build():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    source_text = SOURCE.read_text(encoding="utf-8")
    style_map = styles()
    doc = NomadDocTemplate(
        str(OUTPUT),
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=58,
        bottomMargin=52,
        title="Nomad Product Requirements Document v2.1",
        author="Nomad Product Team",
        subject="Enterprise AI Context Control Plane",
    )
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc_width, letter[1] - doc.topMargin - doc.bottomMargin, id="body")
    doc.addPageTemplates([
        PageTemplate(id="cover", frames=frame, onPage=cover_page),
        PageTemplate(id="content", frames=frame, onPage=regular_page),
    ])

    story = [
        Spacer(1, 1.55 * inch),
        Paragraph("ENTERPRISE AI CONTEXT CONTROL PLANE", style_map["cover_kicker"]),
        Paragraph("Nomad Product Requirements Document", style_map["cover_title"]),
        Paragraph("A governed context layer for people, organizations, and the AI tools they choose.", style_map["cover_sub"]),
        Spacer(1, .35 * inch),
        Table(
            [[Paragraph("VERSION", style_map["caption"]), Paragraph("STATUS", style_map["caption"])],
             [Paragraph("<b>2.1</b>", style_map["cover_sub"]), Paragraph("<b>Market refresh</b><br/>Light interface selection pending", style_map["cover_sub"]) ]],
            colWidths=[1.35 * inch, 3.4 * inch],
            style=TableStyle([
                ("BOX", (0, 0), (-1, -1), .75, BORDER),
                ("INNERGRID", (0, 0), (-1, -1), .5, BORDER),
                ("BACKGROUND", (0, 0), (-1, -1), colors.white),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 12),
                ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                ("TOPPADDING", (0, 0), (-1, -1), 9),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]),
        ),
        NextPageTemplate("content"),
        PageBreak(),
        Paragraph("Contents", style_map["toc_title"]),
    ]

    toc = TableOfContents()
    toc.levelStyles = [
        ParagraphStyle("TOC0", fontName="Helvetica-Bold", fontSize=9.5, leading=16, leftIndent=0, textColor=ACCENT),
        ParagraphStyle("TOC1", fontName="Helvetica", fontSize=8.5, leading=14, leftIndent=16, textColor=SLATE),
        ParagraphStyle("TOC2", fontName="Helvetica", fontSize=8, leading=12, leftIndent=30, textColor=MUTED),
    ]
    story.extend([toc, PageBreak()])
    story.extend(markdown_story(source_text, style_map))
    add_mockups(story, style_map)
    doc.multiBuild(story)


doc_width = letter[0] - 108

if __name__ == "__main__":
    build()
    print(OUTPUT)
