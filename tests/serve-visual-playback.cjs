// Dependency-free local preview server. Run with Node; serves this checkout only.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
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
http.createServer((request, response) => {
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
  } catch {
    response.writeHead(400).end("Invalid path");
    return;
  }
  fs.readFile(file, (error, content) => {
    if (error) { response.writeHead(404).end("Not found"); return; }
    response.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
    response.end(content);
  });
}).listen(8080, "0.0.0.0", () => console.log("TuneTox LAN preview on port 8080; open http://<Mac-LAN-IP>:8080/tunetox.html"));
