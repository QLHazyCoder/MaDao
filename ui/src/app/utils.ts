import type {
  LanguageCode,
  OptionCatalog,
  OptionCatalogItem,
  OptionItem,
  ProviderPriceItem,
  PricePanelMap,
  ProviderDynamicOptions,
} from './types';
import { i18n } from './i18n';
import { canonicalCountryValue, formatCountryLabel, formatServiceLabel } from '../lib/formatters';

export function mergeOptionItems(optionGroups: OptionItem[][]) {
  const merged = new Map<string, OptionItem>();
  optionGroups.flat().forEach((item) => {
    const key = item.value;
    if (!merged.has(key)) merged.set(key, item);
  });
  return [...merged.values()];
}

export function normalizeServiceOptions(options: OptionItem[]) {
  const merged = new Map<string, OptionItem>();
  for (const option of options) {
    const value = option.value.trim();
    const key = value.toLowerCase();
    const label = option.label.trim();
    if (!merged.has(key)) {
      merged.set(key, {
        value,
        label: label || formatServiceLabel(value),
        hint: option.hint,
        provider_value: option.provider_value ?? option.value,
        icon_url: option.icon_url,
        provider_icon_url: option.provider_icon_url,
      });
    }
  }
  return [...merged.values()];
}

export function normalizeCountryOptions(options: OptionItem[]) {
  const merged = new Map<string, OptionItem>();
  for (const option of options) {
    const key = canonicalCountryValue(option.value || option.label);
    const label = option.label.trim();
    if (!merged.has(key)) {
      merged.set(key, {
        value: key,
        label: label || formatCountryLabel(key),
        hint: option.hint,
        provider_value: option.provider_value ?? option.value,
        icon_url: option.icon_url,
        provider_icon_url: option.provider_icon_url,
      });
    }
  }
  return [...merged.values()];
}

export function normalizeOperatorOptions(options: OptionItem[]) {
  const merged = new Map<string, OptionItem>();
  for (const option of options) {
    const value = option.value.trim().toLowerCase();
    const label = option.label.trim();
    if (!merged.has(value)) {
      merged.set(value, {
        value,
        label: label || formatOperatorLabel(value),
        hint: option.hint,
        provider_value: option.provider_value ?? option.value,
        icon_url: option.icon_url,
        provider_icon_url: option.provider_icon_url,
      });
    }
  }
  return [...merged.values()];
}

export function operatorCountryCacheKey(country: string | null | undefined) {
  const canonical = canonicalCountryValue(country ?? '');
  if (!canonical) return '';
  return canonical === 'any' || canonical === 'local' ? canonical : canonical.toLowerCase();
}

export function formatOperatorLabel(operator: string, language: LanguageCode = 'en') {
  const normalized = operator.trim().toLowerCase();
  if (!normalized) return '';
  if (normalized === 'any') return i18n.getFixedT(language)('Any operator');
  if (normalized === 'o2') return 'O2';
  return normalized
    .split(/\s+/)
    .map((part) => part ? part[0].toUpperCase() + part.slice(1) : part)
    .join(' ');
}

function mergeCatalogItems(source: Map<string, OptionCatalogItem>, providerId: string, items: OptionItem[]) {
  items.forEach((item) => {
    const key = item.value;
    const providerValue = item.provider_value ?? item.value;
    const providerIconUrl = item.provider_icon_url ?? item.icon_url ?? undefined;
    const existing = source.get(key);
    if (existing) {
      if (!existing.providers.includes(providerId)) existing.providers.push(providerId);
      existing.provider_values[providerId] = providerValue;
      if (providerIconUrl) {
        existing.provider_icon_urls ??= {};
        existing.provider_icon_urls[providerId] = providerIconUrl;
      }
      if (!existing.icon_url && item.icon_url) existing.icon_url = item.icon_url;
      if (!existing.label && item.label) existing.label = item.label;
      if (!existing.label_zh && item.label_zh) existing.label_zh = item.label_zh;
      if (!existing.hint && item.hint) existing.hint = item.hint;
      return;
    }
    source.set(key, {
      value: key,
      label: item.label,
      hint: item.hint,
      providers: [providerId],
      provider_values: { [providerId]: providerValue },
      label_zh: item.label_zh,
      icon_url: item.icon_url,
      provider_icon_urls: providerIconUrl ? { [providerId]: providerIconUrl } : {},
    });
  });
}

function mergePriceOperators(
  source: Map<string, OptionCatalogItem>,
  providerId: string,
  items: Array<{ operator: string; operator_label?: string | null }>,
) {
  items.forEach((item) => {
    const value = item.operator.trim().toLowerCase();
    if (!value || value === 'any' || value === 'default') return;
    const label = (item.operator_label ?? item.operator).trim() || formatOperatorLabel(value);
    const existing = source.get(value);
    if (existing) {
      if (!existing.providers.includes(providerId)) existing.providers.push(providerId);
      existing.provider_values[providerId] = item.operator;
      if (!existing.label && label) existing.label = label;
      if (!existing.hint) existing.hint = 'price-derived';
      return;
    }
    source.set(value, {
      value,
      label,
      hint: 'price-derived',
      providers: [providerId],
      provider_values: { [providerId]: item.operator },
    });
  });
}

export function buildOptionCatalog(
  providerOptions: Record<string, ProviderDynamicOptions>,
  pricePanels?: PricePanelMap,
): OptionCatalog {
  const services = new Map<string, OptionCatalogItem>();
  const countries = new Map<string, OptionCatalogItem>();
  const operators = new Map<string, OptionCatalogItem>();

  Object.entries(providerOptions).forEach(([providerId, options]) => {
    mergeCatalogItems(services, providerId, options.services);
    mergeCatalogItems(countries, providerId, options.countries);
    mergeCatalogItems(operators, providerId, options.operators);
  });

  Object.entries(pricePanels ?? {}).forEach(([providerId, panel]) => {
    mergePriceOperators(operators, providerId, panel.items);
  });

  return {
    services: [...services.values()],
    countries: [...countries.values()],
    operators: [...operators.values()],
  };
}

export function filterCatalogItems(items: OptionCatalogItem[], providerId: string) {
  if (!providerId || providerId === 'any') return items;
  return items.filter((item) => item.providers.includes(providerId));
}

/**
 * Builds one provider-scoped country list. The provider's country endpoint is
 * the baseline; a live price response can promote and add countries it offers.
 */
export function buildProviderCountryOptions(
  countries: OptionCatalogItem[],
  providerId: string,
  offeredItems: ProviderPriceItem[] = [],
): OptionItem[] {
  const offeredCountries = new Set(
    offeredItems.map((item) => canonicalCountryValue(item.country)).filter(Boolean),
  );
  const catalogItems = filterCatalogItems(countries, providerId);
  const catalogCountries = new Set(catalogItems.map((item) => canonicalCountryValue(item.value)));
  const catalogOptions = [...catalogItems]
    .sort((left, right) => Number(offeredCountries.has(canonicalCountryValue(right.value)))
      - Number(offeredCountries.has(canonicalCountryValue(left.value))))
    .map((item) => {
      const iconUrl = item.provider_icon_urls?.[providerId] ?? item.icon_url;
      return {
        value: item.value,
        label: item.label,
        hint: item.hint,
        label_zh: item.label_zh,
        provider_value: item.provider_values[providerId]
          ?? item.provider_values[item.providers[0]]
          ?? item.value,
        icon_url: iconUrl,
        provider_icon_url: iconUrl,
      };
    });
  const offerOnlyOptions = offeredItems
    .filter((item) => !catalogCountries.has(canonicalCountryValue(item.country)))
    .map((item) => ({
      value: item.country,
      label: item.display_name,
      hint: '',
      label_zh: item.display_name_zh,
      provider_value: item.provider_country ?? item.country,
    }));

  return normalizeCountryOptions([...catalogOptions, ...offerOnlyOptions]);
}
