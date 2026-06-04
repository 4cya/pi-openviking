export interface ResourceImportResult {
  status: string;
  rootUri: string;
  sourcePath: string;
  errors?: string[];
}

export interface ImportOptions {
  targetUri?: string;
  reason?: string;
  wait?: boolean;
}

export interface ResourceStore {
  importUrl(url: string, options?: ImportOptions, signal?: AbortSignal): Promise<ResourceImportResult>;
}
