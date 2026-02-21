/**
 * Turbopack 호환성 패치: @met4citizen/talkinghead
 *
 * 문제: talkinghead.mjs의 lipsyncGetProcessor()가 런타임 계산된 경로로
 *       import(moduleName)을 호출하는데, Turbopack은 이를 정적 분석할 수 없어 빌드 실패.
 * 해결: 동적 import를 정적 import 맵으로 교체.
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const filePath = resolve(
  __dirname,
  '../node_modules/@met4citizen/talkinghead/modules/talkinghead.mjs',
);

const ORIGINAL = `  lipsyncGetProcessor(lang, path="./") {
    if ( !this.lipsync.hasOwnProperty(lang) ) {
      const moduleName = path + 'lipsync-' + lang.toLowerCase() + '.mjs';
      const className = 'Lipsync' + lang.charAt(0).toUpperCase() + lang.slice(1);
      import(moduleName).then( module => {
        this.lipsync[lang] = new module[className];
      });
    }
  }`;

const PATCHED = `  lipsyncGetProcessor(lang, path="./") {
    if ( !this.lipsync.hasOwnProperty(lang) ) {
      const className = 'Lipsync' + lang.charAt(0).toUpperCase() + lang.slice(1);
      const loaders = {
        'en': () => import('./lipsync-en.mjs'),
        'fi': () => import('./lipsync-fi.mjs'),
        'de': () => import('./lipsync-de.mjs'),
        'fr': () => import('./lipsync-fr.mjs'),
        'lt': () => import('./lipsync-lt.mjs'),
      };
      const loader = loaders[lang.toLowerCase()];
      if (loader) {
        loader().then( module => {
          this.lipsync[lang] = new module[className];
        });
      }
    }
  }`;

try {
  const src = readFileSync(filePath, 'utf8');

  if (src.includes("const loaders = {")) {
    console.log('[patch-talkinghead] Already patched — skipping.');
    process.exit(0);
  }

  if (!src.includes(ORIGINAL)) {
    console.warn('[patch-talkinghead] Original code not found — library may have been updated. Skipping.');
    process.exit(0);
  }

  writeFileSync(filePath, src.replace(ORIGINAL, PATCHED), 'utf8');
  console.log('[patch-talkinghead] Patched dynamic import → static import map.');
} catch (err) {
  console.error('[patch-talkinghead] Failed:', err.message);
  process.exit(1);
}
