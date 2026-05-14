import {
  MapDatabaseFetchError,
  MapDatabaseSchemaError,
} from "./errors.js";
import { resolveMapDatabaseUrlTemplate } from "./template.js";
import type {
  AssetUrlTemplates,
  BuildIndexOptions,
  FetchLike,
  FullDatabasePage,
  FullDatabasePageSummary,
  MapInfo,
  WzMapsIndex,
} from "./types.js";

export type {
  AssetUrlTemplates,
  BuildIndexOptions,
  FetchLike,
  FullDatabasePage,
  FullDatabasePageLinks,
  FullDatabasePageSummary,
  HqLocation,
  JsonObject,
  MapAuthor,
  MapDownloadInfo,
  MapInfo,
  MapSize,
  PlayerBalanceInfo,
  PlayerBalanceMetric,
  WzMapsIndex,
} from "./types.js";

export {
  MapDatabaseFetchError,
  MapDatabaseSchemaError,
  TemplateResolutionError,
  WzMapsIndexError,
} from "./errors.js";

export const DEFAULT_FULL_DATABASE_URL = "https://maps.wz2100.net/api/v1/full.json";

/**
 * Fetches all paginated database pages and builds an exact, case-sensitive,
 * in-memory O(1) map-name index.
 */
export async function buildIndex(options: BuildIndexOptions = {}): Promise<WzMapsIndex> {
  const fetchFn = options.fetch ?? globalThis.fetch;

  if (typeof fetchFn !== "function") {
    throw new MapDatabaseSchemaError(
      "No fetch implementation is available. Use Node.js >=18 or pass BuildIndexOptions.fetch.",
    );
  }

  const maps = new Map<string, MapInfo[]>();
  const assetUrlTemplatesByName = new Map<string, AssetUrlTemplates>();
  const pages: FullDatabasePageSummary[] = [];

  let firstAssetUrlTemplates: AssetUrlTemplates | undefined;
  let nextUrl: URL | null = new URL(options.initialUrl ?? DEFAULT_FULL_DATABASE_URL);

  while (nextUrl !== null) {
    const currentUrl: URL = nextUrl;
    const page = await fetchFullDatabasePage(fetchFn, currentUrl, options.requestInit);
    const assetUrlTemplates = page["asset-url-templates"];

    if (!firstAssetUrlTemplates) {
      firstAssetUrlTemplates = assetUrlTemplates;
    }

    pages.push({
      url: currentUrl.toString(),
      id: typeof page.id === "string" ? page.id : null,
      version: typeof page.version === "string" ? page.version : null,
      mapCount: page.maps.length,
    });

    for (const mapInfo of page.maps) {
      assertMapInfoLike(mapInfo);

      if (maps.has(mapInfo.name)) {
        maps.get(mapInfo.name)?.push(mapInfo);
      } else {
        maps.set(mapInfo.name, [mapInfo]);
      }

      assetUrlTemplatesByName.set(mapInfo.name, assetUrlTemplates);
    }

    const next = typeof page.links.next === "string" && page.links.next.length > 0
      ? page.links.next
      : null;

    nextUrl = next === null ? null : new URL(next, currentUrl);
  }

  if (!firstAssetUrlTemplates) {
    throw new MapDatabaseSchemaError("No database pages were fetched.");
  }

  return Object.freeze({
    maps,
    assetUrlTemplatesByName,
    assetUrlTemplates: firstAssetUrlTemplates,
    pages: Object.freeze(pages),
    size: maps.size,
    generatedAt: Date.now(),
  });
}

/** Exact, case-sensitive lookup. Returns an empty array when no map with the name is not found. */
export function searchByName(index: WzMapsIndex, name: string): MapInfo[] {
  return index.maps.get(name) ?? [];
}

/** Returns download URLs (the primary, followed by any mirrors) for the .wz map file */
export function getDownloadUrls(index: WzMapsIndex, mapInfo: MapInfo): string[] {
  const assetUrlTemplates = getAssetUrlTemplatesForMap(index, mapInfo);
  return assetUrlTemplates.download.map((template) =>
    resolveMapDatabaseUrlTemplate(template, mapInfo),
  ) as [string, ...string[]];
}

async function fetchFullDatabasePage(
  fetchFn: FetchLike,
  url: URL,
  requestInit: RequestInit | undefined,
): Promise<FullDatabasePage> {
  const response = await fetchFn(url, requestInit);

  if (!response.ok) {
    throw new MapDatabaseFetchError(url.toString(), response.status, response.statusText);
  }

  const json = await response.json() as unknown;
  assertFullDatabasePage(json, url.toString());
  return json;
}

function getAssetUrlTemplatesForMap(index: WzMapsIndex, mapInfo: MapInfo): AssetUrlTemplates {
  return index.assetUrlTemplatesByName.get(mapInfo.name) ?? index.assetUrlTemplates;
}

function assertFullDatabasePage(value: unknown, url: string): asserts value is FullDatabasePage {
  if (!isRecord(value)) {
    throw new MapDatabaseSchemaError(`Expected database page ${url} to be a JSON object.`);
  }

  if (!isRecord(value.links)) {
    throw new MapDatabaseSchemaError(`Expected database page ${url} to contain a links object.`);
  }

  if (!Array.isArray(value.maps)) {
    throw new MapDatabaseSchemaError(`Expected database page ${url} to contain a maps array.`);
  }

  assertAssetUrlTemplates(value["asset-url-templates"], url);
}

function assertAssetUrlTemplates(value: unknown, url: string): asserts value is AssetUrlTemplates {
  if (!isRecord(value)) {
    throw new MapDatabaseSchemaError(`Expected database page ${url} to contain asset-url-templates.`);
  }

  if (!Array.isArray(value.download) || value.download.length === 0) {
    throw new MapDatabaseSchemaError(
      `Expected database page ${url} to contain at least one download asset-url-template.`,
    );
  }

  if (value.download.some((template) => typeof template !== "string" || template.length === 0)) {
    throw new MapDatabaseSchemaError(
      `Expected database page ${url} download asset-url-templates to be non-empty strings.`,
    );
  }
}

function assertMapInfoLike(value: unknown): asserts value is MapInfo {
  if (!isRecord(value)) {
    throw new MapDatabaseSchemaError("Expected each map info entry to be a JSON object.");
  }

  if (typeof value.name !== "string" || value.name.length === 0) {
    throw new MapDatabaseSchemaError("Expected each map info entry to contain a non-empty string name.");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
