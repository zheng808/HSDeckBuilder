import type { DeckIssue } from '@hsdeck/shared';
import { getOwnerToken } from '../lib/owner-token';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly issues?: DeckIssue[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}

export function errorMessage(err: unknown): string {
  if (isApiError(err)) {
    if (err.issues?.length) return err.issues.map((i) => i.message).join(' ');
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return 'Something went wrong.';
}

type QueryValue = string | number | boolean | undefined | null;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, QueryValue>;
}

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

interface ErrorEnvelope {
  error?: { code?: string; message?: string; issues?: DeckIssue[] };
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    accept: 'application/json',
    'x-owner-token': getOwnerToken(),
  };
  if (options.body !== undefined) headers['content-type'] = 'application/json';

  const res = await fetch(buildUrl(path, options.query), {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let data: unknown = undefined;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = undefined;
    }
  }

  if (!res.ok) {
    const envelope = (data ?? {}) as ErrorEnvelope;
    throw new ApiError(
      res.status,
      envelope.error?.code ?? `HTTP_${res.status}`,
      envelope.error?.message ?? `Request failed (${res.status})`,
      envelope.error?.issues,
    );
  }
  return data as T;
}
