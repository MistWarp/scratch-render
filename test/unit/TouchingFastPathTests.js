const test = require('tap').test;

global.window = {};
global.document = {
    createElement: () => ({getContext: () => {}})
};
global.ImageData = class {
    constructor (data, width, height) {
        this.data = data;
        this.width = width;
        this.height = height;
    }
};

const twgl = require('twgl.js');
const Drawable = require('../../src/Drawable');
const MockSkin = require('../fixtures/MockSkin');
const Rectangle = require('../../src/Rectangle');

const makeRandom = seed => {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4294967296;
    };
};

const mockRenderer = drawable => ({
    skinWasAltered: () => {
        drawable._skinWasAltered();
    }
});

const makeDrawable = (random, width, height) => {
    const drawable = new Drawable(null, {});
    const skin = new MockSkin(0, mockRenderer(drawable));
    drawable.skin = skin;
    skin.size = [width, height];
    skin.rotationCenter = [width / 2, height / 2];
    const data = new Uint8ClampedArray(width * height * 4);
    for (let index = 0; index < data.length; index += 4) {
        data[index] = Math.floor(random() * 256);
        data[index + 1] = Math.floor(random() * 256);
        data[index + 2] = Math.floor(random() * 256);
        const roll = random();
        data[index + 3] = roll < 0.5 ? 0 : (roll < 0.75 ? 255 : Math.floor(random() * 256));
    }
    skin._silhouette.update(new global.ImageData(data, width, height));
    drawable.updateCPURenderAttributes();
    return drawable;
};

const directions = [90, 0, 45, -90, 180, 137.5, 33.3];
const scales = [100, 50, 200, 37, 310];

const place = (random, drawable) => {
    drawable.updateProperties({
        position: [Math.floor(random() * 60) - 30, Math.floor(random() * 60) - 30],
        direction: directions[Math.floor(random() * directions.length)],
        scale: [scales[Math.floor(random() * scales.length)], scales[Math.floor(random() * scales.length)]]
    });
    drawable.updateCPURenderAttributes();
};

const snappedBounds = drawable => {
    const bounds = drawable.getFastBounds(new Rectangle());
    bounds.snapToInt();
    return bounds;
};

const slowTouchingPair = (first, second, bounds) => {
    const point = twgl.v3.create();
    for (let x = bounds.left; x <= bounds.right; x++) {
        point[0] = x;
        for (let y = bounds.bottom; y <= bounds.top; y++) {
            point[1] = y;
            if (first.isTouching(point) && second.isTouching(point)) {
                return true;
            }
        }
    }
    return false;
};

const comparePairs = (t, random, first, second, rounds) => {
    const point = twgl.v3.create();
    let touching = 0;
    let mismatches = 0;
    for (let round = 0; round < rounds; round++) {
        place(random, first);
        place(random, second);
        const bounds = Rectangle.intersect(snappedBounds(first), snappedBounds(second), new Rectangle());
        const expected = slowTouchingPair(first, second, bounds);
        const actual = Drawable.isTouchingPair(first, second, bounds, point);
        if (expected) touching++;
        if (expected !== actual) mismatches++;
    }
    t.equal(mismatches, 0);
    return touching;
};

test('touching pair matches the point by point test', t => {
    const random = makeRandom(1);
    const first = makeDrawable(random, 23, 17);
    const second = makeDrawable(random, 9, 31);
    t.ok(first.getPlainTouchingSilhouette());
    const touching = comparePairs(t, random, first, second, 400);
    t.ok(touching > 20);
    t.ok(touching < 400);
    t.end();
});

test('touching pair ignores effects that do not move pixels', t => {
    const random = makeRandom(2);
    const first = makeDrawable(random, 23, 17);
    const second = makeDrawable(random, 9, 31);
    first.updateProperties({ghost: 50, color: 25});
    second.updateProperties({brightness: -30});
    first.updateCPURenderAttributes();
    second.updateCPURenderAttributes();
    t.ok(first.getPlainTouchingSilhouette());
    t.ok(second.getPlainTouchingSilhouette());
    comparePairs(t, random, first, second, 200);
    t.end();
});

test('touching pair falls back for effects that move pixels', t => {
    const random = makeRandom(3);
    for (const effect of ['fisheye', 'whirl', 'pixelate', 'mosaic']) {
        const first = makeDrawable(random, 23, 17);
        const second = makeDrawable(random, 9, 31);
        first.updateProperties({[effect]: 50});
        first.updateCPURenderAttributes();
        t.equal(first.getPlainTouchingSilhouette(), null);
        t.equal(first.getPlainColorSilhouette(), null);
        comparePairs(t, random, first, second, 60);
        comparePairs(t, random, second, first, 60);
    }
    t.end();
});

test('touching pair falls back for a skin with its own touching test', t => {
    const random = makeRandom(4);
    const first = makeDrawable(random, 23, 17);
    const second = makeDrawable(random, 9, 31);
    second.skin.isTouchingNearest = () => true;
    t.equal(second.getPlainTouchingSilhouette(), null);
    const touching = comparePairs(t, random, first, second, 100);
    t.ok(touching > 0);
    t.end();
});

test('touching pair is false while a silhouette has no pixel data', t => {
    const random = makeRandom(5);
    const first = makeDrawable(random, 23, 17);
    const second = makeDrawable(random, 9, 31);
    second.skin._silhouette._colorData = null;
    const bounds = Rectangle.intersect(snappedBounds(first), snappedBounds(second), new Rectangle());
    t.equal(slowTouchingPair(first, second, bounds), false);
    t.equal(Drawable.isTouchingPair(first, second, bounds, twgl.v3.create()), false);
    t.end();
});

test('plain point test matches isTouching', t => {
    const random = makeRandom(6);
    const drawable = makeDrawable(random, 23, 17);
    const point = twgl.v3.create();
    let mismatches = 0;
    let touching = 0;
    for (let round = 0; round < 60; round++) {
        place(random, drawable);
        const silhouette = drawable.getPlainTouchingSilhouette();
        const bounds = snappedBounds(drawable);
        for (let x = bounds.left - 2; x <= bounds.right + 2; x++) {
            for (let y = bounds.bottom - 2; y <= bounds.top + 2; y++) {
                point[0] = x;
                point[1] = y;
                const expected = Boolean(drawable.isTouching(point));
                const actual = Drawable.isTouchingPlain(
                    drawable._inverseMatrix, silhouette._colorData, silhouette._width, silhouette._height,
                    drawable.isTouching === drawable._isTouchingLinear, point[0], point[1]);
                if (expected) touching++;
                if (expected !== actual) mismatches++;
            }
        }
    }
    t.equal(mismatches, 0);
    t.ok(touching > 0);
    t.end();
});

test('plain color sample matches sampleColor4b', t => {
    const random = makeRandom(7);
    const point = twgl.v3.create();
    const expected = new Uint8ClampedArray(4);
    const actual = new Uint8ClampedArray(4);
    let mismatches = 0;
    let opaque = 0;
    for (const effects of [{}, {ghost: 50}, {color: 25, brightness: -30}, {brightness: 40, ghost: 10}]) {
        const drawable = makeDrawable(random, 23, 17);
        drawable.updateProperties(effects);
        for (let round = 0; round < 40; round++) {
            place(random, drawable);
            const silhouette = drawable.getPlainColorSilhouette();
            const bounds = snappedBounds(drawable);
            for (let x = bounds.left - 2; x <= bounds.right + 2; x++) {
                for (let y = bounds.bottom - 2; y <= bounds.top + 2; y++) {
                    point[0] = x;
                    point[1] = y;
                    Drawable.sampleColor4b(point, drawable, expected);
                    Drawable.samplePlainColor4b(point[0], point[1], drawable, silhouette, actual);
                    if (expected[3] > 0) opaque++;
                    if (expected[0] !== actual[0] || expected[1] !== actual[1] ||
                        expected[2] !== actual[2] || expected[3] !== actual[3]) {
                        mismatches++;
                    }
                }
            }
        }
    }
    t.equal(mismatches, 0);
    t.ok(opaque > 0);
    t.end();
});

test('snapped fast bounds follow the drawable', t => {
    const random = makeRandom(8);
    const drawable = makeDrawable(random, 23, 17);
    for (let round = 0; round < 50; round++) {
        place(random, drawable);
        const expected = snappedBounds(drawable);
        const actual = drawable.getSnappedFastBounds();
        t.same(
            [actual.left, actual.right, actual.bottom, actual.top],
            [expected.left, expected.right, expected.bottom, expected.top]
        );
    }
    drawable.skin.size = [40, 12];
    drawable.skin.rotationCenter = [20, 6];
    const resized = snappedBounds(drawable);
    const cached = drawable.getSnappedFastBounds();
    t.same(
        [cached.left, cached.right, cached.bottom, cached.top],
        [resized.left, resized.right, resized.bottom, resized.top]
    );
    t.end();
});
