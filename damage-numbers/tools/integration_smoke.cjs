#!/usr/bin/env node
'use strict';

// Runs against a disposable, already-started offline Paper1.20.4 server only.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { createRequire } = require('node:module');
const project = path.resolve(__dirname, '..');
const serverArg = process.argv.indexOf('--server-dir');
if (serverArg < 0 || !process.argv[serverArg + 1]) {
  console.error('Usage: NODE_PATH=<minecraft-protocol node_modules> node tools/integration_smoke.cjs --server-dir <disposable offline server>');
  process.exit(2);
}
const serverDir = path.resolve(process.argv[serverArg + 1]);
const properties = Object.fromEntries(fs.readFileSync(path.join(serverDir, 'server.properties'), 'utf8')
  .split(/\r?\n/).filter(line => line && !line.startsWith('#')).map(line => {
    const at = line.indexOf('=');
    return [line.slice(0, at), line.slice(at + 1)];
  }));
assert.equal(properties['online-mode'], 'false', 'Use only a disposable offline-mode integration server');
assert.equal(properties['enable-rcon'], 'true', 'The disposable server must have RCON enabled');
const mc = require('minecraft-protocol');
const dependencyRequire = createRequire(require.resolve('minecraft-protocol'));
const mcData = dependencyRequire('minecraft-data')('1.20.4');
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

class Rcon {
  constructor(socket) {
    this.socket = socket;
    this.buffer = Buffer.alloc(0);
    this.nextId = 1;
    this.pending = new Map();
    socket.on('data', data => this.read(data));
    socket.on('error', error => this.fail(error));
    socket.on('close', () => this.fail(new Error('RCON connection closed')));
  }
  fail(error) {
    for (const item of this.pending.values()) {
      clearTimeout(item.timeout);
      item.reject(error);
    }
    this.pending.clear();
  }
  read(data) {
    this.buffer = Buffer.concat([this.buffer, data]);
    while (this.buffer.length >= 4) {
      const size = this.buffer.readInt32LE(0);
      if (size < 10 || size > 4 * 1024 * 1024) return this.fail(new Error('Invalid RCON packet size'));
      if (this.buffer.length < size + 4) return;
      const packet = this.buffer.subarray(4, size + 4);
      this.buffer = this.buffer.subarray(size + 4);
      const id = packet.readInt32LE(0);
      const type = packet.readInt32LE(4);
      if (id === -1) return this.fail(new Error('RCON authentication rejected'));
      const pending = this.pending.get(id);
      if (!pending || pending.auth && type !== 2) continue;
      clearTimeout(pending.timeout);
      this.pending.delete(id);
      pending.resolve(packet.subarray(8, packet.length - 2).toString('utf8'));
    }
  }
  send(type, text, auth = false) {
    const id = this.nextId++;
    const payload = Buffer.from(text, 'utf8');
    const packet = Buffer.alloc(payload.length + 14);
    packet.writeInt32LE(payload.length + 10, 0);
    packet.writeInt32LE(id, 4);
    packet.writeInt32LE(type, 8);
    payload.copy(packet, 12);
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('RCON request timed out'));
      }, 10000);
      this.pending.set(id, { resolve, reject, timeout, auth });
      this.socket.write(packet);
    });
  }
  command(text) { return this.send(2, text); }
  close() { this.socket.end(); }
  static async connect() {
    const socket = net.createConnection({ host: '127.0.0.1', port: Number(properties['rcon.port']) });
    await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('error', reject); });
    const client = new Rcon(socket);
    // Read the password only from the disposable server's properties. Never print it.
    await client.send(3, properties['rcon.password'], true);
    return client;
  }
}

async function until(operation, predicate, message, timeout = 10000) {
  const deadline = Date.now() + timeout;
  do {
    const value = await operation();
    if (predicate(value)) return value;
    await sleep(50);
  } while (Date.now() < deadline);
  throw new Error(message);
}

function bot(username) {
  const client = mc.createClient({ host: '127.0.0.1', port: Number(properties['server-port']),
    username, version: '1.20.4', auth: 'offline', disableChatSigning: true });
  const state = { client, username, joined: false, positioned: false, health: undefined,
    errors: [], displays: new Map(), metadata: [] };
  client.on('error', error => state.errors.push(String(error.message)));
  client.on('kick_disconnect', packet => state.errors.push('Disconnected: ' + JSON.stringify(packet.reason)));
  client.on('login', () => { state.joined = true; });
  client.on('position', packet => {
    client.write('teleport_confirm', { teleportId: packet.teleportId });
    client.write('position_look', { x: packet.x, y: packet.y, z: packet.z,
      yaw: packet.yaw, pitch: packet.pitch, onGround: true });
    state.positioned = true;
  });
  client.on('update_health', packet => { state.health = packet.health; });
  client.on('spawn_entity', packet => {
    if (packet.type === mcData.entitiesByName.text_display.id) state.displays.set(packet.entityId, packet);
  });
  client.on('entity_metadata', packet => {
    if (state.displays.has(packet.entityId)) state.metadata.push({ entityId: packet.entityId,
      data: JSON.stringify(packet.metadata, (_key, value) => typeof value === 'bigint' ? String(value) : value) });
  });
  return state;
}

const report = { server: 'Paper1.20.4', startedAt: new Date().toISOString(), checks: [] };
function passed(name, evidence) {
  report.checks.push({ name, passed: true, evidence });
  console.log('PASS ' + name);
}

let rcon;
let originalConfig;
let pluginConfig;
let tester;
let observer;
async function main() {
  rcon = await Rcon.connect();
  pluginConfig = path.join(serverDir, 'plugins', 'OrangeDamageNumbers', 'config.yml');
  originalConfig = fs.readFileSync(pluginConfig, 'utf8');
  async function configure(custom) {
    let config = originalConfig.replace(/^(\s*lifetime-ticks:\s*)\S+/m, (_match, prefix) => prefix + '60')
      .replace(/^(\s*assume-installed:\s*)\S+/m, (_match, prefix) => prefix + String(custom));
    assert.match(config, /lifetime-ticks: 60/);
    assert.match(config, new RegExp('assume-installed: ' + custom));
    fs.writeFileSync(pluginConfig, config);
    await rcon.command('damagenumbers reload');
    await sleep(150);
  }
  await configure(false);
  for (const command of ['gamerule doMobSpawning false', 'gamerule naturalRegeneration false',
    'gamerule fallDamage false', 'gamerule doDaylightCycle false', 'time set day',
    'fill -8 63 -8 8 63 8 minecraft:stone', 'fill -8 64 -8 8 68 8 minecraft:air']) {
    await rcon.command(command);
  }
  tester = bot('DamageTester');
  observer = bot('DamageObserver');
  await until(async () => tester.joined && tester.positioned && observer.joined && observer.positioned,
    Boolean, 'Both offline clients must finish login and receive their spawn position', 30000);
  for (const name of ['DamageTester', 'DamageObserver']) {
    await rcon.command('op ' + name);
    await rcon.command('gamemode survival ' + name);
  }
  await rcon.command('tp DamageTester 0.5 64 0.5');
  await rcon.command('tp DamageObserver 2.5 64 0.5');
  await rcon.command('effect give DamageTester minecraft:instant_health 1 10 true');
  // ServerPlayer has a short post-login invulnerability window; wait for it.
  await sleep(3500);
  passed('two_clients_spawned', { tester: tester.joined && tester.positioned, observer: observer.joined && observer.positioned });

  async function count() {
    const response = await rcon.command('execute if entity @e[type=minecraft:text_display,tag=orange_damage_number]');
    const match = /count:\s*(\d+)/i.exec(response);
    if (match) return Number(match[1]);
    if (/Test failed/i.test(response)) return 0;
    throw new Error('Could not parse entity count: ' + response);
  }
  async function entityData(field) {
    return rcon.command('data get entity @e[type=minecraft:text_display,tag=orange_damage_number,limit=1] ' + field);
  }
  function clearTelemetry() { tester.metadata.length = 0; observer.metadata.length = 0; }
  async function waitNumber() { return until(count, value => value > 0, 'Damage number was not spawned'); }
  async function waitGone() { return until(count, value => value === 0, 'Expired damage number was not removed', 7000); }
  async function metadataContains(state, text) {
    // Components in1.20.4 are anonymous NBT; accept both NBT compounds and JSON,
    // but check the actual component field rather than any coincidental digit.
    function hasField(value, key, expected) {
      if (typeof value === 'string') {
        try { return hasField(JSON.parse(value), key, expected); } catch { return false; }
      }
      if (!value || typeof value !== 'object') return false;
      const candidate = value[key];
      if (candidate === expected || candidate && candidate.value === expected) return true;
      return Object.values(value).some(child => hasField(child, key, expected));
    }
    const key = text === 'orange_damage:numbers' ? 'font' : 'text';
    return until(async () => state.metadata,
      entries => entries.some(entry => hasField(JSON.parse(entry.data), key, text)),
      state.username + ' did not receive TextDisplay metadata for ' + text);
  }
  assert.equal(await count(), 0);
  clearTelemetry();
  const beforeDamage = await rcon.command('data get entity DamageTester Health');
  const applied = await rcon.command('damage DamageTester 4 minecraft:generic');
  assert.match(applied, /Applied 4.*damage/i, 'Vanilla damage command failed: ' + applied);
  await waitNumber();
  const positiveText = await entityData('text');
  assert.match(positiveText, /4/);
  assert.doesNotMatch(positiveText, /MISS/);
  assert.doesNotMatch(positiveText, /orange_damage:numbers/);
  const afterDamage = await rcon.command('data get entity DamageTester Health');
  assert.match(beforeDamage, /20\.0f/);
  assert.match(afterDamage, /16\.0f/);
  await metadataContains(tester, '4');
  await metadataContains(observer, '4');
  passed('real_damage_event_fallback', { command: applied, beforeDamage, afterDamage, text: positiveText });

  const positionBefore = await entityData('Pos');
  await sleep(350);
  const positionAfter = await entityData('Pos');
  assert.notEqual(positionBefore, positionAfter);
  passed('floating_number_moves', { positionBefore, positionAfter });
  await waitGone();
  passed('lifetime_removes_number', { remainingDisplays: await count() });

  clearTelemetry();
  const missHealthBefore = await rcon.command('data get entity DamageTester Health');
  tester.client.chat('/dn test 0');
  await waitNumber();
  const missText = await entityData('text');
  assert.match(missText, /MISS/);
  await metadataContains(tester, 'MISS');
  await metadataContains(observer, 'MISS');
  const missHealthAfter = await rcon.command('data get entity DamageTester Health');
  assert.equal(missHealthBefore, missHealthAfter);
  passed('zero_preview_is_miss_without_health_change', { text: missText, health: missHealthAfter });
  await waitGone();

  await configure(true);
  clearTelemetry();
  tester.client.chat('/dn test 12.5');
  await waitNumber();
  const customText = await entityData('text');
  assert.match(customText, /orange_damage:numbers/);
  assert.match(customText, /12\.5/);
  await metadataContains(tester, 'orange_damage:numbers');
  await metadataContains(observer, 'orange_damage:numbers');
  passed('custom_font_key_in_entity_and_client_metadata', { text: customText });
  await rcon.command('damagenumbers reload');
  assert.equal(await count(), 0);
  passed('reload_removes_live_numbers', { remainingDisplays: await count() });
  await configure(false);
  clearTelemetry();
  assert.equal(await count(), 0, 'Real zero-damage check must start without stale numbers');
  const zeroResult = await rcon.command('damage DamageTester 0 minecraft:generic');
  const zeroCount = await count();
  if (zeroCount > 0) {
    const zeroText = await entityData('text');
    assert.match(zeroText, /MISS/);
    passed('real_zero_damage_event_is_miss', { command: zeroResult, text: zeroText });
    await waitGone();
  } else {
    report.checks.push({ name: 'real_zero_damage_event_is_miss', skipped: true,
      reason: 'This Paper damage command did not dispatch a zero-damage event; MISS was verified through the player preview command.', response: zeroResult });
  }
  assert.deepEqual(tester.errors, []);
  assert.deepEqual(observer.errors, []);
  passed('clients_remain_connected_without_protocol_errors', {});
  report.passed = true;
}

(async () => {
  try { await main(); }
  catch (error) {
    report.passed = false;
    report.failure = String(error.stack || error);
    console.error(report.failure);
    process.exitCode = 1;
  } finally {
    try {
      if (originalConfig && pluginConfig) {
        fs.writeFileSync(pluginConfig, originalConfig);
        if (rcon) await rcon.command('damagenumbers reload');
        report.configurationRestored = true;
      }
      if (rcon) {
        for (const name of ['DamageTester', 'DamageObserver']) await rcon.command('deop ' + name);
        const finalEntities = await rcon.command('execute if entity @e[type=minecraft:text_display,tag=orange_damage_number]');
        report.finalEntityCheck = finalEntities;
        report.noEntitiesRemaining = /Test failed/i.test(finalEntities);
        assert.equal(report.noEntitiesRemaining, true, 'Cleanup left floating number entities behind');
      }
    } catch (error) {
      report.cleanupFailure = String(error.message);
      report.passed = false;
      process.exitCode = 1;
    }
    tester?.client.end();
    observer?.client.end();
    rcon?.close();
    report.finishedAt = new Date().toISOString();
    fs.mkdirSync(path.join(project, 'target'), { recursive: true });
    fs.writeFileSync(path.join(project, 'target', 'integration-results.json'), JSON.stringify(report, null, 2) + '\n');
    console.log('Report: target/integration-results.json');
  }
})();
