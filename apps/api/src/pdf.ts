import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import type { ChecklistDoc } from "@autoflow/engine";

/** Standard PDF fonts only cover Latin-1/WinAnsi, so anything else is replaced. Builder output is English. */
const safe = (s: string) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/[^\x20-\x7E -ÿ]/g, "?");

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const word of safe(text).split(/\s+/)) {
    const next = cur ? `${cur} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > width && cur) { lines.push(cur); cur = word; } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Renders a printable checklist with tick boxes. Pure function of the document. */
export async function checklistToPdf(c: ChecklistDoc): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 595, H = 842, M = 54, width = W - M * 2;
  let page = pdf.addPage([W, H]);
  let y = H - M;
  const need = (h: number) => { if (y - h < M) { page = pdf.addPage([W, H]); y = H - M; } };
  const text = (s: string, f: PDFFont, size: number, x = M, color = rgb(0.1, 0.1, 0.12), w = width) => {
    for (const line of wrap(s, f, size, w)) { need(size + 4); page.drawText(line, { x, y: y - size, size, font: f, color }); y -= size + 4; }
  };
  text(c.title, bold, 22);
  y -= 4;
  text(`For: ${c.audience}`, font, 10.5, M, rgb(0.4, 0.4, 0.45));
  y -= 4;
  text(c.summary, font, 11);
  y -= 8;
  for (const s of c.sections) {
    need(40); y -= 8;
    text(s.heading, bold, 14);
    y -= 2;
    for (const it of s.items) {
      const lines = wrap(it.text + (it.note ? ` (${it.note})` : ""), font, 11, width - 24);
      need(lines.length * 15 + 4);
      page.drawRectangle({ x: M, y: y - 11, width: 10, height: 10, borderColor: rgb(0.3, 0.3, 0.35), borderWidth: 1 });
      for (const l of lines) { page.drawText(l, { x: M + 20, y: y - 10, size: 11, font, color: rgb(0.1, 0.1, 0.12) }); y -= 15; }
      y -= 3;
    }
  }
  return pdf.save();
}
