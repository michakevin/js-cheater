export function parsePath(path) {
  const parts = [];
  // eslint-disable-next-line no-useless-escape
  const regex = /[^.\[\]]+|\[(.*?)\]/g;
  let match;
  while ((match = regex.exec(path))) {
    let part = match[0];
    if (part[0] === "[") {
      part = match[1];
      if (
        (part.startsWith("'") && part.endsWith("'")) ||
        (part.startsWith('"') && part.endsWith('"'))
      ) {
        const quote = part[0];
        part = part.slice(1, -1);
        const escRegex = new RegExp("\\\\" + quote, "g");
        part = part.replace(escRegex, quote);
      }
      if (
        /^\d+$/.test(part) &&
        !(match[1].startsWith("'") || match[1].startsWith('"'))
      ) {
        part = Number(part);
      }
    }
    parts.push(part);
  }
  return parts;
}
