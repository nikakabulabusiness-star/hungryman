import { writeFileSync } from 'node:fs';
import { renderPage } from './public/views.js';
for (const route of ['/', '/shop/', '/business/', '/participate/', '/feedback/']) {
  const path = new URL(`./public${route}index.html`, import.meta.url);
  writeFileSync(path, renderPage(route));
}
console.log('Generated five complete static page entrypoints.');
