/**
 * Print Helper Utility
 * Uses an isolated hidden iframe to print ONLY the document contents.
 * Guarantees zero web UI leaks (no modal frames, no buttons, no scrollbars, no toasts, no dashboard background).
 */

export function printElementById(
  elementId: string, 
  title: string = "เอกสารพิมพ์", 
  orientation: "portrait" | "landscape" = "portrait"
) {
  const sourceEl = document.getElementById(elementId);
  if (!sourceEl) {
    console.warn(`Print element #${elementId} not found, falling back to window.print()`);
    window.print();
    return;
  }

  printHtml(sourceEl.innerHTML, title, orientation);
}

export function printHtml(
  htmlContent: string, 
  title: string = "เอกสารพิมพ์", 
  orientation: "portrait" | "landscape" = "portrait"
) {
  // 1. Remove existing print iframe if present
  const oldIframe = document.getElementById("__clean_print_iframe__");
  if (oldIframe) {
    oldIframe.remove();
  }

  // 2. Create isolated hidden iframe
  const iframe = document.createElement("iframe");
  iframe.id = "__clean_print_iframe__";
  iframe.setAttribute("style", "position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:0;visibility:hidden;");
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    window.print();
    return;
  }

  // 3. Populate iframe document with dedicated A4 print stylesheet & content
  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html lang="th">
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Prompt:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400;1,600&display=swap" rel="stylesheet">
      <style>
        @page {
          size: A4 ${orientation};
          margin: 12mm 10mm 12mm 10mm;
        }

        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        html, body {
          margin: 0;
          padding: 0;
          background-color: #ffffff;
          color: #0f172a;
          font-family: "Prompt", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          font-size: 9.5pt;
          line-height: 1.4;
          width: 100%;
        }

        /* Document Header */
        .border-b-2 { border-bottom: 2px solid #0f172a; }
        .border-t { border-top: 1px solid #cbd5e1; }
        .border-b { border-bottom: 1px solid #cbd5e1; }
        .pb-4 { padding-bottom: 12px; }
        .pt-3 { padding-top: 8px; }
        .mt-4 { margin-top: 12px; }
        .mb-4 { margin-bottom: 12px; }
        .mb-6 { margin-bottom: 16px; }

        /* Typography */
        h1, h2, h3, h4 { margin: 0; color: #0f172a; }
        .text-xl { font-size: 14pt; }
        .text-2xl { font-size: 16pt; }
        .text-sm { font-size: 9.5pt; }
        .text-xs { font-size: 8.5pt; }
        .text-\\[10px\\], .text-\\[11px\\] { font-size: 7.5pt; }
        .font-black, .font-extrabold { font-weight: 800; }
        .font-bold { font-weight: 700; }
        .font-semibold { font-weight: 600; }
        .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
        .uppercase { text-transform: uppercase; }

        /* Alignment */
        .text-left { text-align: left; }
        .text-center { text-align: center; }
        .text-right { text-align: right; }

        /* Text colors */
        .text-slate-900 { color: #0f172a; }
        .text-slate-800 { color: #1e293b; }
        .text-slate-700 { color: #334155; }
        .text-slate-600 { color: #475569; }
        .text-slate-500 { color: #64748b; }
        .text-slate-400 { color: #94a3b8; }
        .text-rose-600, .text-rose-700 { color: #b91c1c; }
        .text-amber-600, .text-amber-800 { color: #b45309; }
        .text-emerald-700, .text-emerald-800, .text-emerald-900 { color: #065f46; }

        /* Background colors */
        .bg-slate-100 { background-color: #f1f5f9; }
        .bg-slate-50 { background-color: #f8fafc; }
        .bg-emerald-50 { background-color: #ecfdf5; }
        .bg-rose-50 { background-color: #fff1f2; }
        .bg-amber-50 { background-color: #fffbeb; }

        /* Flex & Layout */
        .flex { display: flex; }
        .justify-between { justify-content: space-between; }
        .items-center { align-items: center; }
        .items-start { align-items: flex-start; }
        .gap-2 { gap: 6px; }
        .gap-3 { gap: 10px; }
        .gap-4 { gap: 14px; }
        .gap-6 { gap: 20px; }

        .grid { display: flex; justify-content: space-between; flex-wrap: wrap; }
        .grid-cols-2 > * { width: 48%; }
        .grid-cols-3 > * { width: 31%; }
        .grid-cols-4 > * { width: 23%; }

        /* Table Formatting */
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
          margin-bottom: 14px;
          page-break-inside: auto;
        }

        tr {
          page-break-inside: avoid;
          page-break-after: auto;
        }

        thead {
          display: table-header-group;
        }

        tfoot {
          display: table-footer-group;
        }

        th, td {
          border: 1px solid #475569;
          padding: 5px 6px;
          font-size: 8.5pt;
          vertical-align: middle;
        }

        th {
          background-color: #f1f5f9;
          color: #0f172a;
          font-weight: 700;
        }

        /* Checklist boxes */
        .checklist-box {
          display: inline-block;
          width: 48px;
          height: 18px;
          border: 1px solid #94a3b8;
          border-radius: 3px;
          background: #fff;
        }

        /* Signatures Section */
        .signatures-grid {
          display: flex;
          justify-content: space-between;
          margin-top: 25px;
          padding-top: 15px;
          border-top: 1px solid #cbd5e1;
          page-break-inside: avoid;
        }

        .sig-col {
          width: 30%;
          text-align: center;
          font-size: 8.5pt;
        }

        .sig-line {
          border-bottom: 1px solid #475569;
          height: 35px;
          width: 140px;
          margin: 0 auto 6px auto;
        }

        img {
          max-width: 28px;
          max-height: 28px;
          object-fit: cover;
          border-radius: 3px;
          display: block;
          margin: 0 auto;
        }

        /* Hide anything non-printable that might get cloned */
        button, input, select, .no-print {
          display: none !important;
        }
      </style>
    </head>
    <body>
      ${htmlContent}
    </body>
    </html>
  `);
  doc.close();

  // 4. Trigger print once content & styles are evaluated
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (err) {
      console.error("Error invoking iframe print:", err);
      window.print();
    }
  }, 250);
}
