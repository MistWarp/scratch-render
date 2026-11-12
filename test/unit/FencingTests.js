const test = require('tap').test;
global.window = {};
global.document = {createElement: () => ({getContext: () => ({})})};
const RenderWebGL = require('../../src/RenderWebGL');
const Drawable = require('../../src/Drawable');
const Rectangle = require('../../src/Rectangle');
const Skin = require('../../src/Skin');

const FENCE_WIDTH = 15;

class SizedSkin extends Skin {
    constructor (id, renderer, size) {
        super(id, renderer);
        this._size = size;
        this.fenceBoundsCalls = 0;
    }
    get size () {
        return this._size;
    }
    moveRotationCenter (x, y) {
        this._rotationCenter[0] = x;
        this._rotationCenter[1] = y;
        this.emitWasAltered();
    }
}

class CountingSkin extends SizedSkin {
    getFenceBounds (drawable, result) {
        this.fenceBoundsCalls++;
        return drawable.getAABB(result);
    }
}

const fakeRenderer = () => {
    const renderer = Object.create(RenderWebGL.prototype);
    renderer._allSkins = {};
    renderer._allDrawables = [];
    renderer._xRight = 240;
    renderer._yTop = 180;
    return renderer;
};

const fenceWithoutMemory = (renderer, drawable, position) => {
    let x = position[0];
    let y = position[1];
    const dx = x - drawable._position[0];
    const dy = y - drawable._position[1];
    const aabb = drawable.getAABB(new Rectangle());
    const inset = Math.floor(Math.min(aabb.width, aabb.height) / 2);
    const sx = renderer._xRight - Math.min(FENCE_WIDTH, inset);
    if (aabb.right + dx < -sx) {
        x = Math.ceil(drawable._position[0] - (sx + aabb.right));
    } else if (aabb.left + dx > sx) {
        x = Math.floor(drawable._position[0] + (sx - aabb.left));
    }
    const sy = renderer._yTop - Math.min(FENCE_WIDTH, inset);
    if (aabb.top + dy < -sy) {
        y = Math.ceil(drawable._position[1] - (sy + aabb.top));
    } else if (aabb.bottom + dy > sy) {
        y = Math.floor(drawable._position[1] + (sy - aabb.bottom));
    }
    return [x, y];
};

const makeRandom = seed => () => {
    seed = ((seed * 1103515245) + 12345) % 2147483648;
    return seed / 2147483648;
};

const makeWorld = SkinClass => {
    const renderer = fakeRenderer();
    const skins = [
        new SkinClass(1, renderer, [40, 30]),
        new SkinClass(2, renderer, [3, 200]),
        new SkinClass(3, renderer, [600, 500])
    ];
    skins[1].moveRotationCenter(1, 10);
    const drawable = new Drawable(0, renderer);
    renderer._allDrawables[0] = drawable;
    drawable.skin = skins[0];
    return {renderer, skins, drawable};
};

const runSequence = (t, seed, steps) => {
    const random = makeRandom(seed);
    const remembered = makeWorld(SizedSkin);
    const plain = makeWorld(SizedSkin);
    const special = [NaN, Infinity, -Infinity, 1e300, -1e300, 1e7, -1e7, 0, -0, 239.995, -239.995, 179.995];
    let fullPathCalls = 0;
    const getAABB = Drawable.prototype.getAABB;
    Drawable.prototype.getAABB = function (result) {
        if (this === remembered.drawable) fullPathCalls++;
        return getAABB.call(this, result);
    };
    let mismatch = null;
    try {
        for (let step = 0; step < steps && mismatch === null; step++) {
            const choice = random();
            const both = change => {
                change(remembered);
                change(plain);
            };
            if (choice < 0.03) {
                const scale = [5 + (random() * 400), 5 + (random() * 400)];
                both(world => world.drawable.updateScale(scale));
            } else if (choice < 0.06) {
                const direction = Math.floor(random() * 360) - 180;
                both(world => world.drawable.updateDirection(direction));
            } else if (choice < 0.08) {
                const index = Math.floor(random() * 3);
                both(world => {
                    world.drawable.skin = world.skins[index];
                });
            } else if (choice < 0.09) {
                const center = [random() * 50, random() * 50];
                both(world => world.drawable.skin.moveRotationCenter(center[0], center[1]));
            } else if (choice < 0.1) {
                const highQuality = random() < 0.5;
                both(world => world.drawable.setHighQuality(highQuality));
            } else {
                let x;
                let y;
                if (choice < 0.12) {
                    x = special[Math.floor(random() * special.length)];
                    y = special[Math.floor(random() * special.length)];
                } else if (choice < 0.5) {
                    x = remembered.drawable._position[0] + ((random() * 6) - 3);
                    y = remembered.drawable._position[1] + ((random() * 6) - 3);
                } else if (choice < 0.8) {
                    x = (random() * 480) - 240;
                    y = (random() * 360) - 180;
                } else {
                    x = (random() * 1200) - 600;
                    y = (random() * 900) - 450;
                }
                const expected = fenceWithoutMemory(plain.renderer, plain.drawable, [x, y]);
                const actual = remembered.renderer.getFencedPositionOfDrawable(0, [x, y]);
                if (!Object.is(actual[0], expected[0]) || !Object.is(actual[1], expected[1])) {
                    mismatch = `step ${step}: went to ${x}, ${y}, got ${actual} instead of ${expected}`;
                }
                both(world => world.drawable.updatePosition(expected));
            }
        }
    } finally {
        Drawable.prototype.getAABB = getAABB;
    }
    t.equal(mismatch, null, `seed ${seed}`);
    return fullPathCalls;
};

test('fencing gives the same position with and without remembered bounds', t => {
    let fullPathCalls = 0;
    const steps = 20000;
    for (const seed of [1, 2, 3, 4, 5]) {
        fullPathCalls += runSequence(t, seed, steps);
    }
    t.ok(fullPathCalls < steps * 5 * 0.6, `bounds were recomputed ${fullPathCalls} times in ${steps * 5} steps`);
    t.end();
});

test('a sprite moving well inside the stage does not recompute its bounds', t => {
    const {renderer, drawable} = makeWorld(SizedSkin);
    let transforms = 0;
    const calculateTransform = drawable._calculateTransform;
    drawable._calculateTransform = function () {
        transforms++;
        return calculateTransform.call(this);
    };
    for (let i = 0; i < 100; i++) {
        const position = renderer.getFencedPositionOfDrawable(0, [i - 50, 50 - i]);
        t.same(position, [i - 50, 50 - i]);
        drawable.updatePosition(position);
    }
    t.equal(transforms, 1);
    t.end();
});

test('a skin with its own fence bounds is asked on every move', t => {
    const {renderer, skins, drawable} = makeWorld(CountingSkin);
    for (let i = 0; i < 50; i++) {
        drawable.updatePosition(renderer.getFencedPositionOfDrawable(0, [i, i]));
    }
    t.equal(skins[0].fenceBoundsCalls, 50);
    t.end();
});

test('remembered bounds are dropped when the sprite changes shape', t => {
    const {renderer, drawable, skins} = makeWorld(SizedSkin);
    const results = [];
    const moveTo = (x, y) => {
        const expected = fenceWithoutMemory(renderer, drawable, [x, y]);
        const position = renderer.getFencedPositionOfDrawable(0, [x, y]);
        t.same(position, expected, `moving to ${x}, ${y}`);
        results.push(position[0] === x && position[1] === y ? 'free' : 'fenced');
        drawable.updatePosition(position);
    };
    moveTo(0, 0);
    moveTo(200, 0);
    moveTo(300, 0);
    drawable.updateScale([1000, 1000]);
    moveTo(300, 0);
    drawable.updateScale([100, 100]);
    moveTo(300, 0);
    drawable.skin = skins[2];
    moveTo(500, 0);
    drawable.skin = skins[0];
    moveTo(500, 0);
    drawable.updateDirection(0);
    moveTo(0, 185);
    drawable.updateDirection(90);
    moveTo(0, 185);
    skins[0].moveRotationCenter(-200, 15);
    moveTo(100, 0);
    t.same(results, ['free', 'free', 'fenced', 'fenced', 'fenced', 'fenced', 'fenced', 'fenced', 'free', 'fenced']);
    t.end();
});

test('bounds measured very far away are not reused near the fence', t => {
    const {renderer, drawable} = makeWorld(SizedSkin);
    drawable.setHighQuality(true);
    drawable.updatePosition([3e16, 0]);
    for (const [x, y] of [[0, 0], [245.9, 0], [10, 0], [-245.9, 0]]) {
        const expected = fenceWithoutMemory(renderer, drawable, [x, y]);
        const position = renderer.getFencedPositionOfDrawable(0, [x, y]);
        t.same(position, expected, `moving to ${x}, ${y}`);
        drawable.updatePosition(position);
    }
    t.end();
});
