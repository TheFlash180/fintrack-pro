// Client-side PDF text extraction with pdf.js. Zero-cost constraint: this is
// deterministic code, no AI/API calls. Returns the document as visual lines
// (text items grouped by vertical position) for statementParse.ts.

import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

interface Positioned {
  str: string;
  x: number;
  y: number;
}

export async function extractPdfLines(file: File): Promise<string[]> {
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const lines: string[] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();

    const items: Positioned[] = [];
    for (const item of content.items) {
      if (!('str' in item) || item.str.trim() === '') continue;
      items.push({ str: item.str, x: item.transform[4], y: item.transform[5] });
    }

    // Group items into visual lines: same y (within tolerance), sorted by x.
    items.sort((a, b) => b.y - a.y || a.x - b.x);
    let currentY: number | null = null;
    let current: Positioned[] = [];
    const flush = () => {
      if (current.length > 0) {
        current.sort((a, b) => a.x - b.x);
        lines.push(current.map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim());
      }
      current = [];
    };
    for (const item of items) {
      if (currentY === null || Math.abs(item.y - currentY) > 3) {
        flush();
        currentY = item.y;
      }
      current.push(item);
    }
    flush();
  }

  await doc.destroy();
  return lines;
}
