try {
    const { createCanvas } = require('@napi-rs/canvas');
    console.log('✅ @napi-rs/canvas successfully loaded!');
    const cvs = createCanvas(200, 200);
    const ctx = cvs.getContext('2d');
    ctx.fillText('Hello World', 50, 50);
    const buf = cvs.toBuffer('image/png');
    console.log('✅ Buffer generated, size:', buf.length);
    console.log('✅ @napi-rs/canvas test successful!');
} catch (e) {
    console.error('❌ @napi-rs/canvas failed:');
    console.error(e);
}
