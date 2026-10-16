'use strict'
// Unit tests for the E.D.I.T.H. parsers + scoring. Run: npm run test:unit
const assert = require('node:assert/strict')
const { score, parseRegDword, parseServiceState, parseListening, TEMPISH } = require('../edith')

assert.equal(parseRegDword('\r\nHKEY_LOCAL_MACHINE\\X\r\n    EnableFirewall    REG_DWORD    0x1\r\n', 'EnableFirewall'), 1)
assert.equal(parseRegDword('    EnableFirewall    REG_DWORD    0x0', 'EnableFirewall'), 0)
assert.equal(parseRegDword('    fDenyTSConnections    REG_DWORD    1', 'fDenyTSConnections'), 1)
assert.equal(parseRegDword('ERROR: The system was unable to find the specified registry key or value.', 'EnableLUA'), null)
assert.equal(parseRegDword('', 'x'), null)

assert.equal(parseServiceState('SERVICE_NAME: WinDefend\r\n        TYPE               : 10  WIN32_OWN_PROCESS\r\n        STATE              : 4  RUNNING\r\n'), 'running')
assert.equal(parseServiceState('        STATE              : 1  STOPPED'), 'stopped')
assert.equal(parseServiceState('[SC] EnumQueryServicesStatus:OpenService FAILED 1060'), null)

const netstat = `
  Proto  Local Address          Foreign Address        State           PID
  TCP    0.0.0.0:135            0.0.0.0:0              LISTENING       1180
  TCP    0.0.0.0:3389           0.0.0.0:0              LISTENING       900
  TCP    127.0.0.1:5000         0.0.0.0:0              LISTENING       777
  TCP    [::]:445               [::]:0                 LISTENING       4
  TCP    [::1]:8080             [::]:0                 LISTENING       555
  TCP    192.168.1.20:139       0.0.0.0:0              LISTENING       4
  TCP    192.168.1.20:50111     142.250.77.14:443      ESTABLISHED     4321
`
assert.deepEqual(parseListening(netstat).map((l) => l.port).sort((a, b) => a - b), [135, 139, 445, 3389])

assert.deepEqual(score([{ status: 'ok' }, { status: 'ok' }]), { score: 100, level: 'green' })
assert.deepEqual(score([{ status: 'warn', penalty: 15 }, { status: 'ok' }]), { score: 85, level: 'amber' })
assert.deepEqual(score([{ status: 'bad', penalty: 30 }]), { score: 70, level: 'red' })
assert.deepEqual(score([{ status: 'unknown', penalty: 99 }]), { score: 100, level: 'green' }, 'unknown never counts against you')
assert.equal(score([{ status: 'warn', penalty: 50 }, { status: 'warn', penalty: 50 }, { status: 'warn', penalty: 50 }]).score, 0)

assert.ok(TEMPISH.test('C:\\Users\\x\\AppData\\Local\\Temp\\evil.exe'))
assert.ok(TEMPISH.test('C:\\Users\\x\\Downloads\\setup.exe'))
assert.ok(!TEMPISH.test('C:\\Program Files\\App\\app.exe'))

console.log('edith: ALL PASS')
