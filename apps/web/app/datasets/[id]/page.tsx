"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Nav, TopBar } from "@/components/nav";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { api } from "@/lib/api";
import { ShieldCheck, Columns3, Eye, Table2 } from "lucide-react";

export default function DatasetDetail() {
  const params = useParams() as any;
  const id = params.id;
  const [data, setData] = useState<any>(null);
  const [quality, setQuality] = useState<any>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<"quality" | "columns" | "preview">("quality");
  useEffect(() => {
    if (!id) return;
    api(`/api/v1/datasets/${id}`).then(setData).catch(() => setFailed(true));
    api(`/api/v1/datasets/${id}/quality`).then(setQuality).catch(() => {});
  }, [id]);
  if (failed)
    return (
      <div className="flex min-h-screen flex-col bg-[var(--bg)] lg:flex-row">
        <Nav />
        <main className="flex-1 p-8">
          <div className="max-w-xl rounded-[14px] border border-[color-mix(in_srgb,var(--red-2)_20%,transparent)] bg-[color-mix(in_srgb,var(--red-2)_6%,transparent)] p-5">
            <p className="text-[14px] font-[600] text-[var(--text)]">Dataset not found</p>
            <p className="mt-1 text-[12.5px] text-[var(--muted)]">It may have been deleted, or you may need to sign in.</p>
            <a href="/datasets" className="mt-3 inline-flex text-[12.5px] font-[600] text-[var(--sky)] hover:text-[var(--fg)]">← Back to datasets</a>
          </div>
        </main>
      </div>
    );
  if (!data)
    return (
      <div className="flex min-h-screen flex-col bg-[var(--bg)] lg:flex-row">
        <Nav />
        <main className="flex-1 p-8 text-[var(--muted)]">Loading…</main>
      </div>
    );
  const columns: any[] = Array.isArray(data.columns) ? data.columns : [];
  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)] lg:flex-row">
      <Nav />
      <main className="flex-1 min-w-0">
        <TopBar title={data.name} subtitle={`${data.row_count?.toLocaleString()} rows • ${data.column_count} cols • ${data.status}`} />
        <div className="px-6 lg:px-8 py-6 space-y-6 max-w-[1100px]">
          <div className="flex gap-2">
            {[
              ["quality", "Quality", ShieldCheck],
              ["columns", "Columns", Columns3],
              ["preview", "Lineage", Eye],
            ].map(([k, label, Icon]: any) => (
              <button key={k} onClick={() => setTab(k as any)} className={`btn h-9 px-4 gap-1.5 text-[13px] ${tab === k ? "bg-[var(--text)] text-[var(--bg)]" : "bg-[color-mix(in_srgb,var(--fg)_6%,transparent)] border border-[var(--border)] text-[var(--muted)] hover:bg-[color-mix(in_srgb,var(--fg)_8%,transparent)] hover:text-[var(--text)]"}`} aria-pressed={tab === k}>
                <Icon className="h-4 w-4" aria-hidden="true" /> {label}
              </button>
            ))}
          </div>

          {tab === "quality" && quality && (
            <Card>
              <CardHeader icon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />} title="Data Quality" subtitle={`${quality.score}/100 • Excellent`} />
              <CardBody>
                <div className="flex items-baseline gap-3 mb-6">
                  <span className="text-[48px] font-[800] tracking-[-0.03em] text-[var(--text)]">{quality.score}</span>
                  <span className="text-[13px] text-[var(--subtle)]">Excellent</span>
                </div>
                <div className="space-y-3">
                  {[
                    ["Completeness", quality.completeness],
                    ["Validity", quality.validity],
                    ["Uniqueness", quality.uniqueness],
                    ["Consistency", quality.consistency],
                  ].map(([l, v]: any) => (
                    <div key={l} className="flex items-center gap-3">
                      <span className="w-28 text-[11px] font-[600] tracking-widest uppercase text-[var(--subtle)]">{l}</span>
                      <div className="flex-1 h-2 rounded-full bg-[color-mix(in_srgb,var(--fg)_6%,transparent)] overflow-hidden">
                        <div className="h-full bg-[var(--text)] rounded-full" style={{ width: `${v}%` }} />
                      </div>
                      <span className="w-10 text-right text-[12px] font-[600] mono text-[var(--text)]">{v}%</span>
                    </div>
                  ))}
                </div>
                <details className="mt-6">
                  <summary className="cursor-pointer text-[12px] font-[500] text-[var(--muted)] hover:text-[var(--text)]">View details</summary>
                  <pre className="mt-3 text-[12px] bg-[var(--elevated)] border border-[var(--border)] p-4 rounded-[12px] overflow-auto max-h-[420px] mono text-[var(--muted)]">{JSON.stringify(quality.details, null, 2)}</pre>
                </details>
              </CardBody>
            </Card>
          )}

          {tab === "columns" && (
            <Card>
              <CardHeader icon={<Table2 className="h-4 w-4" aria-hidden="true" />} title="Columns" subtitle={`${columns.length} inferred types`} />
              <div className="overflow-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-left text-[11px] font-[600] tracking-widest uppercase text-[var(--subtle)] border-b border-[var(--border)]">
                      <th className="px-5 py-2.5">Name</th>
                      <th className="py-2.5">Type</th>
                      <th className="py-2.5">Nulls</th>
                      <th className="py-2.5">Uniques</th>
                    </tr>
                  </thead>
                  <tbody>
                    {columns.map((c: any) => (
                      <tr key={c.name} className="border-t border-[var(--border)] hover:bg-[color-mix(in_srgb,var(--fg)_4%,transparent)]">
                        <td className="px-5 py-3 font-[500] text-[var(--text)]">{c.name}</td>
                        <td>
                          <span className="inline-flex text-[11px] font-[600] tracking-wide uppercase bg-[color-mix(in_srgb,var(--fg)_6%,transparent)] border border-[var(--border)] px-2 py-1 rounded-full text-[var(--muted)]">{c.dtype}</span>
                        </td>
                        <td className="mono text-[var(--muted)]">{c.null_count}</td>
                        <td className="mono text-[var(--muted)]">{c.unique_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {tab === "preview" && (
            <Card>
              <CardHeader title="Storage & Lineage" subtitle={`${data.artifact || "artifact"} • validated on upload`} />
              <CardBody>
                <div className="text-[13px] leading-relaxed text-[var(--muted)]">Parquet artifact • validated on upload • <span className="font-[600] text-[var(--text)]">never silently mutated</span>.</div>
              </CardBody>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
