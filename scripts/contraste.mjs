// Verifica el contraste (WCAG 2.2) de los pares de color de public/tokens.css en claro y oscuro.
//   node scripts/contraste.mjs        -> sale con código 1 si algún par falla
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../public/tokens.css', import.meta.url), 'utf8');

// Lee las variables de un bloque, p. ej. ":root,\n[data-theme="light"]" o '[data-theme="dark"]'
function bloque(selectorRegex) {
  const m = css.match(new RegExp(selectorRegex + '\\s*\\{([\\s\\S]*?)\\n\\}', 'm'));
  const vars = {};
  for (const [, k, v] of m[1].matchAll(/(--[\w-]+):\s*([^;]+);/g)) vars[k] = v.trim();
  return vars;
}
const claro = bloque(':root,\\s*\\[data-theme="light"\\]');
const oscuro = { ...claro, ...bloque('\\[data-theme="dark"\\]') }; // el oscuro hereda la paleta cruda

function resolver(vars, v, prof = 0) {
  const m = v?.match(/^var\((--[\w-]+)\)$/);
  return m && prof < 8 ? resolver(vars, vars[m[1]], prof + 1) : v;
}
function rgb(hex) {
  const h = hex.replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
}
function lum(hex) {
  const [r, g, b] = rgb(hex).map((c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// [texto o control, fondo, mínimo, descripción]
const PARES = [
  ['--color-texto', '--color-fondo', 4.5, 'Texto sobre la página'],
  ['--color-texto', '--color-superficie', 4.5, 'Texto sobre tarjetas'],
  ['--color-texto', '--color-superficie-elevada', 4.5, 'Texto en diálogos'],
  ['--color-texto-suave', '--color-fondo', 4.5, 'Texto de apoyo sobre la página'],
  ['--color-texto-suave', '--color-superficie', 4.5, 'Texto de apoyo sobre tarjetas'],
  ['--color-texto-suave', '--color-fondo-suave', 4.5, 'Texto de apoyo sobre banda suave'],
  ['--color-sobre-primario', '--color-primario', 4.5, 'Botón primario'],
  ['--color-sobre-primario', '--color-primario-hover', 4.5, 'Botón primario (hover)'],
  ['--color-sobre-primario', '--color-primario-presionado', 4.5, 'Botón primario (presionado)'],
  ['--color-texto-primario', '--color-fondo', 4.5, 'Enlaces y texto de marca'],
  ['--color-texto-primario', '--color-superficie', 4.5, 'Texto de marca sobre tarjetas'],
  ['--color-texto-secundario', '--color-superficie', 4.5, 'Monto que recibe el círculo'],
  ['--color-exito-texto', '--color-exito-fondo', 4.5, 'Aviso y chip de éxito'],
  ['--color-advertencia-texto', '--color-advertencia-fondo', 4.5, 'Aviso y chip de espera'],
  ['--color-error-texto', '--color-error-fondo', 4.5, 'Aviso y chip de error'],
  ['--color-info-texto', '--color-info-fondo', 4.5, 'Aviso informativo'],
  ['--color-sobre-error', '--color-error', 4.5, 'Botón de peligro'],
  ['--color-deshabilitado-texto', '--color-deshabilitado-fondo', 3, 'Botón deshabilitado (WCAG exime los inactivos; aquí se pide 3:1)'],
  ['--color-avatar-1-texto', '--color-avatar-1-fondo', 4.5, 'Avatar 1'],
  ['--color-avatar-2-texto', '--color-avatar-2-fondo', 4.5, 'Avatar 2'],
  ['--color-avatar-3-texto', '--color-avatar-3-fondo', 4.5, 'Avatar 3'],
  ['--color-avatar-4-texto', '--color-avatar-4-fondo', 4.5, 'Avatar 4'],
  ['--color-avatar-5-texto', '--color-avatar-5-fondo', 4.5, 'Avatar 5'],
  ['--color-borde-fuerte', '--color-superficie', 3, 'Borde de controles'],
  ['--color-foco', '--color-fondo', 3, 'Anillo de foco sobre la página'],
  ['--color-foco', '--color-superficie', 3, 'Anillo de foco sobre tarjetas'],
  ['--color-exito-borde', '--color-exito-fondo', 3, 'Borde de éxito'],
  ['--color-error-borde', '--color-error-fondo', 3, 'Borde de error'],
  ['--color-primario', '--color-fondo', 3, 'Relleno primario contra la página'],
];

let fallos = 0;
for (const [nombre, vars] of [['CLARO', claro], ['OSCURO', oscuro]]) {
  console.log(`\n== ${nombre} ==`);
  for (const [a, b, min, desc] of PARES) {
    const ca = resolver(vars, vars[a]), cb = resolver(vars, vars[b]);
    if (!/^#/.test(ca ?? '') || !/^#/.test(cb ?? '')) { console.log(`?  ${desc}: no se pudo resolver ${a} o ${b}`); fallos++; continue; }
    const r = ratio(ca, cb), ok = r >= min;
    if (!ok) fallos++;
    console.log(`${ok ? 'OK ' : 'MAL'} ${r.toFixed(2).padStart(5)} (mín ${min})  ${desc}  [${a.slice(8)} / ${b.slice(8)}]`);
  }
}
console.log(fallos ? `\n${fallos} par(es) con problema.` : '\nTodos los pares cumplen.');
process.exit(fallos ? 1 : 0);
