# Nomenclatura IUPAC de alcanos — generador con JSME

Aplicación Node.js que genera al azar estructuras de **alcanos acíclicos y cíclicos ramificados**, las dibuja con el editor **JSME** y calcula su nombre sistemático según las **Recomendaciones IUPAC 2013** (Blue Book 2013).

- **Generar**: crea una estructura nueva según el tipo (acíclico, cíclico o mixto) y el nivel (básico, intermedio o avanzado).
- **Desplegar**: muestra el nombre preferido IUPAC (PIN), el nombre de nomenclatura general (si difiere), la versión en inglés y la justificación. La cadena o el anillo principal se resalta en la estructura.
- **Tu respuesta**: el estudiante escribe su nombre y, al desplegar, se compara con los nombres aceptados.
- **Modo dibujo libre**: el estudiante dibuja un alcano en JSME y usa «Nombrar mi dibujo».

El nombre **no se envía al navegador** hasta que se presiona *Desplegar*.

## Requisitos

Node.js 18 o superior. JSME se instala desde npm (`jsme-editor`) y lo sirve el mismo servidor, sin depender de un CDN externo.

## Instalación y uso local

```bash
npm install
npm test          # 29 pruebas: nombres de referencia + 3000 estructuras aleatorias
npm start         # http://127.0.0.1:3000
```

Variables de entorno: `PORT` (3000 por defecto) y `HOST` (127.0.0.1 por defecto).

## Despliegue en VPS (Hostinger, Ubuntu)

```bash
# 1. Copiar el proyecto a /var/www/alcanos-iupac e instalar
cd /var/www/alcanos-iupac && npm ci --omit=dev

# 2. Mantenerlo activo con PM2
sudo npm i -g pm2
PORT=3000 pm2 start server.js --name alcanos-iupac
pm2 save && pm2 startup
```

Bloque de Nginx (proxy inverso; luego `certbot --nginx` para HTTPS):

```nginx
server {
    server_name quimica.ejemplo.edu.pa;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Para publicarlo en un subdirectorio (p. ej. `/alcanos/`), use `location /alcanos/ { proxy_pass http://127.0.0.1:3000/; }`; las rutas de la interfaz son relativas y no requieren cambios. En `deploy/` hay plantillas de PM2, Nginx y Apache.

## API

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/generar?tipo=aciclico\|ciclico\|mixto&nivel=1\|2\|3` | Devuelve `{ smiles, formula, ciclico, nivel }` sin el nombre |
| POST | `/api/nombrar` con `{ smiles }` o `{ molfile }` | Devuelve `pinEs`, `generalEs`, `pinEn`, `generalEn`, `formula` y `justificacion` |

## Estructura del proyecto

```
server.js               Servidor Express (estáticos, JSME y API)
src/molecula.js         Grafo molecular; lectura de SMILES y molfile V2000; escritura de SMILES
src/nomenclatura.js     Algoritmo de nomenclatura IUPAC (PIN y general, en inglés y español)
src/generador.js        Generador aleatorio por nivel
public/                 Interfaz (HTML, CSS, JS)
test/                   Pruebas con node:test
```

## Reglas implementadas (Blue Book 2013)

| Regla | Aplicación |
|---|---|
| P-21.2, P-22.1 | Raíces numéricas (met-, et-, prop-, but-… icos-) y prefijo ciclo- |
| P-44.1.2.2 | El anillo es preferido sobre la cadena: `decilciclopropano`, no `ciclopropildecano` (criterio de 1979) |
| P-44.3 | Cadena principal: la de mayor número de carbonos |
| P-45.2.1 | Entre cadenas de igual longitud, la de más sustituyentes |
| P-31.1.4 | Localizadores más bajos (primer punto de diferencia) |
| P-31.1.4.3.4 | En caso de empate, el localizador más bajo al prefijo citado primero alfabéticamente |
| P-29.2 | Sustituyentes «alquil» y «alcan-x-il» (`propan-2-il`, `3-metilbutan-2-il`) |
| P-29.6 | `tert-butil` es prefijo preferido; `isopropil`, `isobutil` y `sec-butil` solo en nomenclatura general |
| P-14.2 | Multiplicadores `di-, tri-…` y `bis-, tris-…` (prefijos compuestos) |
| P-14.3.4 | Se omite el localizador en anillos monosustituidos (`metilciclohexano`) |
| P-14.5 | Orden alfanumérico: se ignoran `di-`, `tri-`, `sec-`, `tert-`; en prefijos compuestos cuenta el nombre completo |
| P-16.5 | Signos de inclusión ( ), [ ], { } según el anidamiento |

Ejemplo de diferencia entre PIN y nombre general: el PIN es `1-metil-4-(propan-2-il)ciclohexano` (m < p), mientras que el nombre general es `1-isopropil-4-metilciclohexano` (i < m).

**Alcance:** alcanos acíclicos y monocíclicos de hasta 30 carbonos en la cadena padre. Quedan fuera los compuestos policíclicos (biciclo, espiro), la estereoquímica (*cis/trans*, *R/S*) y los criterios de desempate de P-45 posteriores a P-45.2.3; para esos casos, ya muy poco frecuentes, se usa el orden alfanumérico del nombre completo (P-45.5).

## Referencias

1. Favre, H. A.; Powell, W. H. *Nomenclature of Organic Chemistry: IUPAC Recommendations and Preferred Names 2013*. Royal Society of Chemistry, 2014. DOI: 10.1039/9781849733069.
2. Bienfait, B.; Ertl, P. JSME: a free molecule editor in JavaScript. *J. Cheminform.* **2013**, 5, 24. DOI: 10.1186/1758-2946-5-24.
3. JSME API: https://jsme-editor.github.io/dist/api_javadoc/export/client/JSME.html
