try {
    const canvas = require('canvas');
    console.log('✅ Canvas successfully loaded!');
    console.log('Canvas version:', canvas.version);
    const cvs = canvas.createCanvas(200, 200);
    const ctx = cvs.getContext('2d');
    ctx.fillText('Hello World', 50, 50);
    console.log('✅ Canvas context and drawing test successful!');
} catch (e) {
    console.error('❌ Canvas failed to load:');
    console.error(e);
    if (e.code === 'MODULE_NOT_FOUND') {
        console.error('Hint: module not found.');
    } else {
        console.error('Hint: This is likely a missing system dependency (Cairo, Pango, etc.) or a DLL issue.');
    }
}
