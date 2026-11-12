const test = require('tap').test;
global.window = {};
global.document = {createElement: () => ({getContext: () => ({})})};
const PenSkin = require('../../src/PenSkin');

const fakePenSkin = (width, height, quality) => {
    const skin = Object.create(PenSkin.prototype);
    skin._renderer = {enterDrawRegion: () => {}};
    skin.instancedRendering = true;
    skin.attribute_data = new Float32Array(4096);
    skin.attribute_index = 0;
    skin.renderQuality = quality;
    skin._size = [width * quality, height * quality];
    skin._silhouetteDirty = false;
    return skin;
};

const region = skin => [skin._dirtyLeft, skin._dirtyRight, skin._dirtyBottom, skin._dirtyTop];

const expectedRegion = (skin, lines) => {
    let left = Infinity;
    let right = -Infinity;
    let bottom = Infinity;
    let top = -Infinity;
    for (const [diameter, x0, y0, x1, y1] of lines) {
        const quality = skin.renderQuality;
        const radius = (diameter * quality * 0.5) + 2;
        const halfWidth = skin._size[0] * 0.5;
        const halfHeight = skin._size[1] * 0.5;
        left = Math.min(left, halfWidth + (Math.min(x0, x1) * quality) - radius);
        right = Math.max(right, halfWidth + (Math.max(x0, x1) * quality) + radius);
        bottom = Math.min(bottom, halfHeight - (Math.max(y0, y1) * quality) - radius);
        top = Math.max(top, halfHeight - (Math.min(y0, y1) * quality) + radius);
    }
    return [left, right, bottom, top];
};

const draw = (skin, lines) => {
    for (const [diameter, x0, y0, x1, y1] of lines) {
        skin._drawLineOnBuffer({diameter, color4f: [1, 0, 0, 1]}, x0, y0, x1, y1);
    }
};

test('a pen line dirties the box around it whichever way it points', t => {
    const directions = [
        [3, -10, -20, 30, 40],
        [3, 30, 40, -10, -20],
        [3, -10, 40, 30, -20],
        [3, 30, -20, -10, 40],
        [7, 5, 5, 5, 5],
        [1, -240, 180, 240, -180]
    ];
    for (const quality of [1, 2]) {
        for (const line of directions) {
            const skin = fakePenSkin(480, 360, quality);
            draw(skin, [line]);
            t.equal(skin._silhouetteDirty, true);
            t.same(region(skin), expectedRegion(skin, [line]), `quality ${quality}, line ${line.join(' ')}`);
        }
    }
    t.end();
});

test('several pen lines dirty the box around all of them', t => {
    const lines = [];
    let seed = 12345;
    const random = () => {
        seed = ((seed * 1103515245) + 12345) % 2147483648;
        return seed / 2147483648;
    };
    for (let i = 0; i < 200; i++) {
        lines.push([
            1 + Math.floor(random() * 20),
            (random() * 600) - 300, (random() * 500) - 250,
            (random() * 600) - 300, (random() * 500) - 250
        ]);
    }
    const skin = fakePenSkin(480, 360, 1);
    for (let count = 1; count <= lines.length; count++) {
        draw(skin, [lines[count - 1]]);
        if (count % 20 === 0 || count < 5) {
            t.same(region(skin), expectedRegion(skin, lines.slice(0, count)), `after ${count} lines`);
        }
    }
    t.end();
});

test('a clean pen layer starts its dirty box from the next mark', t => {
    const skin = fakePenSkin(480, 360, 1);
    skin._markSilhouetteDirty(10, 20, 30, 40);
    skin._markSilhouetteDirty(15, 18, 5, 35);
    t.same(region(skin), [10, 20, 5, 40]);
    skin._silhouetteDirty = false;
    skin._markSilhouetteDirty(100, 110, 120, 130);
    t.same(region(skin), [100, 110, 120, 130]);
    t.end();
});
