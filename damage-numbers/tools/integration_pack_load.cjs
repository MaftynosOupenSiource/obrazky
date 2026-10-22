#!/usr/bin/env node
'use strict';

// Disposable loopback Paper1.20.4 only. Status replies are deliberately simulated:
// this tests server delivery/state handling, not rendering in a Minecraft client.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const project = path.resolve(__dirname, '..');
const arg = process.argv.indexOf('--server-dir');
if (arg < 0 || !process.argv[arg + 1]) {
  console.error('Usage: NODE_PATH=<minecraft-protocol node_modules> node tools/integration_pack_load.cjs --server-dir <disposable offline server>');
  process.exit(2);
}
const serverDir = path.resolve(process.argv[arg + 1]);
const properties = Object.fromEntries(fs.readFileSync(path.join(serverDir, 'server.properties'), 'utf8')
  .split(/\r?\n/).filter(line => line && !line.startsWith('#')).map(line => {
    const at = line.indexOf('=');
    return [line.slice(0, at), line.slice(at + 1)];
  }));
assert.equal(properties['online-mode'], 'false', 'Use a disposable offline server only');
assert.equal(properties['enable-rcon'], 'true');
const mc = require('minecraft-protocol');
const dependencyRequire = createRequire(require.resolve('minecraft-protocol'));
const mcData = dependencyRequire('minecraft-data')('1.20.4');
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const PACK_URL = 'https://raw.githubusercontent.com/MaftynosOupenSiource/obrazky/c525a7eb7113c22673e3c60298b548d33c20dda5/damage-numbers/releases/1.0.0/OrangeDamageNumbers-resource-pack.zip';
const PACK_HASH = '40f68175beec7e3b0738a9691c7332ef6a866e09';
const OTHER_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const font = 'orange_damage:numbers';
const idBytes = crypto.createHash('md5').update('orange_damage:brush_numbers', 'utf8').digest();
idBytes[6] = (idBytes[6] & 15) | 48;
idBytes[8] = (idBytes[8] & 63) | 128;
const idHex = idBytes.toString('hex');
const PACK_ID = `${idHex.slice(0, 8)}-${idHex.slice(8, 12)}-${idHex.slice(12, 16)}-${idHex.slice(16, 20)}-${idHex.slice(20)}`;

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
    for (const pending of this.pending.values()) { clearTimeout(pending.timeout); pending.reject(error); }
    this.pending.clear();
  }
  read(data) {
    this.buffer = Buffer.concat([this.buffer, data]);
    while (this.buffer.length >= 4) {
      const size = this.buffer.readInt32LE(0);
      if (size < 10 || size > 4 * 1024 * 1024) return this.fail(new Error('Invalid RCON frame'));
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
      const timeout = setTimeout(() => { this.pending.delete(id); reject(new Error('RCON timed out')); }, 10000);
      this.pending.set(id, { resolve, reject, timeout, auth });
      this.socket.write(packet);
    });
  }
  command(text) { return this.send(2, text); }
  close() { this.socket.end(); }
  static async connect() {
    const socket = net.createConnection({ host: '127.0.0.1', port: Number(properties['rcon.port']) });
    await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('error', reject); });
    const connection = new Rcon(socket);
    // The password is used only for local RCON authentication and never logged.
    await connection.send(3, properties['rcon.password'], true);
    return connection;
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

function bot() {
  const client = mc.createClient({ host: '127.0.0.1', port: Number(properties['server-port']),
    username: 'PackDeliveryTest', version: '1.20.4', auth: 'offline', disableChatSigning: true });
  const state = { client, joined: false, positioned: false, errors: [], displays: new Map(), metadata: [], packPackets: [] };
  client.on('error', error => state.errors.push(String(error.message)));
  client.on('kick_disconnect', packet => state.errors.push('Disconnected: ' + JSON.stringify(packet.reason)));
  client.on('login', () => { state.joined = true; });
  client.on('position', packet => {
    client.write('teleport_confirm', { teleportId: packet.teleportId });
    client.write('position_look', { x: packet.x, y: packet.y, z: packet.z,
      yaw: packet.yaw, pitch: packet.pitch, onGround: true });
    state.positioned = true;
  });
  client.on('add_resource_pack', packet => state.packPackets.push({ kind: 'add', ...packet }));
  client.on('remove_resource_pack', packet => state.packPackets.push({ kind: 'remove', ...packet }));
  client.on('spawn_entity', packet => {
    if (packet.type === mcData.entitiesByName.text_display.id) state.displays.set(packet.entityId, packet);
  });
  client.on('entity_metadata', packet => {
    if (state.displays.has(packet.entityId)) state.metadata.push(packet.metadata);
  });
  return state;
}

function hasField(value, key, expected) {
  if (typeof value === 'string') {
    try { return hasField(JSON.parse(value), key, expected); } catch { return false; }
  }
  if (!value || typeof value !== 'object') return false;
  const candidate = value[key];
  if (candidate === expected || candidate && candidate.value === expected) return true;
  return Object.values(value).some(child => hasField(child, key, expected));
}

const report = { server: 'Paper1.20.4', startedAt: new Date().toISOString(),
  scope: 'Real server packets with simulated resource-pack status replies; no rendered-client or actual client download claim.',
  packUrl: PACK_URL, packSha1: PACK_HASH, packId: PACK_ID, checks: [] };
function passed(name, evidence) { report.checks.push({ name, passed: true, evidence }); console.log('PASS ' + name); }
let rcon;
let originalConfig;
let configPath;
let player;

async function main() {
  rcon = await Rcon.connect();
  configPath = path.join(serverDir, 'plugins', 'OrangeDamageNumbers', 'config.yml');
  originalConfig = fs.readFileSync(configPath, 'utf8');
  let config = originalConfig
    .replace(/^(\s*lifetime-ticks:\s*)\S+/m, (_match, prefix) => prefix + '20')
    .replace(/^(\s*assume-installed:\s*)\S+/m, (_match, prefix) => prefix + 'false')
    .replace(/^(\s*url:\s*).*$/m, (_match, prefix) => prefix + "'" + PACK_URL + "'")
    .replace(/^(\s*sha1:\s*).*$/m, (_match, prefix) => prefix + "'" + PACK_HASH + "'");
  assert.match(config, /assume-installed: false/);
  assert.ok(config.includes(PACK_URL) && config.includes(PACK_HASH));
  fs.writeFileSync(configPath, config);
  await rcon.command('damagenumbers reload');
  await rcon.command('fill -8 63 -8 8 63 8 minecraft:stone');
  await rcon.command('fill -8 64 -8 8 68 8 minecraft:air');
  player = bot();
  await until(async () => player.joined && player.positioned, Boolean, 'Protocol client failed to spawn', 30000);
  await rcon.command('op PackDeliveryTest');
  await rcon.command('tp PackDeliveryTest 0.5 64 0.5');
  await until(async () => player.packPackets, packets => packets.some(packet => packet.kind === 'add'),
    'Plugin did not send a resource-pack offer');
  const offer = player.packPackets.find(packet => packet.kind === 'add');
  assert.equal(offer.uuid, PACK_ID);
  assert.equal(offer.url, PACK_URL);
  assert.equal(offer.hash, PACK_HASH);
  assert.equal(offer.forced, false);
  assert.equal(player.packPackets.filter(packet => packet.kind === 'remove').length, 0);
  passed('pack_offer_has_exact_url_hash_uuid_and_is_additive', {
    packet: 'add_resource_pack', uuid: offer.uuid, url: offer.url, hash: offer.hash,
    forced: offer.forced, removePackets: 0,
    limitation: 'No existing visual resource-pack stack was loaded in this protocol-only client.' });

  async function assertFont(expected, name, text = '12.5') {
    // Same URL/hash preserves loaded state; reload only clears previous display entities.
    await rcon.command('damagenumbers reload');
    player.metadata.length = 0;
    player.client.chat('/dn test ' + (text === 'MISS' ? '0' : text));
    await until(async () => player.metadata, values => values.some(value => hasField(value, 'text', text)),
      'Number metadata was not delivered for ' + name);
    const data = await rcon.command('data get entity @e[type=minecraft:text_display,tag=orange_damage_number,limit=1] text');
    assert.ok(data.includes(text), 'Unexpected entity text: ' + data);
    const containsFont = data.includes(font);
    assert.equal(containsFont, expected, name + ': incorrect server entity font');
    const matching = player.metadata.filter(value => hasField(value, 'text', text));
    assert.ok(matching.length > 0);
    assert.equal(matching.some(value => hasField(value, 'font', font)), expected,
      name + ': incorrect actual client metadata font');
    passed(name, { customFont: expected, entityText: data });
  }
  async function status(uuid, result) {
    player.client.write('resource_pack_receive', { uuid, result });
    await sleep(150);
  }
  await assertFont(false, 'fallback_before_pack_loaded');
  await status(PACK_ID, 3);
  await assertFont(false, 'accepted_does_not_enable_custom_font');
  await status(PACK_ID, 4);
  await assertFont(false, 'downloaded_does_not_enable_custom_font');
  await status(OTHER_ID, 0);
  await assertFont(false, 'unrelated_uuid_success_does_not_enable_custom_font');
  await status(PACK_ID, 0);
  await assertFont(true, 'own_success_enables_custom_font');
  await assertFont(true, 'own_success_enables_custom_miss', 'MISS');
  await status(OTHER_ID, 7);
  await assertFont(true, 'unrelated_uuid_discard_does_not_disable_custom_font');
  await status(PACK_ID, 7);
  await assertFont(false, 'own_discard_restores_fallback');
  await status(PACK_ID, 0);
  await assertFont(true, 'own_success_reenables_custom_font');
  await status(PACK_ID, 6);
  await assertFont(false, 'own_failed_reload_restores_fallback');
  assert.equal(player.packPackets.filter(packet => packet.kind === 'remove').length, 0);
  passed('no_pack_remove_packet_during_reoffers_or_status_changes', {
    addPackets: player.packPackets.filter(packet => packet.kind === 'add').length, removePackets: 0 });
  assert.deepEqual(player.errors, []);
  report.passed = true;
}

(async () => {
  try { await main(); }
  catch (error) { report.passed = false; report.failure = String(error.stack || error); console.error(report.failure); process.exitCode = 1; }
  finally {
    try {
      if (originalConfig && configPath) { fs.writeFileSync(configPath, originalConfig); await rcon.command('damagenumbers reload'); report.configurationRestored = true; }
      if (rcon) {
        await rcon.command('deop PackDeliveryTest');
        const state = await rcon.command('execute if entity @e[type=minecraft:text_display,tag=orange_damage_number]');
        report.noEntitiesRemaining = /Test failed/i.test(state);
        assert.equal(report.noEntitiesRemaining, true, 'Cleanup left damage number entities');
      }
    } catch (error) { report.cleanupFailure = String(error.message); report.passed = false; process.exitCode = 1; }
    player?.client.end();
    rcon?.close();
    report.finishedAt = new Date().toISOString();
    fs.mkdirSync(path.join(project, 'target'), { recursive: true });
    fs.writeFileSync(path.join(project, 'target', 'pack-delivery-results.json'), JSON.stringify(report, null, 2) + '\n');
    console.log('Report: target/pack-delivery-results.json');
  }
})();
