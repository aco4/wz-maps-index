import * as wz_maps_index from "./index.ts";

const index = await wz_maps_index.buildIndex();
const maps = wz_maps_index.searchByName(index, "ScavDom");
console.log(maps);

for (const map of maps) {
  const urls = wz_maps_index.getDownloadUrls(index, map);
  console.log(urls);
}
