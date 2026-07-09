import { useState } from 'react';
import { categorizeWithHint } from '../lib/categorize';
import {
  autoMapColumns,
  extractRows,
  parseAmountFlexible,
  parseCsv,
  parseDateFlexible,
  type ColumnMapping,
  type CsvTable,
} from '../lib/csv';
import { buildBatchHashes, deleteBatch, existsKey, findExistingHashes, insertDrafts } from '../lib/data';
import { parseStatementLines } from '../lib/statementParse';
import type { DraftTx, OwnerKey } from '../lib/types';
import { ReviewTable } from './ReviewTable';

type RickusSource = 'csv' | 'paste' | 'manual';
type AnjoneSource = 'pdf' | 'paste' | 'manual';

const RICKUS_SOURCES: { key: RickusSource; label: string }[] = [
  { key: 'csv', label: 'CSV' },
  { key: 'paste', label: 'Paste' },
  { key: 'manual', label: 'Manual' },
];

const ANJONE_SOURCES: { key: AnjoneSource; label: string }[] = [
  { key: 'pdf', label: 'PDF' },
  { key: 'paste', label: 'Paste' },
  { key: 'manual', label: 'Manual' },
];

export function ImportSection({
  owner,
  userId,
  onImported,
  categories,
}: {
  owner: OwnerKey;
  userId: string;
  onImported: () => void;
  categories?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<string>(owner === 'rickus' ? 'csv' : 'pdf');
  const [drafts, setDrafts] = useState<DraftTx[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [result, setResult] = useState('');

  const [pendingCsv, setPendingCsv] = useState<CsvTable | null>(null);
  const [mapCols, setMapCols] = useState({
    date: 0,
    description: 1,
    amount: -1,
    moneyIn: -1,
    moneyOut: -1,
    fee: -1,
  });

  const [pasteText, setPasteText] = useState('');
  const [lastImportIds, setLastImportIds] = useState<string[] | null>(null);

  const toDrafts = (
    rows: { tx_date: string; description: string; amount: number; category?: string }[],
  ): DraftTx[] =>
    rows.map((r) => ({
      tx_date: r.tx_date,
      description: r.description,
      amount: r.amount,
      category: categorizeWithHint(r.description, r.category),
      owner_key: owner,
    }));

  const startReview = async (newDrafts: DraftTx[], note: string) => {
    if (newDrafts.length === 0) {
      setStatus(`${note} — but no transaction rows were recognised. Try the Paste tab as a fallback.`);
      return;
    }
    setStatus(`${note} Checking for duplicates…`);
    const existing = await findExistingHashes(newDrafts);
    const batchHashes = await buildBatchHashes(newDrafts);
    const flagged = newDrafts.map((d, i) => ({
      ...d,
      duplicate: existing.has(existsKey(d.owner_key, batchHashes[i])),
    }));
    const dupCount = flagged.filter((d) => d.duplicate).length;
    setStatus(
      `${note} ${flagged.length} row(s) ready to review` +
        (dupCount > 0 ? ` — ${dupCount} already imported and will be skipped.` : '.'),
    );
    setDrafts(flagged);
    setResult('');
  };

  // ---- CSV (Rickus / Capitec) ----

  const handleCsvFile = async (file: File) => {
    const table = parseCsv(await file.text());
    if (table.headers.length === 0) {
      setStatus('That file looks empty.');
      return;
    }
    const auto = autoMapColumns(table.headers);
    if (auto) {
      const { ok, skipped } = extractRows(table, auto);
      await startReview(
        toDrafts(ok),
        `Parsed ${ok.length} rows${skipped > 0 ? ` (${skipped} skipped)` : ''}.`,
      );
    } else {
      const find = (patterns: RegExp[]) =>
        table.headers.findIndex((h) => patterns.some((p) => p.test(h.trim())));
      setMapCols({
        date: Math.max(find([/date/i, /datum/i]), 0),
        description: Math.max(find([/desc/i, /beskrywing/i, /narrative/i]), 0),
        amount: find([/^amount$/i, /^bedrag$/i]),
        moneyIn: find([/money\s?in/i, /geld\s?in/i]),
        moneyOut: find([/money\s?out/i, /geld\s?uit/i]),
        fee: find([/^fee/i, /^fooi/i]),
      });
      setPendingCsv(table);
      setStatus('Columns not recognised automatically — map them below.');
    }
  };

  const mappingValid =
    mapCols.date >= 0 &&
    mapCols.description >= 0 &&
    (mapCols.amount >= 0 || (mapCols.moneyIn >= 0 && mapCols.moneyOut >= 0));

  const splitMode = mapCols.amount < 0;

  const applyManualMapping = async () => {
    if (!pendingCsv || !mappingValid) return;
    const mapping: ColumnMapping = {
      date: mapCols.date,
      description: mapCols.description,
      amount: mapCols.amount >= 0 ? mapCols.amount : null,
      moneyIn: mapCols.moneyIn >= 0 ? mapCols.moneyIn : null,
      moneyOut: mapCols.moneyOut >= 0 ? mapCols.moneyOut : null,
      fee: mapCols.fee >= 0 ? mapCols.fee : null,
      category: null,
    };
    const { ok, skipped } = extractRows(pendingCsv, mapping);
    setPendingCsv(null);
    await startReview(
      toDrafts(ok),
      `Parsed ${ok.length} rows${skipped > 0 ? ` (${skipped} skipped)` : ''}.`,
    );
  };

  // ---- PDF (Anjoné / FNB) ----

  const handlePdfFile = async (file: File) => {
    setBusy(true);
    setStatus('Extracting text from the PDF…');
    try {
      const { extractPdfLines } = await import('../lib/pdfExtract');
      const lines = await extractPdfLines(file);
      const rows = parseStatementLines(lines, 'fnb');
      await startReview(
        toDrafts(rows.map(({ tx_date, description, amount }) => ({ tx_date, description, amount }))),
        `Parsed ${rows.length} rows from the FNB statement.`,
      );
    } catch {
      setStatus('Could not read that PDF. Try the Paste tab as a fallback.');
    }
    setBusy(false);
  };

  // ---- Paste ----

  const handlePaste = async () => {
    const text = pasteText.trim();
    if (!text) return;
    if (text.startsWith('[') || text.startsWith('{')) {
      try {
        const raw = JSON.parse(text.startsWith('{') ? `[${text}]` : text) as Record<string, unknown>[];
        const rows = raw
          .map((r) => {
            const date = parseDateFlexible(String(r.tx_date ?? r.date ?? ''));
            const amount =
              typeof r.amount === 'number' ? r.amount : parseAmountFlexible(String(r.amount ?? ''));
            if (!date || amount === null) return null;
            return { tx_date: date, description: String(r.description ?? ''), amount };
          })
          .filter((r): r is NonNullable<typeof r> => r !== null);
        await startReview(toDrafts(rows), `Parsed ${rows.length} JSON rows.`);
      } catch {
        setStatus("That JSON didn't parse — expected an array of {date, description, amount}.");
      }
    } else {
      const table = parseCsv(text);
      const auto = autoMapColumns(table.headers);
      if (!auto) {
        setStatus('Include a header row (date, description, amount) so columns can be matched.');
        return;
      }
      const { ok, skipped } = extractRows(table, auto);
      await startReview(
        toDrafts(ok),
        `Parsed ${ok.length} rows${skipped > 0 ? ` (${skipped} skipped)` : ''}.`,
      );
    }
  };

  // ---- Manual ----

  const startManual = () => {
    setDrafts([
      {
        tx_date: new Date().toISOString().slice(0, 10),
        description: '',
        amount: 0,
        category: 'Uncategorised',
        owner_key: owner,
      },
    ]);
    setStatus('Fill in the row(s) and confirm.');
  };

  // ---- Confirm ----

  const confirm = async () => {
    if (!drafts) return;
    const toSave = drafts.filter((d) => !d.duplicate && d.description.trim() !== '' && d.amount !== 0);
    setBusy(true);
    const { inserted, ids, error } = await insertDrafts(toSave, source === 'manual' ? 'manual' : source, userId);
    setBusy(false);
    if (error) {
      setStatus(`Save failed: ${error}`);
      return;
    }
    const skipped = drafts.length - toSave.length;
    setLastImportIds(ids);
    setResult(
      `Imported ${inserted} transaction(s)` +
        (skipped > 0 ? `, skipped ${skipped} (duplicates or empty)` : '') +
        '.',
    );
    setDrafts(null);
    setStatus('');
    setPasteText('');
    onImported();
  };

  const undoImport = async () => {
    if (!lastImportIds || lastImportIds.length === 0) return;
    setBusy(true);
    const { deleted, error } = await deleteBatch(lastImportIds);
    setBusy(false);
    if (error) {
      setStatus(`Undo failed: ${error}`);
      return;
    }
    setResult(`Undone — removed ${deleted} transaction(s).`);
    setLastImportIds(null);
    onImported();
  };

  const reset = () => {
    setOpen(false);
    setDrafts(null);
    setStatus('');
    setResult('');
    setPasteText('');
    setPendingCsv(null);
    setLastImportIds(null);
    setSource(owner === 'rickus' ? 'csv' : 'pdf');
  };

  const sources = owner === 'rickus' ? RICKUS_SOURCES : ANJONE_SOURCES;

  if (!open && !result) {
    return (
      <div className="card" style={{ textAlign: 'center' }}>
        <button className="btn" onClick={() => setOpen(true)}>
          Import transactions
        </button>
      </div>
    );
  }

  return (
    <div className="card">
      <h3>
        Import transactions
        {!drafts && (
          <button
            className="btn-ghost btn"
            style={{ float: 'right', padding: '2px 10px', fontSize: '0.7rem' }}
            onClick={reset}
          >
            Close
          </button>
        )}
      </h3>

      {result && (
        <div className="notice" style={{ color: 'var(--accent)' }}>
          {result}
          {lastImportIds && lastImportIds.length > 0 && (
            <button
              className="btn btn-ghost"
              style={{ marginLeft: 12, padding: '4px 12px', fontSize: '0.75rem' }}
              disabled={busy}
              onClick={() => void undoImport()}
            >
              {busy ? 'Undoing…' : 'Undo import'}
            </button>
          )}
        </div>
      )}

      {!drafts && (
        <>
          <div className="import-tabs">
            {sources.map((s) => (
              <button
                key={s.key}
                className={source === s.key ? 'active' : ''}
                onClick={() => {
                  setSource(s.key);
                  setStatus('');
                  setPendingCsv(null);
                }}
              >
                {s.label}
              </button>
            ))}
          </div>

          {source === 'csv' && owner === 'rickus' && (
            <>
              <p className="notice">
                Upload your Capitec CSV export. Columns are matched automatically.
              </p>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleCsvFile(f);
                }}
              />
              {pendingCsv && (
                <div style={{ marginTop: 14 }}>
                  <p style={{ fontSize: '0.8rem', marginBottom: 8 }}>
                    Match the columns ({pendingCsv.headers.join(' · ')}):
                  </p>
                  <ColSelect
                    label="date"
                    value={mapCols.date}
                    headers={pendingCsv.headers}
                    onChange={(v) => setMapCols({ ...mapCols, date: v })}
                  />
                  <ColSelect
                    label="description"
                    value={mapCols.description}
                    headers={pendingCsv.headers}
                    onChange={(v) => setMapCols({ ...mapCols, description: v })}
                  />
                  <div style={{ display: 'flex', gap: 12, margin: '10px 0', fontSize: '0.78rem' }}>
                    <label style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                      <input
                        type="radio"
                        checked={!splitMode}
                        onChange={() =>
                          setMapCols({ ...mapCols, amount: 0, moneyIn: -1, moneyOut: -1, fee: -1 })
                        }
                      />
                      One signed amount column
                    </label>
                    <label style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                      <input
                        type="radio"
                        checked={splitMode}
                        onChange={() => setMapCols({ ...mapCols, amount: -1 })}
                      />
                      Separate money in / money out
                    </label>
                  </div>
                  {!splitMode ? (
                    <ColSelect
                      label="amount"
                      value={mapCols.amount}
                      headers={pendingCsv.headers}
                      onChange={(v) => setMapCols({ ...mapCols, amount: v })}
                    />
                  ) : (
                    <>
                      <ColSelect
                        label="money in"
                        value={mapCols.moneyIn}
                        headers={pendingCsv.headers}
                        onChange={(v) => setMapCols({ ...mapCols, moneyIn: v })}
                      />
                      <ColSelect
                        label="money out"
                        value={mapCols.moneyOut}
                        headers={pendingCsv.headers}
                        onChange={(v) => setMapCols({ ...mapCols, moneyOut: v })}
                      />
                      <ColSelect
                        label="fee (optional)"
                        value={mapCols.fee}
                        headers={pendingCsv.headers}
                        onChange={(v) => setMapCols({ ...mapCols, fee: v })}
                        allowNone
                      />
                    </>
                  )}
                  <button
                    className="btn"
                    style={{ marginTop: 10 }}
                    disabled={!mappingValid}
                    onClick={() => void applyManualMapping()}
                  >
                    Use this mapping
                  </button>
                </div>
              )}
            </>
          )}

          {source === 'pdf' && owner === 'anjone' && (
            <>
              <p className="notice">
                Upload your FNB statement PDF. Parsing happens entirely on this
                device — the statement never leaves your browser.
              </p>
              <input
                type="file"
                accept=".pdf,application/pdf"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handlePdfFile(f);
                }}
              />
            </>
          )}

          {source === 'paste' && (
            <>
              <p className="notice">
                Paste CSV text (with a header row) or a JSON array of {'{date, description, amount}'}.
              </p>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={'date,description,amount\n2026-06-01,Checkers Sandton,-845.50'}
              />
              <button
                className="btn"
                style={{ marginTop: 10 }}
                disabled={!pasteText.trim()}
                onClick={() => void handlePaste()}
              >
                Parse
              </button>
            </>
          )}

          {source === 'manual' && (
            <>
              <p className="notice">Add one or more transactions by hand.</p>
              <button className="btn" onClick={startManual}>
                New transaction
              </button>
            </>
          )}

          {status && <p style={{ fontSize: '0.8rem', color: 'var(--dim)', marginTop: 12 }}>{status}</p>}
        </>
      )}

      {drafts && (
        <>
          <p style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 8 }}>
            Review before saving — nothing is stored yet
          </p>
          {status && <p style={{ fontSize: '0.8rem', color: 'var(--dim)', marginBottom: 10 }}>{status}</p>}
          <ReviewTable drafts={drafts} onChange={setDrafts} categories={categories} />
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button className="btn btn-ghost" onClick={() => { setDrafts(null); setStatus(''); }}>
              Discard
            </button>
            <div style={{ flex: 1 }} />
            <button className="btn" disabled={busy || drafts.length === 0} onClick={() => void confirm()}>
              {busy ? 'Saving…' : `Confirm import (${drafts.filter((d) => !d.duplicate && d.description.trim() !== '' && d.amount !== 0).length})`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ColSelect({
  label,
  value,
  headers,
  onChange,
  allowNone,
}: {
  label: string;
  value: number;
  headers: string[];
  onChange: (v: number) => void;
  allowNone?: boolean;
}) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
      <span style={{ width: 100, fontSize: '0.8rem' }}>{label}</span>
      <select value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {allowNone && <option value={-1}>(none)</option>}
        {headers.map((h, i) => (
          <option key={i} value={i}>
            {h || `(column ${i + 1})`}
          </option>
        ))}
      </select>
    </div>
  );
}
