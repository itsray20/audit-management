"""
Format Audit_Analysis_Report_8 (1).doc with:
- Times New Roman font throughout
- LaTeX-style professional layout (deep blue headings, colored table headers, etc.)
- Proper paragraph alignment and spacing
"""

import win32com.client as win32
import os
import sys

DOC_PATH = r"e:\STOCK-MANAGEMENT\Audit_Analysis_Report_8 (1).doc"
OUT_PATH = r"e:\STOCK-MANAGEMENT\Audit_Analysis_Report_8_Formatted.docx"

# LaTeX-inspired color palette (RGB as Word long integers)
def rgb(r, g, b):
    return r + (g * 256) + (b * 256 * 256)

COLORS = {
    "heading1_bg":  rgb(0,  70,  127),   # Deep navy blue
    "heading2_bg":  rgb(0, 112, 192),    # Royal blue
    "heading3_bg":  rgb(68, 114, 196),   # Medium blue
    "heading1_fg":  rgb(255, 255, 255),  # White
    "heading2_fg":  rgb(255, 255, 255),  # White
    "heading3_fg":  rgb(255, 255, 255),  # White
    "table_hdr_bg": rgb(0,  70,  127),   # Navy
    "table_hdr_fg": rgb(255, 255, 255),  # White
    "table_alt_bg": rgb(217, 226, 243),  # Light blue alternate row
    "table_border": rgb(0,  70,  127),   # Navy border
    "accent_red":   rgb(192,  0,  0),    # Deep red for warnings
    "accent_green": rgb(0, 128,  0),     # Green for positive
    "body_text":    rgb(31,  31,  31),   # Near-black body
    "white":        rgb(255, 255, 255),
    "black":        rgb(0, 0, 0),
}

wdColorAutomatic = -16777216
wdAlignParagraphLeft = 0
wdAlignParagraphCenter = 1
wdAlignParagraphRight = 2
wdAlignParagraphJustify = 3

wdHeading1 = -2
wdHeading2 = -3
wdHeading3 = -4

def set_font(font_obj, name="Times New Roman", size=None, bold=None, italic=None, color=None):
    font_obj.Name = name
    if size is not None:
        font_obj.Size = size
    if bold is not None:
        font_obj.Bold = bold
    if italic is not None:
        font_obj.Italic = italic
    if color is not None:
        font_obj.Color = color

def format_doc():
    word = win32.Dispatch("Word.Application")
    word.Visible = False

    try:
        doc = word.Documents.Open(DOC_PATH)

        # ── 1. Set default body font ──────────────────────────────────────────
        doc.Styles("Normal").Font.Name = "Times New Roman"
        doc.Styles("Normal").Font.Size = 12
        doc.Styles("Normal").Font.Color = COLORS["body_text"]
        doc.Styles("Normal").ParagraphFormat.Alignment = wdAlignParagraphJustify
        doc.Styles("Normal").ParagraphFormat.SpaceAfter = 6
        doc.Styles("Normal").ParagraphFormat.SpaceBefore = 0
        doc.Styles("Normal").ParagraphFormat.LineSpacingRule = 0  # single
        doc.Styles("Normal").ParagraphFormat.LineSpacing = 14

        # ── 2. Style Heading 1 (LaTeX \section style) ─────────────────────────
        try:
            h1 = doc.Styles("Heading 1")
            h1.Font.Name = "Times New Roman"
            h1.Font.Size = 16
            h1.Font.Bold = True
            h1.Font.Color = COLORS["heading1_fg"]
            h1.ParagraphFormat.Alignment = wdAlignParagraphLeft
            h1.ParagraphFormat.SpaceBefore = 14
            h1.ParagraphFormat.SpaceAfter = 8
            h1.ParagraphFormat.Shading.BackgroundPatternColor = COLORS["heading1_bg"]
            h1.ParagraphFormat.LeftIndent = 0
        except Exception as e:
            print(f"Heading 1 style warning: {e}")

        # ── 3. Style Heading 2 ────────────────────────────────────────────────
        try:
            h2 = doc.Styles("Heading 2")
            h2.Font.Name = "Times New Roman"
            h2.Font.Size = 14
            h2.Font.Bold = True
            h2.Font.Color = COLORS["heading2_fg"]
            h2.ParagraphFormat.Alignment = wdAlignParagraphLeft
            h2.ParagraphFormat.SpaceBefore = 10
            h2.ParagraphFormat.SpaceAfter = 6
            h2.ParagraphFormat.Shading.BackgroundPatternColor = COLORS["heading2_bg"]
        except Exception as e:
            print(f"Heading 2 style warning: {e}")

        # ── 4. Style Heading 3 ────────────────────────────────────────────────
        try:
            h3 = doc.Styles("Heading 3")
            h3.Font.Name = "Times New Roman"
            h3.Font.Size = 13
            h3.Font.Bold = True
            h3.Font.Italic = False
            h3.Font.Color = COLORS["heading3_fg"]
            h3.ParagraphFormat.Alignment = wdAlignParagraphLeft
            h3.ParagraphFormat.SpaceBefore = 8
            h3.ParagraphFormat.SpaceAfter = 4
            h3.ParagraphFormat.Shading.BackgroundPatternColor = COLORS["heading3_bg"]
        except Exception as e:
            print(f"Heading 3 style warning: {e}")

        # ── 5. Apply Times New Roman to ALL paragraphs ────────────────────────
        print(f"Processing {doc.Paragraphs.Count} paragraphs...")
        for i, para in enumerate(doc.Paragraphs):
            try:
                # Set font for entire paragraph
                para.Range.Font.Name = "Times New Roman"

                style_name = para.Style.NameLocal.strip()
                text = para.Range.Text.strip()

                # Body paragraphs: justify + proper spacing
                if style_name in ("Normal", "Body Text", "Default", ""):
                    para.Format.Alignment = wdAlignParagraphJustify
                    para.Format.SpaceAfter = 6
                    para.Format.SpaceBefore = 0
                    para.Range.Font.Size = 12
                    para.Range.Font.Color = COLORS["body_text"]

                # Lists: left align
                elif "List" in style_name:
                    para.Format.Alignment = wdAlignParagraphLeft
                    para.Range.Font.Size = 11
                    para.Range.Font.Color = COLORS["body_text"]

            except Exception as e:
                pass  # skip any protected paragraphs

        # ── 6. Format ALL tables ──────────────────────────────────────────────
        print(f"Processing {doc.Tables.Count} tables...")
        wdLineStyleSingle = 1
        wdBorderTop = -1
        wdBorderBottom = -2
        wdBorderLeft = -3
        wdBorderRight = -4
        wdBorderInsideH = -5
        wdBorderInsideV = -6

        for tbl_idx in range(1, doc.Tables.Count + 1):
            try:
                tbl = doc.Tables(tbl_idx)
                tbl.Style = "Table Grid"

                # Style each row
                for row_idx in range(1, tbl.Rows.Count + 1):
                    row = tbl.Rows(row_idx)
                    is_header = (row_idx == 1)
                    is_alt = (row_idx % 2 == 0)

                    for col_idx in range(1, tbl.Columns.Count + 1):
                        try:
                            cell = tbl.Cell(row_idx, col_idx)
                            cell_range = cell.Range

                            # Font
                            cell_range.Font.Name = "Times New Roman"

                            if is_header:
                                cell_range.Font.Size = 11
                                cell_range.Font.Bold = True
                                cell_range.Font.Color = COLORS["white"]
                                cell.Shading.BackgroundPatternColor = COLORS["table_hdr_bg"]
                                cell_range.ParagraphFormat.Alignment = wdAlignParagraphCenter
                            else:
                                cell_range.Font.Size = 10
                                cell_range.Font.Bold = False
                                cell_range.Font.Color = COLORS["body_text"]
                                cell.Shading.BackgroundPatternColor = (
                                    COLORS["table_alt_bg"] if is_alt else COLORS["white"]
                                )
                                # Numbers right-align, text left-align
                                txt = cell_range.Text.strip()
                                if txt and (txt.replace('.','').replace('-','').replace(',','').replace('%','').replace('₹','').isdigit()):
                                    cell_range.ParagraphFormat.Alignment = wdAlignParagraphRight
                                else:
                                    cell_range.ParagraphFormat.Alignment = wdAlignParagraphLeft

                            # Cell padding
                            cell.TopPadding = 3
                            cell.BottomPadding = 3
                            cell.LeftPadding = 5
                            cell.RightPadding = 5

                        except Exception as ce:
                            pass

                # Table borders - navy
                for border_const in [wdBorderTop, wdBorderBottom, wdBorderLeft,
                                     wdBorderRight, wdBorderInsideH, wdBorderInsideV]:
                    try:
                        border = tbl.Borders(border_const)
                        border.LineStyle = wdLineStyleSingle
                        border.LineWidth = 8   # 0.5pt
                        border.Color = COLORS["table_border"]
                    except:
                        pass

            except Exception as te:
                print(f"Table {tbl_idx} error: {te}")

        # -- 7. Document margins (LaTeX-ish: 2.5cm sides = ~71pt, 2.5cm top/bottom) ---
        try:
            sec = doc.Sections(1)
            pts_2_5cm = 71  # ~2.5cm in points
            sec.PageSetup.LeftMargin   = pts_2_5cm
            sec.PageSetup.RightMargin  = pts_2_5cm
            sec.PageSetup.TopMargin    = pts_2_5cm
            sec.PageSetup.BottomMargin = pts_2_5cm
        except Exception as e:
            print("Margin error: " + str(e))

        # ── 8. Save as .docx ─────────────────────────────────────────────────
        wdFormatXMLDocument = 12  # .docx
        doc.SaveAs2(OUT_PATH, FileFormat=wdFormatXMLDocument)
        doc.Close(False)
        print("DONE: Saved to " + OUT_PATH)

    except Exception as ex:
        print("ERROR: " + str(ex))
        import traceback
        traceback.print_exc()
    finally:
        word.Quit()

if __name__ == "__main__":
    format_doc()
