
const COREX_CODE_BANNER = String.raw`
  ___ ___  ___  ___ __  __   ___ ___  ___  ___
 / __/ _ \| _ \| __|\ \/ /  / __/ _ \|   \| __|
| (_| (_) |   /| _|  >  <  | (_| (_) | |) | _|
 \___\___/|_|_\|___|/_/\_\  \___\___/|___/|___|
`.replace(/^\n/, "").trimEnd();

export function renderBanner(version: string): string {
  const footer = `Type /help for commands · v${version}`;

  const width = Math.max(
    ...COREX_CODE_BANNER.split("\n").map(line => line.length)
  );

  return [
    COREX_CODE_BANNER,
    "",
    footer.padStart(
      Math.floor((width + footer.length) / 2)
    ),
  ].join("\n");
}

export { COREX_CODE_BANNER };
