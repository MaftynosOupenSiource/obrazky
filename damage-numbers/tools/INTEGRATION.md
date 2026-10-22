# Live Paper 1.20.4 smoke test

Run only against a **disposable local offline-mode server**, with the built plugin
installed and RCON enabled. The harness reads the RCON password directly from that
server's `server.properties`; it never prints it. It connects only to loopback.

The test joins two protocol clients (`DamageTester`, `DamageObserver`), builds a
small safe platform, and temporarily grants those players operator status. It
changes gamerules in the disposable world. It temporarily sets the installed
plugin configuration to a longer number lifetime and toggles custom-font mode;
the original configuration is restored in `finally`, followed by a plugin reload.
Do not run it against a live player world.

Install the exact protocol-client dependency outside the source tree, then run:

```sh
npm install --prefix /tmp/damage-test-client --save-exact minecraft-protocol@1.54.0
NODE_PATH=/tmp/damage-test-client/node_modules \
  node tools/integration_smoke.cjs --server-dir /path/to/disposable-paper-server
```

The running server's `server-port` and `rcon.port` are read from its properties.
The test covers real damage and health loss, delivery of fallback number metadata
to both players, floating movement, expiry, `MISS` for a zero-damage preview
without changing health, the exact custom font key in entity/client metadata, and
removal of live number entities on plugin reload. It also attempts a real vanilla
zero-damage command and reports a skipped result if the server does not dispatch
that event. No-op attacks and events cancelled by protection plugins are not
promised to generate `MISS`.

Results are written to `target/integration-results.json`; an assertion or cleanup
failure gives a nonzero process exit code. Resource-pack pixels require a real
Minecraft client to assess visually. Protocol checks verify font assignment and
entity behavior, not rendered appearance. Server shutdown/disable is not exercised
by this harness because the server lifecycle belongs to its caller.
