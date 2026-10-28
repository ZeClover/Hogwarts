type StartupCode='CONFIGURATION_MISSING'|'CONFIGURATION_INVALID'|'DATABASE_MIGRATIONS'|'DATABASE_CONNECTION'|'APPLICATION_INITIALIZATION';
export class StartupProblem extends Error {
  readonly code: StartupCode;
  readonly missing: string[];
  constructor(code: StartupCode, message: string, missing: string[] = []) {
    super(message);this.name='StartupProblem';this.code=code;this.missing=missing;
  }
}
