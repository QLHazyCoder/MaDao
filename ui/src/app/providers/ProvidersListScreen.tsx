import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PageHeader, StatusBadge } from '../ui-bridge';
import type { LanguageCode, ProviderManifest, ProviderSummary } from '../types';
import { formatProviderLabel, formatProviderProtocolLabel, formatReuseCapabilityLabel } from '../../lib/formatters';
import { ResourceBadge } from '../../components/primitives';

function hasConfiguredApiKey(manifest: ProviderManifest): boolean {
  if (manifest.kind === 'mock') return true;
  const config = manifest.kind === 'handler_api'
    ? manifest.handler_api
    : manifest.five_sim;
  return Boolean(config && String((config as Record<string, unknown>).api_key ?? '').trim());
}

function getProviderStatus(
  enabled: boolean,
  hasApiKey: boolean,
  balanceFetchedAt: string | null | undefined,
): { tone: 'green' | 'orange' | 'gray'; key: string } {
  if (!enabled) return { tone: 'gray', key: 'Disabled' };
  if (!hasApiKey) return { tone: 'gray', key: 'Not Configured' };
  if (!balanceFetchedAt) return { tone: 'orange', key: 'Pending Verification' };
  return { tone: 'green', key: 'Connected' };
}

export type ProvidersListScreenProps = {
  providers: ProviderManifest[];
  summaries?: ProviderSummary[];
  balances?: Record<string, string>;
  onConfigure: (id: string) => void;
  onRefreshBalance: (id: string) => void;
  onReorder: (ids: string[]) => void;
  onToggleEnabled: (id: string, enabled: boolean) => void;
};

export function ProvidersListScreen(props: ProvidersListScreenProps) {
  const { t, i18n } = useTranslation();
  const language = (i18n.resolvedLanguage ?? i18n.language ?? 'en') as LanguageCode;
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={t('Providers')}
        subtitle={t('Configure provider credentials and health. Routing priority is managed in the Routing workspace.')}
      />

      <div className="grid grid-cols-1 gap-4 min-[760px]:grid-cols-2">
        {props.providers.map((provider) => {
          const summary = props.summaries?.find((item) => item.id === provider.id);
          const rawProtocolTag = summary?.protocol_label
            ?? provider.ui?.protocol_label
            ?? summary?.protocol
            ?? provider.kind;
          const protocolTag = rawProtocolTag.toLowerCase() === 'handler api'
            || rawProtocolTag.toLowerCase() === 'handler_api'
            ? provider.name
            : rawProtocolTag;
          const balanceLabel = props.balances?.[provider.id] ?? '—';
          const providerIconUrl = summary?.icon_url ?? provider.ui?.icon_url;
          const providerBadgeLabel = summary?.badge_label ?? provider.ui?.badge_label;
          const status = getProviderStatus(provider.enabled, hasConfiguredApiKey(provider), summary?.balance_fetched_at);

          return (
            <button
              key={provider.id}
              type="button"
              className="flex w-full flex-col gap-0 rounded-2xl border border-ds-border bg-ds-surface p-5 text-left shadow-ds backdrop-blur-ds transition-shadow hover:shadow-md"
              onClick={() => props.onConfigure(provider.id)}
            >
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  className="flex items-center gap-2 bg-transparent p-0 border-0 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (provider.homepage) window.open(provider.homepage, '_blank');
                  }}
                >
                  <ResourceBadge kind="provider" value={provider.id} iconUrl={providerIconUrl} fallbackLabel={providerBadgeLabel ?? undefined} />
                  <span className="text-[14px] font-semibold text-ds-text-primary">
                    {formatProviderLabel(provider.name, language)}
                  </span>
                </button>
                <StatusBadge tone={status.tone}>{t(status.key)}</StatusBadge>
              </div>

              <div className="flex items-center justify-center py-5">
                <span
                  className="text-[20px] font-semibold text-ds-text-primary cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); props.onRefreshBalance(provider.id); }}
                >
                  {balanceLabel}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-1.5">
                  <StatusBadge tone="blue">
                    {formatProviderProtocolLabel(protocolTag, language)}
                  </StatusBadge>
                  {(summary?.reuse_capabilities ?? []).map((capability) => (
                    <StatusBadge key={capability} tone="orange">
                      {formatReuseCapabilityLabel(capability, language)}
                    </StatusBadge>
                  ))}
                </div>
                <div className="flex items-center gap-1 text-ds-accent-blue">
                  <span className="text-[12px] font-medium">{t('Configure')}</span>
                  <ChevronRight size={12} />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
