import test from "node:test";
import assert from "node:assert/strict";

import {
  DuplicateMapNameError,
  buildIndex,
  getDownloadUrls,
  getInfoUrl,
  getMapByName,
  getPreviewUrl,
  getPrimaryDownloadUrl,
  getReadmeUrl,
  resolveMapDatabaseUrlTemplate,
} from "../dist/index.js";

const templates = {
  download: [
    "https://github.com/Warzone2100/maps-{{download/repo}}/releases/download/{{download/path}}",
    "https://mirror.example.test/maps/{{download/hash}}/{{download/path}}",
  ],
  preview: {
    "2d": "https://maps-assets.wz2100.net/v1/maps/{{download/hash}}/preview.png",
  },
  readme: {
    en: "https://maps-assets.wz2100.net/v1/maps/{{download/hash}}/readme.md",
  },
  info: "https://maps-assets.wz2100.net/v1/maps/{{download/hash}}.json",
};

const mapA = makeMapInfo("MyMap", "8p", "v1/8p-MyMap.wz", "hash-a");
const mapB = makeMapInfo("myMap", "4p", "v2/4p-myMap.wz", "hash-b");

function makeMapInfo(name, repo, path, hash) {
  return {
    name,
    slots: 8,
    tileset: "arizona",
    author: "Originator",
    license: "CC0-1.0",
    created: "2012-06-01",
    size: { w: 200, h: 200 },
    scavs: 0,
    oilWells: 320,
    player: {
      units: { eq: true, min: 4, max: 4 },
      structs: { eq: true, min: 4, max: 61 },
      resourceExtr: { eq: true, min: 40, max: 40 },
      pwrGen: { eq: true, min: 10, max: 10 },
      regFact: { eq: true, min: 0, max: 0 },
      vtolFact: { eq: true, min: 0, max: 0 },
      cyborgFact: { eq: true, min: 0, max: 0 },
      researchCent: { eq: true, min: 0, max: 0 },
      defStruct: { eq: true, min: 0, max: 0 },
    },
    hq: [[33, 13], [76, 13]],
    download: {
      type: "jsonv2",
      repo,
      path,
      uploaded: "2023-05-01",
      hash,
      size: 12345,
    },
  };
}

function mockFetch(routes) {
  return async (input) => {
    const url = new URL(String(input));
    const body = routes.get(url.pathname);

    if (!body) {
      return new Response("not found", { status: 404, statusText: "Not Found" });
    }

    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
}

test("buildIndex follows pagination and creates an exact-name index", async () => {
  const routes = new Map([
    [
      "/api/v1/full.json",
      {
        type: "wz2100.mapdatabase.full.v1",
        id: "full-page-1",
        version: "2026-01-01 00:00:00",
        links: { self: "/api/v1/full.json", next: "/api/v1/full/page/2.json" },
        "asset-url-templates": templates,
        maps: [mapA],
      },
    ],
    [
      "/api/v1/full/page/2.json",
      {
        type: "wz2100.mapdatabase.full.v1",
        id: "full-page-2",
        version: "2026-01-01 00:00:00",
        links: { self: "/api/v1/full/page/2.json", prev: "/api/v1/full.json" },
        "asset-url-templates": templates,
        maps: [mapB],
      },
    ],
  ]);

  const index = await buildIndex({
    initialUrl: "https://maps.wz2100.net/api/v1/full.json",
    fetch: mockFetch(routes),
  });

  assert.equal(index.size, 2);
  assert.equal(index.pages.length, 2);
  assert.deepEqual(getMapByName(index, "MyMap"), mapA);
  assert.deepEqual(getMapByName(index, "myMap"), mapB);
  assert.equal(getMapByName(index, "MYMAP"), null);
  assert.equal(getMapByName(index, "MyMap "), null);
});

test("getDownloadUrls exposes primary and mirrors", async () => {
  const routes = new Map([
    [
      "/api/v1/full.json",
      {
        type: "wz2100.mapdatabase.full.v1",
        links: { self: "/api/v1/full.json" },
        "asset-url-templates": templates,
        maps: [mapA],
      },
    ],
  ]);

  const index = await buildIndex({
    initialUrl: "https://maps.wz2100.net/api/v1/full.json",
    fetch: mockFetch(routes),
  });

  assert.deepEqual(getDownloadUrls(index, "missing"), null);

  const urls = getDownloadUrls(index, "MyMap");
  assert.ok(urls);
  assert.equal(
    urls.primary,
    "https://github.com/Warzone2100/maps-8p/releases/download/v1/8p-MyMap.wz",
  );
  assert.deepEqual(urls.mirrors, ["https://mirror.example.test/maps/hash-a/v1/8p-MyMap.wz"]);
  assert.deepEqual(urls.all, [
    "https://github.com/Warzone2100/maps-8p/releases/download/v1/8p-MyMap.wz",
    "https://mirror.example.test/maps/hash-a/v1/8p-MyMap.wz",
  ]);
  assert.equal(
    getPrimaryDownloadUrl(index, "MyMap"),
    "https://github.com/Warzone2100/maps-8p/releases/download/v1/8p-MyMap.wz",
  );
});

test("asset helpers resolve preview, readme, and info URLs", async () => {
  const routes = new Map([
    [
      "/api/v1/full.json",
      {
        type: "wz2100.mapdatabase.full.v1",
        links: { self: "/api/v1/full.json" },
        "asset-url-templates": templates,
        maps: [mapA],
      },
    ],
  ]);

  const index = await buildIndex({
    initialUrl: "https://maps.wz2100.net/api/v1/full.json",
    fetch: mockFetch(routes),
  });

  assert.equal(getPreviewUrl(index, "MyMap"), "https://maps-assets.wz2100.net/v1/maps/hash-a/preview.png");
  assert.equal(getReadmeUrl(index, "MyMap"), "https://maps-assets.wz2100.net/v1/maps/hash-a/readme.md");
  assert.equal(getInfoUrl(index, "MyMap"), "https://maps-assets.wz2100.net/v1/maps/hash-a.json");
  assert.equal(getPreviewUrl(index, "missing"), null);
});

test("buildIndex rejects duplicate names", async () => {
  const duplicate = makeMapInfo("MyMap", "2p", "v1/2p-MyMap.wz", "hash-c");
  const routes = new Map([
    [
      "/api/v1/full.json",
      {
        type: "wz2100.mapdatabase.full.v1",
        links: { self: "/api/v1/full.json" },
        "asset-url-templates": templates,
        maps: [mapA, duplicate],
      },
    ],
  ]);

  await assert.rejects(
    () => buildIndex({
      initialUrl: "https://maps.wz2100.net/api/v1/full.json",
      fetch: mockFetch(routes),
    }),
    DuplicateMapNameError,
  );
});

test("resolveMapDatabaseUrlTemplate supports optional leading slash in JSON Pointers", () => {
  assert.equal(
    resolveMapDatabaseUrlTemplate("repo={{/download/repo}}; path={{download/path}}", mapA),
    "repo=8p; path=v1/8p-MyMap.wz",
  );
});
