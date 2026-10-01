const test = require('tap').test;
const fs = require('fs');
const path = require('path');

const readShader = name => fs.readFileSync(path.join(__dirname, '../../src/shaders', name), 'utf8');

// Extensions such as SharkPool's Looks Expanded patch the sprite shaders with find-and-replace,
// so these lines have to stay exactly as they are in TurboWarp.
test('sprite shaders keep the lines extensions patch', t => {
    const vert = readShader('sprite.vert');
    t.ok(vert.includes('#if !(defined(DRAW_MODE_line) || defined(DRAW_MODE_background))\n'));
    t.ok(vert.includes('void main() {'));
    t.ok(vert.includes('v_texCoord = a_texCoord;'));
    t.ok(vert.includes('vec4(a_position, 0, 1)'));

    const frag = readShader('sprite.frag');
    t.ok(frag.includes('uniform sampler2D u_skin;'));
    t.ok(frag.includes('#if defined(ENABLE_color) || defined(ENABLE_brightness)'));
    t.ok(frag.includes('gl_FragColor.rgb = clamp(gl_FragColor.rgb / (gl_FragColor.a + epsilon), 0.0, 1.0);'));
    t.end();
});

test('pen triangles are not drawn with the sprite shaders', t => {
    t.notOk(readShader('sprite.vert').includes('DRAW_MODE_triangle'));
    t.notOk(readShader('sprite.frag').includes('DRAW_MODE_triangle'));
    t.end();
});
