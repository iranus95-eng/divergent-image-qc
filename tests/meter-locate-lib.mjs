import assert from 'node:assert/strict';
import * as L from '../supabase/functions/meter-locate-api/lib.ts';
assert.deepEqual(L.parseMru('dmjk0174-048100'),{route:'DMJK0174',seq:48100,mru:'DMJK0174-048100'});
assert.equal(L.parseMru('xx'),null);
assert.equal(L.hasMoo('88 บ.หนองหัวช้าง ต.หนองแปน'),false);
assert.equal(L.hasMoo('368/1 ม.1 บ.มะเกลือเก่า'),true);
assert.equal(L.hasMoo('10 หมู่ที่ 8 ต.x'),true);
assert.equal(L.cleanAddress('94 ม.4 ต.สูงเนิน   (14.89199,101.91412)'),'94 ม.4 ต.สูงเนิน');
const rows=[['FSUN0167-187573',14.86968,101.80221],['FSUN0167-187590',14.89199,101.91412],['FSUN0167-187591',14.89199,101.91412],['FSUN0167-187600',14.86989,101.80229],['FSUN0167-187620',14.87049,101.80194],['FSUN0167-187499',null,null]]
  .map(([mru,latitude,longitude],i)=>({mru,ca:'c'+i,address:'a',latitude,longitude}));
const n=L.pickNeighbours(rows,187590,'c1');
assert.deepEqual(n.before.map(x=>x.mru),['FSUN0167-187573']);
assert.deepEqual(n.after.map(x=>x.mru),['FSUN0167-187600','FSUN0167-187620']);
assert.ok(Math.abs(n.estimate.lat-14.869785)<1e-6);
assert.equal(n.spread_m<50,true);
assert.equal(L.haversine({lat:14.86958,lng:101.80254},{lat:14.8695830818034,lng:101.802398541677}),15);
console.log('PASS: meter-locate lib');
