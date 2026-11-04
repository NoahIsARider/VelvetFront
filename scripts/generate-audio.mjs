import fs from 'node:fs'
import path from 'node:path'

const rate = 22050
const out = path.resolve('public/assets/audio')
fs.mkdirSync(out, { recursive: true })
let seed = 481516
const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1

function save(name, duration, render) {
  const count = Math.floor(rate * duration)
  const pcm = Buffer.alloc(count * 2)
  for (let i = 0; i < count; i++) {
    const value = Math.max(-1, Math.min(1, render(i / rate, i / count)))
    pcm.writeInt16LE(Math.round(value * 32767), i * 2)
  }
  const header = Buffer.alloc(44)
  header.write('RIFF', 0); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVEfmt ', 8)
  header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22)
  header.writeUInt32LE(rate, 24); header.writeUInt32LE(rate * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34)
  header.write('data', 36); header.writeUInt32LE(pcm.length, 40)
  fs.writeFileSync(path.join(out, `${name}.wav`), Buffer.concat([header, pcm]))
}

save('music', 12, (t) => .12*Math.sin(t*2*Math.PI*73)+.07*Math.sin(t*2*Math.PI*109.5)+.04*Math.sin(t*2*Math.PI*146))
save('ambience', 12, (t) => .025*random()+.035*Math.sin(t*2*Math.PI*.17)+.015*Math.sin(t*2*Math.PI*36))
save('rifle', .22, (t,p) => (random()*.7+Math.sin(t*2*Math.PI*(180-90*p))*.25)*Math.pow(1-p,5))
save('impact', .3, (t,p) => (random()*.55+Math.sin(t*2*Math.PI*65)*.35)*Math.pow(1-p,3))
save('death', .8, (t,p) => (Math.sin(t*2*Math.PI*(170-110*p))*.4+random()*.16)*Math.pow(1-p,2))
save('ui', .12, (t,p) => Math.sin(t*2*Math.PI*520)*Math.pow(1-p,4)*.35)
save('heal', .5, (t,p) => (Math.sin(t*2*Math.PI*(380+420*p))+.35*Math.sin(t*2*Math.PI*(570+300*p)))*(1-p)*.18)
save('boss', 1.2, (t,p) => (Math.sin(t*2*Math.PI*(52+8*Math.sin(t*9)))+random()*.22)*(1-p)*.24)
