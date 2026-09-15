import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {HostSession,normalizeManifest}=require('../shared/host-core.js');

const manifest=normalizeManifest(JSON.parse(fs.readFileSync(new URL('../examples/demo-cartridge.json',import.meta.url),'utf8')));
assert.equal(manifest.id,'axm-connected-monolith-demo');
assert.equal(manifest.capabilities.length,4);

const human=new HostSession({surface:'test-human',userType:'human'});
const machine=new HostSession({surface:'test-machine',userType:'machine'});
human.load(manifest);
machine.load(manifest);

assert.deepEqual(human.listCapabilities(),machine.listCapabilities(),'human and machine capability truth drifted');
assert.equal(human.snapshot().counts.verified,2);
assert.equal(human.snapshot().permissions['local-files'],'unreviewed');

const blocked=human.proposeAction('creation-fabric','propose',{goal:'test'});
assert.equal(blocked.execution,'not_executed');
assert.equal(blocked.reason,'permission_not_approved');

human.setPermission('local-files','approved');
const unwired=human.proposeAction('creation-fabric','propose',{goal:'test'});
assert.equal(unwired.execution,'not_executed');
assert.equal(unwired.reason,'runtime_adapter_not_wired');

human.disconnect();
assert.equal(human.snapshot().connection.connected,false);

console.log('AXM monolith interface smoke tests: PASS');
