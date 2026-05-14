export class WzMapsIndexError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class MapDatabaseFetchError extends WzMapsIndexError {
  readonly url: string;
  readonly status: number;
  readonly statusText: string;

  constructor(url: string, status: number, statusText: string) {
    super(`Failed to fetch ${url}: ${status} ${statusText}`);
    this.url = url;
    this.status = status;
    this.statusText = statusText;
  }
}

export class MapDatabaseSchemaError extends WzMapsIndexError {
  constructor(message: string) {
    super(message);
  }
}

export class TemplateResolutionError extends WzMapsIndexError {
  readonly template: string;
  readonly pointer: string;

  constructor(template: string, pointer: string) {
    super(`Could not resolve template pointer ${JSON.stringify(pointer)} in ${JSON.stringify(template)}`);
    this.template = template;
    this.pointer = pointer;
  }
}
