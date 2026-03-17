'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

type Campaign = {
  campaign_id: string;
  name: string;
  status: string | null;
  channel: string | null;
  source: string | null;
};

type Resource = {
  id: string;
  campaign_id: string;
  title: string;
  description: string | null;
  resource_type: 'youtube' | 'link' | 'file';
  url: string | null;
  uploaded_by_name: string | null;
  created_at: string;
};

const fmtDate = (value: string) =>
  new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));

const typeLabel: Record<Resource['resource_type'], string> = {
  youtube: 'YouTube',
  link: 'Enlace',
  file: 'Documento',
};

export default function TrainingCampaignHubClient() {
  const searchParams = useSearchParams();
  const requestedCampaignId = (searchParams.get('campaignId') ?? '').trim();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [canManage, setCanManage] = useState(false);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [loadingResources, setLoadingResources] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkDescription, setLinkDescription] = useState('');
  const [postingLink, setPostingLink] = useState(false);

  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const selectedCampaign = useMemo(
    () => campaigns.find((item) => item.campaign_id === selectedCampaignId) ?? null,
    [campaigns, selectedCampaignId]
  );

  const filteredResources = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return resources;
    return resources.filter((item) => {
      const haystack = `${item.title} ${item.description ?? ''} ${item.resource_type}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [resources, search]);

  const loadCampaigns = useCallback(async () => {
    setLoadingCampaigns(true);
    setError(null);
    try {
      const response = await fetch('/api/training/campaigns', { cache: 'no-store' });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        items?: Campaign[];
        can_manage?: boolean;
      };
      if (!response.ok) {
        throw new Error(body.error ?? 'No se pudieron cargar campañas');
      }

      const items = body.items ?? [];
      setCampaigns(items);
      setCanManage(Boolean(body.can_manage));

      const nextCampaignId =
        (requestedCampaignId && items.some((item) => item.campaign_id === requestedCampaignId) ? requestedCampaignId : null) ??
        items[0]?.campaign_id ??
        '';

      setSelectedCampaignId((current) => {
        if (current && items.some((item) => item.campaign_id === current)) return current;
        return nextCampaignId;
      });
    } catch (err) {
      setError((err as Error).message);
      setCampaigns([]);
      setSelectedCampaignId('');
    } finally {
      setLoadingCampaigns(false);
    }
  }, [requestedCampaignId]);

  const loadResources = useCallback(async (campaignId: string) => {
    if (!campaignId) {
      setResources([]);
      return;
    }
    setLoadingResources(true);
    setError(null);
    try {
      const response = await fetch(`/api/training/resources?campaignId=${encodeURIComponent(campaignId)}`, {
        cache: 'no-store',
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string; items?: Resource[] };
      if (!response.ok) {
        throw new Error(body.error ?? 'No se pudieron cargar recursos');
      }
      setResources(body.items ?? []);
    } catch (err) {
      setError((err as Error).message);
      setResources([]);
    } finally {
      setLoadingResources(false);
    }
  }, []);

  useEffect(() => {
    void loadCampaigns();
  }, [loadCampaigns]);

  useEffect(() => {
    if (!selectedCampaignId) {
      setResources([]);
      return;
    }

    const url = new URL(window.location.href);
    url.searchParams.set('campaignId', selectedCampaignId);
    window.history.replaceState({}, '', url.toString());

    void loadResources(selectedCampaignId);
  }, [loadResources, selectedCampaignId]);

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch('/api/training/campaigns', {
        method: 'POST',
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string; synced?: number; source?: string };
      if (!response.ok) {
        throw new Error(body.error ?? 'No se pudo sincronizar');
      }

      await loadCampaigns();
      setSuccess(`Campañas sincronizadas (${body.synced ?? 0}).`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  const handleCreateLink = async () => {
    if (!selectedCampaignId) return;
    setPostingLink(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch('/api/training/resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: selectedCampaignId,
          title: linkTitle,
          url: linkUrl,
          description: linkDescription,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? 'No se pudo guardar enlace');
      }

      setLinkTitle('');
      setLinkUrl('');
      setLinkDescription('');
      await loadResources(selectedCampaignId);
      setSuccess('Recurso agregado.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPostingLink(false);
    }
  };

  const handleUploadFile = async () => {
    if (!selectedCampaignId || !uploadFile) return;
    setUploading(true);
    setError(null);
    setSuccess(null);
    try {
      const form = new FormData();
      form.append('campaignId', selectedCampaignId);
      form.append('title', uploadTitle);
      form.append('description', uploadDescription);
      form.append('file', uploadFile);

      const response = await fetch('/api/training/resources/upload', {
        method: 'POST',
        body: form,
      });

      const body = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!response.ok) {
        throw new Error(body.message ?? body.error ?? 'No se pudo subir archivo');
      }

      setUploadTitle('');
      setUploadDescription('');
      setUploadFile(null);
      await loadResources(selectedCampaignId);
      setSuccess('Archivo subido al repositorio de campaña.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (resourceId: string) => {
    const confirmed = window.confirm('¿Eliminar este recurso de capacitación?');
    if (!confirmed || !selectedCampaignId) return;

    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/training/resources?id=${encodeURIComponent(resourceId)}`, {
        method: 'DELETE',
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? 'No se pudo eliminar recurso');
      }

      await loadResources(selectedCampaignId);
      setSuccess('Recurso eliminado.');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const copyCampaignLink = async () => {
    if (!selectedCampaignId) return;
    const url = `${window.location.origin}/asistencia/capacitacion?campaignId=${encodeURIComponent(selectedCampaignId)}`;
    try {
      await navigator.clipboard.writeText(url);
      setSuccess('Enlace de campaña copiado.');
    } catch {
      setError('No se pudo copiar el enlace.');
    }
  };

  return (
    <section className="flex flex-col gap-6">
      <div className="rounded-[28px] border border-white/10 bg-[#0A0C10] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Repositorio unificado</p>
            <h2 className="mt-1 text-2xl font-semibold text-white">Capacitación por campaña</h2>
            <p className="mt-2 text-sm text-slate-400">
              Todo el material operativo en un solo enlace por campaña: videos, PDFs, Word, PPT y enlaces de apoyo.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canManage && (
              <button
                onClick={handleSync}
                disabled={syncing}
                className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15 disabled:opacity-60"
              >
                {syncing ? 'Sincronizando...' : 'Sincronizar campañas CRM'}
              </button>
            )}
            <button
              onClick={copyCampaignLink}
              disabled={!selectedCampaignId}
              className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
            >
              Copiar enlace de campaña
            </button>
          </div>
        </div>
      </div>

      {error && <p className="text-sm font-semibold text-rose-400">{error}</p>}
      {success && <p className="text-sm font-semibold text-emerald-400">{success}</p>}

      <div className="grid gap-6 lg:grid-cols-[0.35fr_0.65fr]">
        <aside className="rounded-[28px] border border-white/10 bg-[#0A0C10] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Campañas visibles</h3>
            {loadingCampaigns && <span className="text-xs text-slate-500">Cargando...</span>}
          </div>

          {campaigns.length === 0 ? (
            <p className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-400">
              No tienes campañas visibles para capacitación.
            </p>
          ) : (
            <div className="max-h-[540px] space-y-2 overflow-auto pr-1">
              {campaigns.map((campaign) => {
                const active = selectedCampaignId === campaign.campaign_id;
                return (
                  <button
                    key={campaign.campaign_id}
                    onClick={() => setSelectedCampaignId(campaign.campaign_id)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                      active
                        ? 'border-blue-400/60 bg-blue-500/10 text-white'
                        : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <div className="truncate text-sm font-semibold">{campaign.name}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      Estado: {campaign.status ?? '—'} {campaign.channel ? `· Canal: ${campaign.channel}` : ''}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        <div className="space-y-4">
          {canManage && selectedCampaign && (
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-[24px] border border-white/10 bg-[#0A0C10] p-4">
                <h3 className="text-sm font-semibold text-white">Nuevo enlace / video</h3>
                <div className="mt-3 space-y-3">
                  <input
                    value={linkTitle}
                    onChange={(event) => setLinkTitle(event.target.value)}
                    placeholder="Título del recurso"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500"
                  />
                  <input
                    value={linkUrl}
                    onChange={(event) => setLinkUrl(event.target.value)}
                    placeholder="https://..."
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500"
                  />
                  <textarea
                    value={linkDescription}
                    onChange={(event) => setLinkDescription(event.target.value)}
                    placeholder="Descripción opcional"
                    rows={3}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500"
                  />
                  <button
                    onClick={handleCreateLink}
                    disabled={postingLink || !linkTitle.trim() || !linkUrl.trim()}
                    className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
                  >
                    {postingLink ? 'Guardando...' : 'Agregar enlace'}
                  </button>
                </div>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-[#0A0C10] p-4">
                <h3 className="text-sm font-semibold text-white">Subir documento</h3>
                <div className="mt-3 space-y-3">
                  <input
                    value={uploadTitle}
                    onChange={(event) => setUploadTitle(event.target.value)}
                    placeholder="Título del archivo"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500"
                  />
                  <textarea
                    value={uploadDescription}
                    onChange={(event) => setUploadDescription(event.target.value)}
                    placeholder="Descripción opcional"
                    rows={3}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500"
                  />
                  <input
                    type="file"
                    onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
                    className="w-full text-sm text-slate-300 file:mr-3 file:rounded-full file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
                  />
                  <button
                    onClick={handleUploadFile}
                    disabled={uploading || !uploadFile}
                    className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-60"
                  >
                    {uploading ? 'Subiendo...' : 'Subir archivo'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-[24px] border border-white/10 bg-[#0A0C10] p-4">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-semibold text-white">
                  Recursos {selectedCampaign ? `· ${selectedCampaign.name}` : ''}
                </h3>
                <p className="text-xs text-slate-500">{resources.length} recurso(s) cargado(s)</p>
              </div>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar en recursos"
                className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-slate-500 sm:w-64"
              />
            </div>

            {loadingResources ? (
              <p className="text-sm text-slate-500">Cargando recursos…</p>
            ) : filteredResources.length === 0 ? (
              <p className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-400">
                No hay recursos para esta campaña con el filtro actual.
              </p>
            ) : (
              <div className="space-y-3">
                {filteredResources.map((resource) => (
                  <article key={resource.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-white">{resource.title}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {typeLabel[resource.resource_type]} · {fmtDate(resource.created_at)}
                          {resource.uploaded_by_name ? ` · ${resource.uploaded_by_name}` : ''}
                        </p>
                        {resource.description && <p className="mt-2 text-sm text-slate-300">{resource.description}</p>}
                      </div>

                      <div className="flex items-center gap-2">
                        {resource.url && (
                          <a
                            href={resource.url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/15"
                          >
                            Abrir
                          </a>
                        )}
                        {canManage && (
                          <button
                            onClick={() => handleDelete(resource.id)}
                            className="rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-500/20"
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
