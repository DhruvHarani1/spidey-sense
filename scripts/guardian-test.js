'use strict'
// Unit tests for guardian's pure parsers. Run: npm run test:unit
const assert = require('node:assert/strict')
const { parseNetstat, parseTasklist, parseRegRun, isPrivateIp, newItems } = require('../guardian')

const netstat = `
Active Connections

  Proto  Local Address          Foreign Address        State           PID
  TCP    0.0.0.0:135            0.0.0.0:0              LISTENING       1180
  TCP    192.168.1.20:50111     142.250.77.14:443      ESTABLISHED     4321
  TCP    192.168.1.20:50112     192.168.1.1:80         ESTABLISHED     999
  TCP    127.0.0.1:5000         127.0.0.1:50113        ESTABLISHED     777
  TCP    192.168.1.20:50120     20.190.151.9:443       TIME_WAIT       0
  TCP    192.168.1.20:50121     172.20.0.4:443         ESTABLISHED     555
  TCP    192.168.1.20:50122     172.217.5.1:443        ESTABLISHED     4322
`
const conns = parseNetstat(netstat)
assert.deepEqual(conns.map((c) => c.pid), [4321, 4322], 'only public established connections')

const tl = '"System Idle Process","0","Services","0","8 K"\r\n"chrome.exe","4321","Console","1","210,332 K"\r\n"Unknown Tool.exe","4322","Console","1","9,100 K"\r\n'
const map = parseTasklist(tl)
assert.equal(map.get(4321), 'chrome')
assert.equal(map.get(4322), 'Unknown Tool')

const reg = String.raw`
HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run
    OneDrive    REG_SZ    "C:\Program Files\Microsoft OneDrive\OneDrive.exe" /background
    Some Tool    REG_SZ    C:\x\tool.exe
`
const items = parseRegRun('K', reg)
assert.equal(items.length, 2)
assert.equal(items[1], 'K|Some Tool|C:\\x\\tool.exe')

assert.ok(isPrivateIp('10.1.2.3') && isPrivateIp('192.168.0.1') && isPrivateIp('172.31.0.1') && isPrivateIp('::1'))
assert.ok(!isPrivateIp('172.32.0.1') && !isPrivateIp('8.8.8.8') && !isPrivateIp('2607:f8b0::1'))

assert.deepEqual(newItems(['a', 'b', 'c'], new Set(['a', 'c'])), ['b'])
console.log('guardian parsers: ALL PASS')
