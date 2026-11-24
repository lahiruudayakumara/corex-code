
const COREX_CODE_BANNER = "COREX CODE";

export function renderBanner(version: string): string {
  const footer = `Type /help for commands · v${version}`;

  return `${COREX_CODE_BANNER} · ${footer}`;
}

export { COREX_CODE_BANNER };
