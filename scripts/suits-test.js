'use strict'
// Unit tests for XP, levels and suit unlocking. Run: npm run test:unit
const assert = require('node:assert/strict')
const S = require('../renderer/suits.js')

assert.equal(S.levelFor(0), 1)
assert.equal(S.levelFor(49), 1)
assert.equal(S.levelFor(50), 2)
assert.equal(S.levelFor(199), 2)
assert.equal(S.levelFor(200), 3)
assert.equal(S.levelFor(1800), 7)
assert.equal(S.xpAt(2), 50)
assert.equal(S.xpAt(3), 200)
assert.deepEqual(S.unlocked(1).map((s) => s.id), ['classic'])
assert.deepEqual(S.unlocked(4).map((s) => s.id), ['classic', 'midnight', 'gold', 'neon'])

// awarding
const st = S.fresh()
let r = S.award(st, 'focus', 'd1')
assert.equal(r.gained, 40)
assert.equal(r.levelUp, null)
r = S.award(st, 'eye', 'd1')
r = S.award(st, 'remind', 'd1')
assert.equal(st.xp, 50)
assert.equal(S.levelFor(st.xp), 2)
// the award that crossed the line reports the level-up and the suit it unlocked
const st2 = { ...S.fresh(), xp: 45 }
r = S.award(st2, 'eye', 'd1')
assert.equal(r.levelUp.level, 2)
assert.deepEqual(r.levelUp.suits.map((s) => s.id), ['midnight'])

// once-a-day sources
const st3 = S.fresh()
assert.equal(S.award(st3, 'bugle', 'mon').gained, 15)
assert.equal(S.award(st3, 'bugle', 'mon').gained, 0, 'same day: no second payout')
assert.equal(S.award(st3, 'bugle', 'tue').gained, 15, 'next day pays again')
assert.equal(S.award(st3, 'nonsense', 'mon').gained, 0)

// equipping
const st4 = { ...S.fresh(), xp: 0 }
assert.match(S.equip(st4, 'neon').error, /LEVEL 4/)
assert.equal(st4.suit, 'classic', 'locked suit is not equipped')
st4.xp = 450
assert.equal(S.equip(st4, 'neon').ok, true)
assert.equal(st4.suit, 'neon')
assert.equal(S.equip(st4, 'nope').ok, false)

// natural-language lookup
assert.equal(S.findSuit('wear the gold armor suit').id, 'gold')
assert.equal(S.findSuit('equip neon').id, 'neon')
assert.equal(S.findSuit('make it midnight').id, 'midnight')
assert.equal(S.findSuit('hello'), undefined)

// alert colours are never part of a suit
for (const s of S.SUITS) assert.ok(!('yellow' in s) && !('redHot' in s), `${s.id} must not recolour alerts`)

console.log('suits: ALL PASS')
