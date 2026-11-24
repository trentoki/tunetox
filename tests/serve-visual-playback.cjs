// Dependency-free local preview server. Run with Node; serves this checkout only.
const http = require("node:http");
const https = require("node:https");
const os = require("node:os");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const secure = process.argv.includes("--https");
const types = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".pdf": "application/pdf" };
// LAN preview only: allow loopback and private IPv4 clients, never public addresses.
function isLocalClient(address = "") {
  const octets = address.replace(/^::ffff:/, "").split(".").map(Number);
  if (octets.length !== 4 || octets.some(value => !Number.isInteger(value) || value < 0 || value > 255)) return false;
  const [first, second] = octets;
  return first === 127 || first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168);
}
const addresses = Object.values(os.networkInterfaces()).flat()
  .filter(item => item.family === "IPv4" && !item.internal && isLocalClient(item.address))
  .map(item => item.address);
// Certificate subject names follow current interfaces, never a hardcoded LAN IP.
if (process.argv.includes("--addresses")) {
  console.log(["localhost", "127.0.0.1", ...new Set(addresses)].join(" "));
  process.exit(0);
}
let tls;
if (secure) {
  try {
    tls = {
      cert: fs.readFileSync(process.env.TUNETOX_TLS_CERT || path.join(root, ".certs", "localhost.pem")),
      key: fs.readFileSync(process.env.TUNETOX_TLS_KEY || path.join(root, ".certs", "localhost-key.pem"))
    };
  } catch {
    console.error("HTTPS requires a trusted development certificate. See docs/LOCAL_HTTPS.md. HTTP remains available without --https.");
    process.exit(1);
  }
}
const server = secure ? https.createServer(tls) : http.createServer();
server.on("request", (request, response) => {
  if (!isLocalClient(request.socket.remoteAddress)) {
    response.writeHead(403).end("Local-network access only");
    return;
  }
  let file;
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    file = path.resolve(root, "." + (pathname === "/" ? "/tunetox.html" : pathname));
    if (!file.startsWith(root + path.sep)) throw new Error("Outside preview root");
    if (path.relative(root, file).split(path.sep).some(part => part.startsWith("."))) throw new Error("Hidden path");
    if (/\.(pem|key|p12|pfx|crt|cer)$/i.test(file)) throw new Error("Certificate path");
    // A symlink must not expose files outside this checkout (including TLS keys).
    const resolved = fs.realpathSync(file);
    if (!resolved.startsWith(root + path.sep) || path.relative(root, resolved).split(path.sep).some(part => part.startsWith(".")))
      throw new Error("Outside preview root");
  } catch {
    response.writeHead(400).end("Invalid path");
    return;
  }
  fs.readFile(file, (error, content) => {
    if (error) { response.writeHead(404).end("Not found"); return; }
    response.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
    response.end(content);
  });
});
server.on("error", error => { console.error("Preview server:", error.message); process.exitCode = 1; });
const port = secure ? 8443 : 8080;
server.listen(port, "0.0.0.0", () => {
  const protocol = secure ? "https" : "http";
  console.log(`TuneTox local preview: ${protocol}://127.0.0.1:${port}/tunetox.html`);
  for (const address of addresses) console.log(`LAN: ${protocol}://${address}:${port}/tunetox.html`);
});
