# Local HTTPS for iPad audio testing

The same dependency-free preview server supports HTTP (8080) and optional HTTPS
(8443). Run each command in its own Terminal from the project root:

```sh
node tests/serve-visual-playback.cjs
node tests/serve-visual-playback.cjs --https
```

HTTP is unchanged. HTTPS requires a locally trusted certificate first. Neither
mode publishes the app to the internet: requests are limited to loopback/private
IPv4 clients. Use a trusted Wi-Fi network; do not configure router port forwarding
or a public tunnel. macOS may require permission for Node to accept local incoming
connections. VPN/client isolation can prevent devices from reaching one another.

## One-time certificate setup (human action)

`mkcert` was not installed when this mode was added. No tool was installed and no
system trust store was changed automatically. Install the official
[mkcert](https://github.com/FiloSottile/mkcert) using your preferred supported
method. If Homebrew is already installed, its command is `brew install mkcert`;
installing Homebrew itself is not required by TuneTox. Then:

```sh
mkcert -install
mkdir -p .certs
mkcert -cert-file .certs/localhost.pem -key-file .certs/localhost-key.pem $(node tests/serve-visual-playback.cjs --addresses)
node tests/serve-visual-playback.cjs --https
```

`mkcert -install` creates a development CA and asks to trust it on this Mac. Review
that system permission yourself. `--addresses` prints localhost, loopback, and
current private IPv4 interface addresses; the certificate covers those addresses.
No LAN IP is hardcoded. If Wi-Fi/DHCP changes the Mac address, regenerate the leaf
certificate with the same command and restart HTTPS. The CA need not be replaced.

The server prints the exact current URLs. On the Mac use
`https://127.0.0.1:8443/tunetox.html`. On the iPad, on the same Wi-Fi, use
`https://<Mac-LAN-IP>:8443/tunetox.html`, replacing the placeholder with a printed
LAN address. Do not use 127.0.0.1 on the iPad.

All `.certs/` contents and PEM/key files are ignored by Git and certificate paths
are blocked by the server. Keep keys private. Custom certificate paths outside
the checkout can be supplied with `TUNETOX_TLS_CERT` and `TUNETOX_TLS_KEY`.

## Trust the CA on the iPad

1. Run `mkcert -CAROOT` on the Mac. In that folder, send **only `rootCA.pem`** to
   your iPad using AirDrop. Never send `rootCA-key.pem` or the server private key.
2. Open the received certificate and install its profile in Settings (Profile
   Downloaded, or General → VPN & Device Management). Review its identity.
3. Open Settings → General → About → Certificate Trust Settings. Enable full
   trust for this development root. Merely installing the profile is insufficient.
4. Reopen the printed HTTPS URL in Safari. There must be no certificate/privacy
   warning. Do not use a warning bypass as evidence of a trusted secure context.

See [Apple's certificate trust instructions](https://support.apple.com/en-us/102390).
Trust only your own CA, and remove its profile when it is no longer needed.

## Device verification

With Safari's Develop/Web Inspector attached from the Mac, evaluate:

```js
window.isSecureContext // must be true
'audioWorklet' in AudioContext.prototype // must be true
```

Select a short, locally available, supported audio file with Load D1; allow its
waveform to finish loading. Press Play and gradually raise Main from its safe
initial 0%. Confirm sound, a moving playhead and retained Pause/resume position.
Tap or drag the full-song overview: the marker previews immediately and release
commits the seek, retaining paused/playing state (the end remains paused). Confirm
other decks are unaffected. Cancelled gestures must not seek. The glass cover
does not intercept pointer events. Select Futuristic and drag
Tempo upward/downward: verify rate changes with pitch preserved, smooth waveform
progress, and no scrolling during the gesture. Repeat on another deck and rotate
portrait/landscape. Pitch Demo must not change sound. Try a downloaded Files item
if an iCloud file is not locally available.

If secure context or AudioWorklet remains unavailable, first check certificate
trust, exact IP/SAN match, Safari version, and network reachability. Report the
console error before changing Audio or Behavior. File selection alone does not
prove decoding or worklet playback succeeds. Physical iPad playback and listening
remain manual verification; no physical-device success is claimed here.
