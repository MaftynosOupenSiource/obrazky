#!/usr/bin/env node
'use strict';

// Disposable loopback Paper1.20.4 only. This observes real damage/velocity packets,
// not rendered camera motion or human keyboard input.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const mc = require('minecraft-protocol');
const project = path.resolve(__dirname, '..');
const index = process.argv.indexOf('--server-dir');
if (index < 0 || !process.argv[index + 1]) {
  console.error('Usage: NODE_PATH=<minecraft-protocol node_modules> node tools/integration_smoke.cjs --server-dir <disposable server>');
  process.exit(2);
}
const serverDir = path.resolve(process.argv[index + 1]);
const props = Object.fromEntries(fs.readFileSync(path.join(serverDir, 'server.properties'), 'utf8')
  .split(/\r?\n/).filter(line => line && !line.startsWith('#')).map(line => {
    const at = line.indexOf('='); return [line.slice(0, at), line.slice(at + 1)];
  }));
assert.equal(props['online-mode'], 'false', 'Disposable offline server required');
assert.equal(props['enable-rcon'], 'true');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

class Rcon {
  constructor(socket) {
    this.socket = socket; this.buffer = Buffer.alloc(0); this.nextId = 1; this.pending = new Map();
    socket.on('data', data => this.read(data));
    socket.on('error', error => this.fail(error));
    socket.on('close', () => this.fail(new Error('RCON closed')));
  }
  fail(error) {
    for (const p of this.pending.values()) { clearTimeout(p.timeout); p.reject(error); }
    this.pending.clear();
  }
  read(data) {
    this.buffer = Buffer.concat([this.buffer, data]);
    while (this.buffer.length >= 4) {
      const size = this.buffer.readInt32LE();
      if (size < 10 || size > 4 * 1024 * 1024) return this.fail(new Error('Invalid RCON frame'));
      if (this.buffer.length < size + 4) return;
      const packet = this.buffer.subarray(4, size + 4); this.buffer = this.buffer.subarray(size + 4);
      const id = packet.readInt32LE(); const type = packet.readInt32LE(4);
      if (id === -1) return this.fail(new Error('RCON authentication failed'));
      const p = this.pending.get(id);
      if (!p || p.auth && type !== 2) continue;
      clearTimeout(p.timeout); this.pending.delete(id);
      p.resolve(packet.subarray(8, packet.length - 2).toString('utf8'));
    }
  }
  send(type, text, auth = false) {
    const id = this.nextId++; const textBytes = Buffer.from(text); const packet = Buffer.alloc(textBytes.length + 14);
    packet.writeInt32LE(textBytes.length + 10); packet.writeInt32LE(id, 4); packet.writeInt32LE(type, 8); textBytes.copy(packet, 12);
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { this.pending.delete(id); reject(new Error('RCON timeout')); }, 10000);
      this.pending.set(id, { resolve, reject, timeout, auth }); this.socket.write(packet);
    });
  }
  command(text) { return this.send(2, text); }
  close() { this.socket.end(); }
  static async connect() {
    const socket = net.createConnection({ host: '127.0.0.1', port: Number(props['rcon.port']) });
    await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('error', reject); });
    const connection = new Rcon(socket);
    // Never print the local test-server password.
    await connection.send(3, props['rcon.password'], true); return connection;
  }
}

async function until(operation, predicate, message, timeout = 10000) {
  const deadline = Date.now() + timeout;
  do { const value = await operation(); if (predicate(value)) return value; await sleep(50); } while (Date.now() < deadline);
  throw new Error(message);
}

function bot(username) {
  const client = mc.createClient({ host: '127.0.0.1', port: Number(props['server-port']), username,
    version: '1.20.4', auth: 'offline', disableChatSigning: true });
  const state = { client, username, id: null, positioned: false, health: null, position: null,
    velocities: [], damages: [], effects: [], teleports: [], errors: [] };
  client.on('login', packet => { state.id = packet.entityId; });
  client.on('position', packet => {
    state.position = { x: packet.x, y: packet.y, z: packet.z };
    state.teleports.push(packet);
    client.write('teleport_confirm', { teleportId: packet.teleportId });
    client.write('position_look', { ...state.position, yaw: packet.yaw, pitch: packet.pitch, onGround: true });
    state.positioned = true;
  });
  client.on('entity_velocity', packet => { if (packet.entityId === state.id) state.velocities.push({ ...packet, receivedAt: Date.now() }); });
  client.on('damage_event', packet => { if (packet.entityId === state.id) state.damages.push({ ...packet, receivedAt: Date.now() }); });
  client.on('entity_effect', packet => { if (packet.entityId === state.id) state.effects.push(packet); });
  client.on('update_health', packet => { state.health = packet.health; });
  client.on('error', error => state.errors.push(error.message));
  client.on('kick_disconnect', packet => state.errors.push('Disconnected: ' + JSON.stringify(packet.reason)));
  return state;
}

const report = { server: 'Paper1.20.4', startedAt: new Date().toISOString(),
  scope: 'Actual potion ticks and server/client protocol packets; no rendered or physical-keyboard movement claim.', checks: [] };
const passed = (name, evidence) => { report.checks.push({ name, passed: true, evidence }); console.log('PASS ' + name); };
let rcon, tester, attacker;

async function main() {
  rcon = await Rcon.connect();
  for (const command of ['gamerule doMobSpawning false', 'gamerule naturalRegeneration false',
    'gamerule fallDamage false', 'gamerule doDaylightCycle false', 'time set day',
    'fill -8 63 -8 8 63 8 minecraft:stone', 'fill -8 64 -8 8 70 8 minecraft:air']) await rcon.command(command);
  tester = bot('WitherTester'); attacker = bot('WitherAttacker');
  await until(async () => tester.id !== null && tester.positioned && attacker.id !== null && attacker.positioned,
    Boolean, 'Both clients must fully spawn', 30000);
  for (const p of [tester, attacker]) {
    await rcon.command('op ' + p.username); await rcon.command('gamemode survival ' + p.username);
    await rcon.command('effect clear ' + p.username);
  }
  await rcon.command('tp WitherTester 0.5 64 0.5'); await rcon.command('tp WitherAttacker 2.5 64 0.5');
  await rcon.command('effect give WitherTester minecraft:instant_health 1 10 true');
  await sleep(3500); // Vanilla post-login invulnerability.
  passed('two_clients_fully_spawned', { tester: tester.id, attacker: attacker.id });
  async function health() {
    const result = await rcon.command('data get entity WitherTester Health');
    const match = /:\s*([\d.]+)f/.exec(result); assert.ok(match, result); return Number(match[1]);
  }
  function clearTelemetry() { tester.velocities.length = 0; tester.damages.length = 0; tester.effects.length = 0; }
  async function clearAndHeal() {
    await rcon.command('effect clear WitherTester');
    await rcon.command('effect give WitherTester minecraft:instant_health 1 10 true');
    await sleep(1100); clearTelemetry();
  }
  await clearAndHeal();
  const before = await health();
  const witherResult = await rcon.command('effect give WitherTester minecraft:wither 8 2 true');
  assert.match(witherResult, /Applied effect Wither/);
  await sleep(2300);
  const after = await health();
  report.witherObservation = { before, after, velocities: [...tester.velocities],
    damages: [...tester.damages], effects: [...tester.effects] };
  assert.equal(before, 20); assert.ok(after < before && after > 0, 'Wither must keep damaging natively');
  assert.ok(tester.effects.some(p => p.effectId === 19), 'Wither potion effect must remain present');
  assert.ok(tester.damages.length >= 2, 'Native damage events must continue to reach client');
  assert.equal(tester.velocities.length, 0, 'Wither-only damage must not send player velocity corrections');
  passed('wither_damage_and_effect_preserved_without_velocity_resync', {
    before, after, nativeDamagePackets: tester.damages.length, playerVelocityPackets: tester.velocities.length,
    effectPackets: tester.effects.filter(p => p.effectId === 19).length });

  // Send a normal client-position jump arc while the effect still damages.
  clearTelemetry();
  const jumpHealthBefore = await health();
  const x0 = .5, z0 = .5;
  const ys = [64.42, 64.75, 65.0, 65.16, 65.24, 65.23, 65.15, 64.98, 64.73, 64.40, 64.0];
  const samples = [];
  for (let i = 0; i < ys.length; i++) {
    samples.push({ x: x0 + (i + 1) * .10, y: ys[i], sentAt: Date.now() });
    tester.client.write('position_look', { x: x0 + (i + 1) * .10, y: ys[i], z: z0,
      yaw: 0, pitch: 0, onGround: i === ys.length - 1 });
    await sleep(50);
  }
  const pos = await rcon.command('data get entity WitherTester Pos');
  assert.match(pos, /1\.6[0-9]*d/);
  const jumpHealthAfter = await health();
  report.jumpObservation = { before: jumpHealthBefore, after: jumpHealthAfter,
    samples, serverPosition: pos, velocities: [...tester.velocities], damages: [...tester.damages] };
  assert.ok(jumpHealthAfter < jumpHealthBefore && tester.damages.length > 0,
    'A native Wither tick must occur during the supplied jump arc');
  assert.equal(tester.velocities.length, 0, 'Wither may not resync velocity during a client jump arc');
  passed('client_jump_arc_accepted_while_wither_active', { serverPosition: pos,
    healthBefore: jumpHealthBefore, healthAfter: jumpHealthAfter, nativeDamagePackets: tester.damages.length,
    playerVelocityPackets: tester.velocities.length,
    limitation: 'Protocol-supplied jump arc; actual keyboard input and rendering are not emulated.' });

  await clearAndHeal();
  const genericBefore = await health();
  const genericResult = await rcon.command('damage WitherTester 4 minecraft:generic');
  assert.match(genericResult, /Applied 4.*damage/);
  await until(async () => tester.velocities.length, n => n > 0, 'Normal damage velocity packet was incorrectly suppressed');
  assert.equal(await health(), genericBefore - 4);
  passed('other_damage_health_and_velocity_preserved', { before: genericBefore, after: await health(),
    velocityPackets: tester.velocities.length });

  await clearAndHeal();
  await rcon.command('tp WitherTester 0.5 64 0.5');
  await rcon.command('tp WitherAttacker 2.5 64 0.5');
  await rcon.command('item replace entity WitherAttacker weapon.mainhand with minecraft:diamond_sword');
  await rcon.command('effect give WitherTester minecraft:wither 8 0 true');
  // Wither I ticks every2s. Attack between ticks after the1s damage immunity
  // window and freshly equipped sword cooldown, so native knockback is expected.
  await sleep(1400); clearTelemetry();
  const attackBefore = await health();
  // A real player attack runs Player.attack (including its knockback/velocity
  // path); the vanilla /damage command only calls damage processing directly.
  attacker.client.write('use_entity', { target: tester.id, mouse: 1, sneaking: false });
  await sleep(250);
  report.attackObservation = { before: attackBefore, after: await health(),
    velocities: [...tester.velocities], damages: [...tester.damages] };
  await until(async () => tester.velocities, values => values.some(p => {
    const v = p.velocity; return Math.abs(v.x) > 0 || Math.abs(v.z) > 0;
  }), 'Real attacker knockback must remain while Wither is active');
  assert.ok(await health() < attackBefore);
  passed('attacker_knockback_preserved_with_wither_active', { before: attackBefore, after: await health(),
    velocityPackets: tester.velocities });

  const teleportsBefore = tester.teleports.length;
  const teleported = await rcon.command('tp WitherTester 3.5 64 3.5');
  await until(async () => tester.teleports.length, count => count > teleportsBefore, 'Teleport correction must be delivered');
  assert.deepEqual(tester.position, { x: 3.5, y: 64, z: 3.5 });
  passed('teleport_preserved_with_wither_active', { response: teleported, position: tester.position });
  assert.deepEqual(tester.errors, []); assert.deepEqual(attacker.errors, []);
  passed('clients_remain_connected_without_protocol_errors', {});
  report.passed = true;
}

(async () => {
  try { await main(); }
  catch (error) { report.passed = false; report.failure = String(error.stack || error); console.error(report.failure); process.exitCode = 1; }
  finally {
    try {
      if (rcon) {
        for (const name of ['WitherTester', 'WitherAttacker']) {
          await rcon.command('effect clear ' + name); await rcon.command('deop ' + name);
        }
        report.effectsCleared = true;
      }
    } catch (error) { report.cleanupFailure = error.message; report.passed = false; process.exitCode = 1; }
    tester?.client.end(); attacker?.client.end(); rcon?.close();
    report.finishedAt = new Date().toISOString();
    fs.mkdirSync(path.join(project, 'target'), { recursive: true });
    fs.writeFileSync(path.join(project, 'target/integration-results.json'), JSON.stringify(report, null, 2) + '\n');
    console.log('Report: target/integration-results.json');
  }
})();
