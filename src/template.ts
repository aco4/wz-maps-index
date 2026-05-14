import { TemplateResolutionError } from "./errors.js";
import type { MapInfo } from "./types.js";

const TEMPLATE_TOKEN_PATTERN = /{{\s*(.+?)\s*}}/g;

/** Resolve a Maps Database URL template against a raw MapInfo object. */
export function resolveMapDatabaseUrlTemplate(template: string, mapInfo: MapInfo): string {
  return template.replace(TEMPLATE_TOKEN_PATTERN, (_match: string, rawPointer: string) => {
    const pointer = rawPointer.trim();
    const value = getJsonPointerValue(mapInfo, pointer);

    if (value === undefined || value === null) {
      throw new TemplateResolutionError(template, pointer);
    }

    if (typeof value === "object") {
      throw new TemplateResolutionError(template, pointer);
    }

    return String(value);
  });
}

/**
 * Looks up a JSON Pointer value where the leading slash is optional.
 * Supports RFC 6901 escaping: ~1 for slash and ~0 for tilde.
 */
export function getJsonPointerValue(source: unknown, pointer: string): unknown {
  const normalizedPointer = pointer.startsWith("/") ? pointer.slice(1) : pointer;

  if (normalizedPointer === "") {
    return source;
  }

  const parts = normalizedPointer.split("/").map(unescapeJsonPointerPart);
  let current: unknown = source;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (typeof current !== "object") {
      return undefined;
    }

    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

function unescapeJsonPointerPart(part: string): string {
  return part.replace(/~1/g, "/").replace(/~0/g, "~");
}
