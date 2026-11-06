# Live Paper1.20.4 validation

Run only on a disposable offline-mode loopback server with SmoothWither
installed in its default damage-preserving mode and RCON enabled. The harness
reads the temporary RCON password from server.properties without displaying it.
It changes gamerules and a small platform in the test world, joins two offline
players, and temporarily grants them operator status. Effects and operator
status are cleared afterwards; the test server can then be stopped by its owner.

```sh
npm install --prefix /tmp/wither-test-client --save-exact minecraft-protocol@1.54.0
NODE_PATH=/tmp/wither-test-client/node_modules \
  node tools/integration_smoke.cjs --server-dir /path/to/disposable-paper-server
```

Checks actual Wither potion ticks, health loss and damage-event packets while
the redundant player velocity packet is absent. Also checks a protocol-supplied
jump arc, ordinary damage, native attacker knockback during Wither, teleport
corrections, and client connection health. This does not emulate rendered
movement or human keyboard input. Results go to target/integration-results.json;
an assertion or cleanup error causes a nonzero exit status.
