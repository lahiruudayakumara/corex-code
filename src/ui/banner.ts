const COREX_CODE_BANNER = String.raw`
  ____ ___  ____  _______  __   ____ ___  ____  _____
 / ___/ _ \|  _ \| ____\ \/ /  / ___/ _ \|  _ \| ____|
| |  | | | | |_) |  _|  \  /  | |  | | | | | | |  _|
| |__| |_| |  _ <| |___ /  \  | |__| |_| | |_| | |___
 \____\___/|_| \_\_____/_/\_\  \____\___/|____/|_____|
`.replace(/^\n/, "").trimEnd();

export function renderBanner(version: string): string {
  return `${COREX_CODE_BANNER}\n\n  Local-first coding agent · v${version}`;
}

export { COREX_CODE_BANNER };
