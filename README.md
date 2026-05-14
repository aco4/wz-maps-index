# @aco4/wz-maps-index

JavaScript wrapper for the Warzone 2100 Maps Database API.

The package fetches the full paginated map database, builds a `Map<string, MapInfo>`, and lets callers perform O(1) map-name lookups after the index has been built.

## Install

This package is intended to be published to GitHub Packages.

```sh
npm login --scope=@aco4 --auth-type=legacy --registry=https://npm.pkg.github.com
npm install @aco4/wz-maps-index
```

Or add this to your project-level `.npmrc`:

```ini
@aco4:registry=https://npm.pkg.github.com
```

Then install normally:

```sh
npm install @aco4/wz-maps-index
```

## Requirements

- Node.js 18+
- ESM project or dynamic `import()` from CommonJS

## Usage

```ts
import { buildIndex, searchByName, getDownloadUrls } from "@aco4/wz-maps-index";

const index = await buildIndex();

const maps = searchByName(index, "MyMap"); // Exact case-sensitive search

for (const map of maps) {
  const urls = getDownloadUrls(index, map);
  console.log(urls);
}
```

## API

### `buildIndex(options?)`

Fetches every page starting at `https://maps.wz2100.net/api/v1/full.json`, follows `links.next`, and returns an explicit in-memory index.

```ts
type BuildIndexOptions = {
  initialUrl?: string | URL;
  fetch?: FetchLike;
  requestInit?: RequestInit;
};
```

`initialUrl` and `fetch` are mainly useful for tests or mirrors.

### `searchByName(index, name)`

Returns the raw upstream `MapInfo` object for the exact map name, or `null` when not found.

```ts
const mapInfo = searchByName(index, "SomeMap");
```

### `getDownloadUrls(index, name)`

Returns download URLs generated from the API's download asset URL templates, or `null` when the map is not found.

```ts
const urls = getDownloadUrls(index, "SomeMap");

if (urls) {
  console.log(urls.primary);
  console.log(urls.mirrors);
  console.log(urls.all);
}
```

## Publishing to GitHub Packages

This repo includes `.github/workflows/publish.yml`. It publishes on a GitHub Release or manual workflow dispatch.

The package name is scoped for GitHub Packages:

```json
{
  "name": "@aco4/wz-maps-index",
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  }
}
```

After the first publish, check the package settings in GitHub and set visibility to **Public** if GitHub created it as private.

## Future npmjs.com publishing

The package is compatible with npmjs.com, but the current `publishConfig.registry` points to GitHub Packages. To publish to npmjs.com later, either temporarily override the registry during publish or add a separate npmjs publishing workflow using `https://registry.npmjs.org` and an `NPM_TOKEN` secret.

## License
SPDX-License-Identifier: GPL-2.0-or-later

This program is free software; you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation; either version 2 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License along
with this program; if not, see https://www.gnu.org/licenses/.
