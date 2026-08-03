import Ajv2020 from 'ajv/dist/2020';
import type { ErrorObject } from 'ajv';
import type { Pack } from '../../contracts/pack';
import schema from '../../contracts/pack.schema.json';

export type { Pack } from '../../contracts/pack';

export class PackValidationError extends Error {
  readonly errors: ErrorObject[];

  constructor(errors: ErrorObject[]) {
    super(`Pack validation failed with ${errors.length} error(s)`);
    this.name = 'PackValidationError';
    this.errors = errors;
  }
}

const ajv = new Ajv2020({ strict: false, allErrors: true });
const validate = ajv.compile<Pack>(schema as Record<string, unknown>);

export async function loadPack(
  readFile: (path: string) => Promise<string>,
  path: string,
): Promise<Pack> {
  const raw = await readFile(path);
  const data: unknown = JSON.parse(raw);
  if (!validate(data)) {
    throw new PackValidationError(validate.errors ?? []);
  }
  return data;
}
