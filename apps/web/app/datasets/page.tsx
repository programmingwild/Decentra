"use client";
import { useEffect, useState } from "react";
import { Nav } from "@/components/nav";
import { PageHero } from "@/components/ui/page-hero";
import { ShaderAurora } from "@/components/immersive/3d/ShaderAurora";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { api } from "@/lib/api";
import { fmtDateLong } from "@/lib/format";
import { Database, Upload, FileSpreadsheet, Clock, ArrowRight } from "lucide-react";

export default function Datasets() {
  const [orgs, setOrgs] = useState<any[]>([]);
  const [datasets, setDatasets] = useState<any[]>([]);
  const [orgId, setOrgId] = useState("");
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function loadOrgs() {
    const o = await api("/api/v1/organizations");
    setOrgs(o);
    if (o[0]) setOrgId(o[0].id);
  }
  async function loadDatasets() {
    if (!orgId) return;
    const ds = await api(`/api/v1/datasets?org_id=${orgId}`);
    setDatasets(ds);
  }
  useEffect(() => {
    loadOrgs();
  }, []);
  useEffect(() => {
    loadDatasets();
  }, [orgId]);

  async function upload() {
    if (!file || !orgId) {
      setMsg("Select workspace and file");
      return;
    }
    const fd = new FormData();
    fd.append("org_id", orgId);
    if (name) fd.append("name", name);
    fd.append("file", file);
    setUploading(true);
    setMsg("Uploading and profiling…");
    try {
      const r = await api("/api/v1/datasets/upload", { method: "POST", body: fd });
      setMsg(`✓ ${r.dataset.name} — ${r.dataset.row_count.toLocaleString()} rows profiled`);
      setFile(null);
      setName("");
      loadDatasets();
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#08090B] lg:flex-row">
      <Nav />
      <main className="flex-1 min-w-0">
        <div className="relative mx-auto max-w-[1100px] space-y-6 px-5 pb-20 pt-8 lg:px-8 lg:pt-12">
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true"><ShaderAurora className="opacity-[0.22]" speed={0.6} intensity={0.35} mouseInfluence={0.2} /><div className="orb orb-sky h-[300px] w-[340px] -right-[60px] top-[30px] opacity-[0.12]" /></div>
          <PageHero
            kicker="Upload · profile · govern"
            title="Datasets"
            sub="Upload, profile, and govern your data"
            className="relative"
          />
          <Card>
            <CardHeader icon={<Upload className="h-4 w-4" aria-hidden="true" />} title="Upload dataset" subtitle="CSV or XLSX • validated, type-inferred, quality-scored, stored as Parquet" />
            <CardBody>
              <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="org" className="text-[12px] font-[500] text-[#9AA1AC]">
                      Workspace
                    </label>
                      <select id="org" className="input mt-1.5" value={orgId} onChange={(e) => setOrgId(e.target.value)} aria-label="Workspace">
                        {orgs.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                          </option>
                        ))}
                      </select>
                  </div>
                  <div>
                    <label htmlFor="dsname" className="text-[12px] font-[500] text-[#9AA1AC]">
                      Dataset name <span className="text-[#656B75] font-normal">(optional)</span>
                    </label>
                    <input id="dsname" className="input mt-1.5" placeholder="e.g. Q3 Sales" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" spellCheck={false} />
                  </div>
                </div>

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    const f = e.dataTransfer.files?.[0];
                    if (f) setFile(f);
                  }}
                  className={`relative rounded-[14px] border-2 border-dashed p-8 text-center transition ${dragOver ? "border-[#F5F7FA] bg-white/[0.04]" : "border-white/[0.08] bg-[#15181D] hover:bg-[#1A1E24] hover:border-white/[0.12]"}`}
                >
                  <input id="file" type="file" accept=".csv,.xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] || null)} className="absolute inset-0 opacity-0 cursor-pointer" aria-label="Upload file" />
                  <div className="pointer-events-none flex flex-col items-center gap-3">
                    <div className="h-10 w-10 rounded-[12px] bg-[#F5F7FA] text-[#08090B] flex items-center justify-center">
                      <FileSpreadsheet className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div className="text-[13px] font-[500] text-[#F5F7FA]">{file ? file.name : "Drop your dataset here"}</div>
                    <div className="text-[11px] font-[600] tracking-widest uppercase text-[#656B75]">CSV • XLSX • JSON</div>
                    <div className="text-[12px] text-[#656B75]">Max 50MB • up to 200k rows</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button onClick={upload} disabled={uploading} className="btn bg-[#F5F7FA] text-[#08090B] hover:bg-white h-[40px] px-5 gap-2" aria-label="Upload dataset">
                    {uploading ? "Uploading…" : "Browse files"} {!uploading && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
                  </button>
                  {file && <span className="text-[13px] text-[#9AA1AC]">{(file.size / 1024).toFixed(0)} KB • {file.name}</span>}
                </div>
                {msg && (
                  <div className={`rounded-[10px] px-3 py-2.5 text-[13px] border ${msg.startsWith("✓") ? "bg-[#10B981]/10 border-[#10B981]/20 text-[#10B981]" : "bg-[#F59E0B]/10 border-[#F59E0B]/20 text-[#F59E0B]"}`}>{msg}</div>
                )}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader icon={<Database className="h-4 w-4" aria-hidden="true" />} title="Your datasets" subtitle={`${datasets.length} total • click to inspect quality, columns, and lineage`} />
            <CardBody>
              {datasets.length === 0 ? (
                <div className="rounded-[12px] bg-[#15181D] border border-dashed border-white/[0.08] p-8 text-center">
                  <div className="text-[14px] font-[500] text-[#F5F7FA]">No datasets yet.</div>
                  <div className="text-[13px] text-[#9AA1AC] mt-1">Your intelligence workspace starts here.</div>
                  <div className="text-[12px] text-[#656B75] mt-1">Upload your first dataset and let Decentra uncover what matters.</div>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.06] -mx-5">
                  {datasets.map((d: any) => (
                    <a key={d.id} href={`/datasets/${d.id}`} className="flex items-center justify-between px-5 py-4 hover:bg-white/[0.04] transition group">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-[12px] bg-[#F5F7FA] text-[#08090B] flex items-center justify-center shrink-0">
                          <FileSpreadsheet className="h-5 w-5" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-[500] text-[14px] tracking-[-0.01em] truncate text-[#F5F7FA]">{d.name}</div>
                          <div className="text-[11px] text-[#656B75] flex items-center gap-2">
                            <span className="uppercase tracking-wide font-[600]">{d.source_type}</span>
                            <span>•</span>
                            <span>{d.row_count?.toLocaleString()} rows</span>
                            <span>•</span>
                            <span>{d.column_count} cols</span>
                            <span className="hidden sm:inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" aria-hidden="true" /> {fmtDateLong(d.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <span className="hidden sm:inline-flex items-center gap-1 text-[13px] font-[500] text-[#656B75] group-hover:text-[#F5F7FA]">
                        Inspect <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </main>
    </div>
  );
}
