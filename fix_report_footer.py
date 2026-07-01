# -*- coding: utf-8 -*-
"""
Fix report (works on the formatted .docx):
1. Replace "Store Manager / Administrator" -> "Manager"
2. Remove "*** End of Report - Confidential Stock Audit Document ***"
3. Move signature table to the very BOTTOM of the last page
   (using a continuous section break + VerticalAlignment = Bottom)
"""

import win32com.client as win32

SRC = r"e:\STOCK-MANAGEMENT\Audit_Analysis_Report_8_Formatted.docx"
OUT = r"e:\STOCK-MANAGEMENT\Audit_Analysis_Report_8_Formatted.docx"

wdFormatXMLDocument   = 12
wdAlignVerticalBottom = 3   # Page vertical alignment = bottom
wdAlignVerticalTop    = 1
wdBreakSectionContinuous = 3  # Continuous section break

def fix_report():
    word = win32.Dispatch("Word.Application")
    word.Visible = False

    try:
        doc = word.Documents.Open(SRC)

        # ── 1. Find & Replace "Store Manager / Administrator" -> "Manager" ────
        find_replace = doc.Content.Find
        find_replace.ClearFormatting()
        find_replace.Replacement.ClearFormatting()
        find_replace.Execute(
            FindText="Store Manager / Administrator",
            ReplaceWith="Manager",
            Replace=2  # wdReplaceAll
        )
        print("Replaced 'Store Manager / Administrator' with 'Manager'")

        # Also try other variations just in case
        find_replace.Execute(
            FindText="Store Manager/Administrator",
            ReplaceWith="Manager",
            Replace=2
        )

        # ── 2. Delete ALL "End of Report" paragraphs ─────────────────────────
        deleted = 0
        for i in range(doc.Paragraphs.Count, 0, -1):
            try:
                para = doc.Paragraphs(i)
                txt = para.Range.Text.strip()
                if "End of Report" in txt or ("Confidential" in txt and "Audit" in txt and "***" in txt):
                    para.Range.Delete()
                    deleted += 1
                    print("Deleted paragraph: " + txt[:60])
            except:
                pass
        print("Total deleted: " + str(deleted))

        # ── 3. Push signature table to very BOTTOM of last page ───────────────
        # Strategy: Insert a continuous section break BEFORE the last table,
        # then set the vertical alignment of that last section to Bottom.
        total_tables = doc.Tables.Count
        print("Tables in doc: " + str(total_tables))

        if total_tables >= 1:
            sig_table = doc.Tables(total_tables)

            # Step A: Remove any existing large-spacing push paragraphs before the table
            tbl_start = sig_table.Range.Start
            for i in range(doc.Paragraphs.Count, 0, -1):
                try:
                    para = doc.Paragraphs(i)
                    if para.Range.End <= tbl_start:
                        fmt = para.Format
                        if fmt.SpaceBefore > 200 or para.Range.Text.strip() == '':
                            # Remove oversized spacing / blank spacers
                            fmt.SpaceBefore = 0
                except:
                    pass

            # Step B: Find the paragraph/range just before the signature table
            # and insert a Continuous section break there
            try:
                # Get range just before table
                insert_range = doc.Tables(doc.Tables.Count).Range
                insert_range.Collapse(1)  # collapse to start (=before table)

                # Insert continuous section break before the table
                insert_range.InsertBreak(wdBreakSectionContinuous)
                print("Inserted continuous section break before signature table")
            except Exception as e:
                print("Section break insert error: " + str(e))

            # Step C: The signature table is now in the LAST section.
            # Set that section's vertical alignment to Bottom.
            try:
                last_section = doc.Sections(doc.Sections.Count)
                last_section.PageSetup.VerticalAlignment = wdAlignVerticalBottom
                print("Set VerticalAlignment=Bottom for last section")
            except Exception as e:
                print("VerticalAlignment error: " + str(e))

            # Step D: Set all OTHER sections to Top alignment
            for s_idx in range(1, doc.Sections.Count):
                try:
                    doc.Sections(s_idx).PageSetup.VerticalAlignment = wdAlignVerticalTop
                except:
                    pass

        # ── 4. Save ───────────────────────────────────────────────────────────
        doc.SaveAs2(OUT, FileFormat=wdFormatXMLDocument)
        doc.Close(False)
        print("DONE: Saved -> " + OUT)

    except Exception as ex:
        print("ERROR: " + str(ex))
        import traceback
        traceback.print_exc()
    finally:
        word.Quit()

if __name__ == "__main__":
    fix_report()
