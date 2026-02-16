const pool = require('./db.js');

async function kosObstaja(id) {
    if (!id) return false;
    const [rows] = await pool.execute('SELECT id FROM kos WHERE id = ?', [id]);
    return rows.length > 0;
}

async function komentarObstaja(id) {
    if (!id) return false;
    const [rows] = await pool.execute('SELECT id FROM komentar WHERE id = ?', [id]);
    return rows.length > 0;
}

async function labelaObstaja(id) {
    if (!id) return false;
    const [rows] = await pool.execute('SELECT id FROM labela WHERE id = ?', [id]);
    return rows.length > 0;
}

async function uporabnikObstaja(uporabnisko_ime) {
    if (!uporabnisko_ime) return false;
    const [rows] = await pool.execute('SELECT id FROM uporabnik WHERE uporabnisko_ime = ?', [uporabnisko_ime]);
    return rows.length > 0;
}

/**
 * urlVira(reqOrPath, optionalPath)
 * - če je prvi argument objekt req, sestavi URL iz req
 * - če je prvi argument absolutni URL (http(s)://...), ga uporabi kot base url
 * - sicer uporabi process.env.BASE_URL ali privzeti localhost kot base url
 * Vedno vrne absolutni URL.
 */
function urlVira(reqOrPath, optionalPath) {
    // helper: normalize join of base + path
    const join = (base, path) => {
        const b = base.replace(/\/+$/, ''); // remove trailing slashes
        if (!path) return b;
        const p = path.startsWith('/') ? path : '/' + path;
        return b + p;
    };

    // prvi argument je req objekt
    if (reqOrPath && typeof reqOrPath.get === 'function' && reqOrPath.protocol) {
        const base = `${reqOrPath.protocol}://${reqOrPath.get('host')}`;
        return join(base, optionalPath ?? '');
    }

    const firstIsString = typeof reqOrPath === 'string';
    const firstIsAbsolute = firstIsString && /^https?:\/\//i.test(reqOrPath);

    // prvi argument je absolutni URL (base)
    if (firstIsAbsolute) {
        return join(reqOrPath, optionalPath ?? '');
    }

    // sicer uporabi BASE_URL ali privzeti localhost
    const base = process.env.BASE_URL || 'http://localhost:3000';
    const path = optionalPath ?? (firstIsString ? reqOrPath : '');
    return join(base, path);
}

module.exports = {
    kosObstaja,
    komentarObstaja,
    labelaObstaja,
    uporabnikObstaja,
    urlVira
};