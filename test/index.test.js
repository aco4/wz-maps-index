import test from "node:test";
import assert from "node:assert/strict";

import {
  buildIndex,
  getDownloadUrls,
  MapDatabaseFetchError,
  MapDatabaseSchemaError,
  searchByName,
  TemplateResolutionError,
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
  const requestInit = { headers: { "x-test": "1" } };
  const calls = [];
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
    requestInit,
    fetch: async (input, init) => {
      calls.push({ input: String(input), init });
      return mockFetch(routes)(input);
    },
  });

  assert.equal(index.size, 2);
  assert.deepEqual(index.pages, [
    {
      url: "https://maps.wz2100.net/api/v1/full.json",
      id: "full-page-1",
      version: "2026-01-01 00:00:00",
      mapCount: 1,
    },
    {
      url: "https://maps.wz2100.net/api/v1/full/page/2.json",
      id: "full-page-2",
      version: "2026-01-01 00:00:00",
      mapCount: 1,
    },
  ]);
  assert.deepEqual(calls, [
    { input: "https://maps.wz2100.net/api/v1/full.json", init: requestInit },
    { input: "https://maps.wz2100.net/api/v1/full/page/2.json", init: requestInit },
  ]);
  assert.deepEqual(searchByName(index, "MyMap"), [mapA]);
  assert.deepEqual(searchByName(index, "myMap"), [mapB]);
  assert.deepEqual(searchByName(index, "MYMAP"), []);
  assert.deepEqual(searchByName(index, "MyMap "), []);
});

test("buildIndex preserves duplicate names in insertion order", async () => {
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

  const index = await buildIndex({
    initialUrl: "https://maps.wz2100.net/api/v1/full.json",
    fetch: mockFetch(routes),
  });

  assert.equal(index.size, 1);
  assert.deepEqual(searchByName(index, "MyMap"), [mapA, duplicate]);
});

test("getDownloadUrls resolves primary and mirror templates for a map", async () => {
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

  assert.deepEqual(getDownloadUrls(index, mapA), [
    "https://github.com/Warzone2100/maps-8p/releases/download/v1/8p-MyMap.wz",
    "https://mirror.example.test/maps/hash-a/v1/8p-MyMap.wz",
  ]);
});

test("getDownloadUrls uses templates from the page containing the map", async () => {
  const secondPageTemplates = {
    ...templates,
    download: ["https://cdn.example.test/{{download/hash}}/{{download/path}}"],
  };
  const routes = new Map([
    [
      "/api/v1/full.json",
      {
        type: "wz2100.mapdatabase.full.v1",
        links: { self: "/api/v1/full.json", next: "/api/v1/full/page/2.json" },
        "asset-url-templates": templates,
        maps: [mapA],
      },
    ],
    [
      "/api/v1/full/page/2.json",
      {
        type: "wz2100.mapdatabase.full.v1",
        links: { self: "/api/v1/full/page/2.json" },
        "asset-url-templates": secondPageTemplates,
        maps: [mapB],
      },
    ],
  ]);

  const index = await buildIndex({
    initialUrl: "https://maps.wz2100.net/api/v1/full.json",
    fetch: mockFetch(routes),
  });

  assert.deepEqual(getDownloadUrls(index, mapB), [
    "https://cdn.example.test/hash-b/v2/4p-myMap.wz",
  ]);
});

test("getDownloadUrls throws when a template pointer cannot be resolved", async () => {
  const routes = new Map([
    [
      "/api/v1/full.json",
      {
        type: "wz2100.mapdatabase.full.v1",
        links: { self: "/api/v1/full.json" },
        "asset-url-templates": {
          ...templates,
          download: ["https://example.test/{{download/missing}}"],
        },
        maps: [mapA],
      },
    ],
  ]);

  const index = await buildIndex({
    initialUrl: "https://maps.wz2100.net/api/v1/full.json",
    fetch: mockFetch(routes),
  });

  assert.throws(() => getDownloadUrls(index, mapA), TemplateResolutionError);
});

test("buildIndex rejects non-OK responses with fetch details", async () => {
  await assert.rejects(
    () => buildIndex({
      initialUrl: "https://maps.wz2100.net/api/v1/full.json",
      fetch: async () => new Response("not found", { status: 404, statusText: "Not Found" }),
    }),
    (error) => {
      assert.ok(error instanceof MapDatabaseFetchError);
      assert.equal(error.url, "https://maps.wz2100.net/api/v1/full.json");
      assert.equal(error.status, 404);
      assert.equal(error.statusText, "Not Found");
      return true;
    },
  );
});

test("buildIndex rejects pages without maps", async () => {
  const routes = new Map([
    [
      "/api/v1/full.json",
      {
        type: "wz2100.mapdatabase.full.v1",
        links: { self: "/api/v1/full.json" },
        "asset-url-templates": templates,
      },
    ],
  ]);

  await assert.rejects(
    () => buildIndex({
      initialUrl: "https://maps.wz2100.net/api/v1/full.json",
      fetch: mockFetch(routes),
    }),
    MapDatabaseSchemaError,
  );
});

test("buildIndex rejects empty download templates", async () => {
  const routes = new Map([
    [
      "/api/v1/full.json",
      {
        type: "wz2100.mapdatabase.full.v1",
        links: { self: "/api/v1/full.json" },
        "asset-url-templates": { ...templates, download: [] },
        maps: [mapA],
      },
    ],
  ]);

  await assert.rejects(
    () => buildIndex({
      initialUrl: "https://maps.wz2100.net/api/v1/full.json",
      fetch: mockFetch(routes),
    }),
    MapDatabaseSchemaError,
  );
});
