import { HTTPException } from 'hono/http-exception';
import type { Context } from 'hono';
import type { ZodType } from 'zod';
import type { DeckIssue } from '@hsdeck/shared';

export type ErrorCode =
  'BAD_REQUEST' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'DECK_INVALID' | 'INTERNAL';

export class ApiError extends HTTPException {
  constructor(
    status: 400 | 401 | 403 | 404 | 422 | 500,
    public readonly code: ErrorCode,
    message: string,
    public readonly issues?: DeckIssue[] | unknown[],
  ) {
    super(status, { message });
  }

  toBody() {
    return { error: { code: this.code, message: this.message, issues: this.issues } };
  }
}

export const notFound = (what = 'Resource') => new ApiError(404, 'NOT_FOUND', `${what} not found`);
export const badRequest = (message: string, issues?: unknown[]) =>
  new ApiError(400, 'BAD_REQUEST', message, issues);

/** Parse a request body or query object with a zod schema, mapping failures to 400. */
export function parseWith<T>(schema: ZodType<T>, input: unknown, what = 'request'): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const issues = result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    throw badRequest(
      `Invalid ${what}: ${issues.map((i) => `${i.path || '(root)'}: ${i.message}`).join('; ')}`,
      issues,
    );
  }
  return result.data;
}

export async function parseJsonBody<T>(c: Context, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw badRequest('Body must be valid JSON');
  }
  return parseWith(schema, body, 'body');
}
