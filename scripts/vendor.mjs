// Copies the latin fonts from node_modules into assets/fonts (self-hosted).
// GSAP was removed: motion is now CSS + Web Animations API (see assets/js/main.js).
import { copyFileSync } from 'node:fs';
const n = 'node_modules';
const fonts = { 'dm-sans': ['400-normal', '500-normal', '600-normal', '700-normal'], 'dm-mono': ['400-normal', '500-normal'], 'playfair-display': ['500-normal', '600-normal', '700-normal', '500-italic', '600-italic'] };
for (const [fam, ws] of Object.entries(fonts)) for (const w of ws) copyFileSync(`${n}/@fontsource/${fam}/files/${fam}-latin-${w}.woff2`, `assets/fonts/${fam}-latin-${w}.woff2`);
console.log('Vendor files updated.');
