// Static server for e2e fixtures. Reachable as localhost and 127.0.0.1, which gives two origins.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, posix } from 'node:path';

const ROOT = 'tests/fixtures';
const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.css': 'text/css' };

createServer(async (req, res) => {
  // posix.normalize on an absolute path cannot climb above the root, so no traversal out of ROOT.
  const path = posix.normalize(new URL(req.url ?? '/', 'http://x').pathname).slice(1);
  try {
    const body = await readFile(join(ROOT, path || 'blank.html'));
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(4173);
