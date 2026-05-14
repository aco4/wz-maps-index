export type JsonObject = Record<string, unknown>;

export type MapAuthor = string | readonly string[];

export interface MapSize {
  readonly w: number;
  readonly h: number;
}

export type HqLocation = readonly [x: number, y: number];

export interface PlayerBalanceMetric {
  /** Whether this property is balanced across all players. */
  readonly eq: boolean;
  /** The minimum count a player has for this property. */
  readonly min: number;
  /** The maximum count a player has for this property. */
  readonly max: number;
}

export interface PlayerBalanceInfo {
  readonly units: PlayerBalanceMetric;
  readonly structs: PlayerBalanceMetric;
  readonly resourceExtr: PlayerBalanceMetric;
  readonly pwrGen: PlayerBalanceMetric;
  readonly regFact: PlayerBalanceMetric;
  readonly vtolFact: PlayerBalanceMetric;
  readonly cyborgFact: PlayerBalanceMetric;
  readonly researchCent: PlayerBalanceMetric;
  readonly defStruct: PlayerBalanceMetric;
  readonly [key: string]: unknown;
}

export interface MapDownloadInfo {
  readonly type: string;
  readonly repo: string;
  readonly path: string;
  readonly uploaded: string;
  readonly hash: string;
  readonly size: number;
  readonly [key: string]: unknown;
}

/**
 * Raw map info object as returned by the Warzone 2100 Maps Database API.
 *
 * The API may add more fields over time, so this type allows additional keys.
 */
export interface MapInfo {
  readonly name: string;
  readonly slots: number;
  readonly tileset?: string;
  readonly author: MapAuthor;
  readonly license: string;
  readonly created?: string;
  readonly size: MapSize;
  readonly scavs: number;
  readonly oilWells: number;
  readonly player: PlayerBalanceInfo;
  readonly hq: readonly HqLocation[];
  readonly download: MapDownloadInfo;
  readonly [key: string]: unknown;
}

export interface AssetUrlTemplates {
  readonly download: readonly [string, ...string[]];
  readonly preview?: {
    readonly "2d"?: string;
    readonly [key: string]: unknown;
  };
  readonly readme?: {
    readonly en?: string;
    readonly [key: string]: unknown;
  };
  readonly info?: string;
  readonly [key: string]: unknown;
}

export interface FullDatabasePageLinks {
  readonly self?: string;
  readonly next?: string;
  readonly prev?: string;
  readonly [key: string]: unknown;
}

export interface FullDatabasePage {
  readonly type: "wz2100.mapdatabase.full.v1" | string;
  readonly id?: string;
  readonly version?: string;
  readonly links: FullDatabasePageLinks;
  readonly "asset-url-templates": AssetUrlTemplates;
  readonly maps: readonly MapInfo[];
  readonly [key: string]: unknown;
}

export interface FullDatabasePageSummary {
  readonly url: string;
  readonly id: string | null;
  readonly version: string | null;
  readonly mapCount: number;
}

export interface WzMapsIndex {
  /** Exact, case-sensitive map name -> raw MapInfo. */
  readonly maps: ReadonlyMap<string, MapInfo[]>;
  /** Exact, case-sensitive map name -> asset templates from the page containing that map. */
  readonly assetUrlTemplatesByName: ReadonlyMap<string, AssetUrlTemplates>;
  /** Asset templates from the first fetched page. Useful when templates are global/consistent. */
  readonly assetUrlTemplates: AssetUrlTemplates;
  readonly pages: readonly FullDatabasePageSummary[];
  readonly size: number;
  readonly generatedAt: number;
}

export interface BuildIndexOptions {
  /** First page to fetch. Defaults to https://maps.wz2100.net/api/v1/full.json. */
  readonly initialUrl?: string | URL;
  /** Optional fetch implementation for tests or custom runtimes. Defaults to globalThis.fetch. */
  readonly fetch?: FetchLike;
  /** Optional RequestInit passed to each fetch call. */
  readonly requestInit?: RequestInit;
}

export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;
