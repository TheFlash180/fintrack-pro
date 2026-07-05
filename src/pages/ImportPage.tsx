import { useState } from 'react';
import { categorize } from '../lib/categorize';
import {
  autoMapColumns,
  extractRows,
  parseAmountFlexible,
  parseCsv,
  parseDateFlexible,
  type ColumnMapping,
  type CsvTable,
} from '../lib/csv';
import { existsKey, findExistingHashes, hashDraft, insertDrafts } from '../lib/data';
import { parseStatementLines, type StatementProfile } from '../lib/statementParse';
import type { DraftTx, OwnerKey } from '../lib/types';
import { ReviewTable } from '../components/ReviewTable';

type Source = 'csv' | 'pdf' | 'paste' | 'manual';

const SOURCE_LABEL: Record<Source, string> = {
  csv: 'CSV (FNB)',
  pdf: 'PDF (Capitec)',
  paste: 'Paste',
  manual: 'Manual',
};

export function ImportPage({
  userId,
  defaultOwner,
  onImported,
}: {
  userId: string;
  defaultOwner: OwnerKey;
  onImported: () => void;
}) {
  const [source, setSource] = useState<Source>('csv');
  const [owner, setOwner] = useState<OwnerKey>(defaultOwner);
  const [drafts, setDrafts] = useState<DraftTx[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [result, setResult] = useState('');

  // CSV-specific state for the manual mapping step
  const [pendingCsv, setPendingCsv] = useState<CsvTable | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({ date: 0, description: 1, amount: 2 });

  const toDrafts = (
    rows: { tx_date: string; description: string; amount: number }[],
    forOwner: OwnerKey,
  ): DraftTx[] =>
    rows.map((r) => ({
      ...r,
      category: categorize(r.description),
      owner_key: forOwner,
    }));

  const startReview = async (newDrafts: DraftTx[], note: string) => {
    if (newDrafts.length === 0) {
      setStatus(`${note} — but no transaction rows were recognised. Try the Paste tab as a fallback.`);
      return;
    }
    setStatus(`${note} Checking for rows you've imported before…`);
    const existing = await findExistingHashes(newDrafts);
    const flagged = await Promise.all(
      newDrafts.map(async (d) => ({
        ...d,
        duplicate: existing.has(existsKey(d.owner_key, await hashDraft(d))),
      })),
    );
    const dupCount = flagged.filter((d) => d.duplicate).length;
    setStatus(
      `${note} ${flagged.length} row(s) ready to review` +
        (dupCount > 0 ? ` — ${dupCount} look already imported and will be skipped.` : '.'),
    );
    setDrafts(flagged);
    setResult('');
  };

  // ---------------- source handlers ----------------

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
        toDrafts(ok, owner),
        `Parsed ${ok.length} rows${skipped > 0 ? ` (${skipped} skipped)` : ''}.`,
      );
    } else {
      setPendingCsv(table);
      setStatus('Columns not recognised automatically — map them below.');
    }
  };

  const applyManualMapping = async () => {
    if (!pendingCsv) return;
    const { ok, skipped } = extractRows(pendingCsv, mapping);
    setPendingCsv(null);
    await startReview(
      toDrafts(ok, owner),
      `Parsed ${ok.length} rows${skipped > 0 ? ` (${skipped} skipped)` : ''}.`,
    );
  };

  const [pdfProfile, setPdfProfile] = useState<StatementProfile>('capitec');
  const handlePdfFile = async (file: File) => {
    setBusy(true);
    setStatus('Extracting text from the PDF…');
    try {
      const { extractPdfLines } = await import('../lib/pdfExtract');
      const lines = await extractPdfLines(file);
      const rows = parseStatementLines(lines, pdfProfile);
      await startReview(
        toDrafts(
          rows.map(({ tx_date, description, amount }) => ({ tx_date, description, amount })),
          owner,
        ),
        `Parsed ${rows.length} rows from the ${pdfProfile} statement.`,
      );
    } catch {
      setStatus('Could not read that PDF. Try the Paste tab as a fallback.');
    }
    setBusy(false);
  };

  const [pasteText, setPasteText] = useState('');
  const handlePaste = async () => {
    const text = pasteText.trim();
    if (!text) return;
    // JSON array of {date|tx_date, description, amount} — or CSV with headers.
    if (text.startsWith('[') || text.startsWith('{')) {
      try {
        const raw = JSON.parse(text.startsWith('{') ? `[${text}]` : text) as Record<string, unknown>[];
        const rows = raw
          .map((r) => {
            const date = parseDateFlexible(String(r.tx_date ?? r.date ?? ''));
            const amount =
              typeof r.amount === 'number' ? r.amount : parseAmountFlexible(String(r.amount ?? ''));
            if (!date || amount === null) return null;
            return {
              tx_date: date,
              description: String(r.description ?? ''),
              amount,
            };
          })
          .filter((r): r is NonNullable<typeof r> => r !== null);
        await startReview(toDrafts(rows, owner), `Parsed ${rows.length} JSON rows.`);
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
        toDrafts(ok, owner),
        `Parsed ${ok.length} rows${skipped > 0 ? ` (${skipped} skipped)` : ''}.`,
      );
    }
  };

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

  // ---------------- confirm ----------------

  const confirm = async () => {
    if (!drafts) return;
    const toSave = drafts.filter((d) => !d.duplicate && d.description.trim() !== '' && d.amount !== 0);
    setBusy(true);
    const sourceName = source === 'manual' ? 'manual' : source;
    const { inserted, error } = await insertDrafts(toSave, sourceName, userId);
    setBusy(false);
    if (error) {
      setStatus(`Save failed: ${error}`);
      return;
    }
    const skipped = drafts.length - toSave.length;
    setResult(
      `✅ Imported ${inserted} transaction(s)` +
        (skipped > 0 ? `, skipped ${skipped} (duplicates or empty)` : '') +
        '. They are live on the dashboards.',
    );
    setDrafts(null);
    setStatus('');
    setPasteText('');
    onImported();
  };

  // ---------------- render ----------------

  return (
    <div>
      <div className="page-head">
        <h1>
          <span className="tint">Import</span> transactions
        </h1>
      </div>

      {result && <div className="notice" style={{ color: 'var(--accent)' }}>{result}</div>}

      {!drafts && (
        <>
          <div className="import-tabs">
            {(Object.keys(SOURCE_LABEL) as Source[]).map((s) => (
              <button
                key={s}
                className={source === s ? 'active' : ''}
                onClick={() => {
                  setSource(s);
                  setStatus('');
                  setPendingCsv(null);
                }}
              >
                {SOURCE_LABEL[s]}
              </button>
            ))}
          </div>

          <div className="card">
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--dim)' }}>These belong to</span>
              <select value={owner} onChange={(e) => setOwner(e.target.value as OwnerKey)}>
                <option value="rickus">Rickus</option>
                <option value="anjone">Anjoné</option>
              </select>
            </div>

            {source === 'csv' && (
              <>
                <p className="notice">
                  The recommended path for FNB: online banking → transaction history → export CSV,
                  then upload it here. Columns are matched automatically.
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
                    {(['date', 'description', 'amount'] as const).map((field) => (
                      <div key={field} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                        <span style={{ width: 90, fontSize: '0.8rem' }}>{field}</span>
                        <select
                          value={mapping[field]}
                          onChange={(e) =>
                            setMapping({ ...mapping, [field]: Number(e.target.value) })
                          }
                        >
                          {pendingCsv.headers.map((h, i) => (
                            <option key={i} value={i}>
                              {h || `(column ${i + 1})`}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                    <button className="btn" style={{ marginTop: 6 }} onClick={() => void applyManualMapping()}>
                      Use this mapping
                    </button>
                  </div>
                )}
              </>
            )}

            {source === 'pdf' && (
              <>
                <p className="notice">
                  The path for Capitec (PDF statements only). Parsing happens entirely on this
                  device — the statement never leaves your browser.
                </p>
                <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--dim)' }}>Bank profile</span>
                  <select
                    value={pdfProfile}
                    onChange={(e) => setPdfProfile(e.target.value as StatementProfile)}
                  >
                    <option value="capitec">Capitec</option>
                    <option value="fnb">FNB (best-effort — prefer CSV)</option>
                  </select>
                </div>
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
                  Fallback for anything the parsers don't handle: paste CSV (with a header row) or a
                  JSON array of {'{date, description, amount}'} — e.g. converted via a Claude chat.
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
          </div>
        </>
      )}

      {drafts && (
        <div className="card">
          <h3>Review before saving — nothing is stored yet</h3>
          {status && <p style={{ fontSize: '0.8rem', color: 'var(--dim)', marginBottom: 10 }}>{status}</p>}
          <ReviewTable drafts={drafts} onChange={setDrafts} />
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button className="btn btn-ghost" onClick={() => { setDrafts(null); setStatus(''); }}>
              Discard
            </button>
            <div style={{ flex: 1 }} />
            <button className="btn" disabled={busy || drafts.length === 0} onClick={() => void confirm()}>
              {busy ? 'Saving…' : `Confirm import (${drafts.filter((d) => !d.duplicate).length})`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
