export function parsePath(path) {
  const parts = [];
  if (typeof path !== "string" || path.length === 0) return parts;

  let i = 0;
  while (i < path.length) {
    const c = path[i];
    if (c === ".") {
      i += 1;
      continue;
    }
    if (c === "[") {
      // Bracketed segment. May be quoted or a bare key (usually a number).
      i += 1; // skip [
      const quote = path[i] === "'" || path[i] === '"' ? path[i] : null;
      if (quote) {
        i += 1; // skip opening quote
        let value = "";
        while (i < path.length) {
          const ch = path[i];
          if (ch === "\\" && i + 1 < path.length) {
            value += path[i + 1];
            i += 2;
            continue;
          }
          if (ch === quote) break;
          value += ch;
          i += 1;
        }
        // skip closing quote if present
        if (i < path.length && path[i] === quote) i += 1;
        // skip closing bracket if present
        if (i < path.length && path[i] === "]") i += 1;
        parts.push(value);
      } else {
        let value = "";
        while (i < path.length && path[i] !== "]") {
          value += path[i];
          i += 1;
        }
        if (i < path.length && path[i] === "]") i += 1;
        parts.push(/^\d+$/.test(value) ? Number(value) : value);
      }
      continue;
    }
    // bare identifier segment
    let value = "";
    while (i < path.length && path[i] !== "." && path[i] !== "[") {
      value += path[i];
      i += 1;
    }
    if (value.length > 0) parts.push(value);
  }
  return parts;
}
