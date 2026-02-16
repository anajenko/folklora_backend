const express = require('express');
const router = express.Router();
const pool = require('../utils/db.js'); // uvozimo Connection Pool
const utils = require('../utils/utils.js'); // uvozimo pomožne funckije
const multer = require('multer');
const upload = multer(); 
const authMiddleware = require('../utils/auth');

/**
 * @swagger
 * components:
 *   schemas:
 *     Labele:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         naziv:
 *           type: string
 *         tip:
 *           type: string
 *           enum: 
 *             - pokrajina
 *             - tip_oblacila
 *             - spol
 *             - velikost
 *             - drugo
 */

/**
 * @swagger
 * /api/labele:
 *   get:
 *     summary: Pridobivanje vseh label
 *     tags: [Labele]
 *     responses:
 *       200:
 *         description: Uspešno vrnjen seznam vseh label
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Labele'
 *       500:
 *         description: Notranja napaka strežnika
 */
router.get('/', authMiddleware, async (req, res, next) => {
    try {
        const [rows] = await pool.execute('SELECT id, naziv, tip FROM labela');
        res.status(200).json(rows);		// Pošljemo podatke uporabniku kot JSON
    } catch (err) {
        next(err);
	}
});

/**
 * @swagger
 * /api/labele/{id}:
 *   get:
 *     summary: Pridobivanje labele z {id}
 *     tags: [Labele]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID labele
 *     responses:
 *       200:
 *         description: Uspešno vrnjena labela z vpisanim {id}
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Labele'
 *       400:
 *         description: Neustrezen format za {id} labele
 *       404:
 *         description: Labela z z vpisanim {id} ne obstaja
 *       500:
 *         description: Notranja napaka strežnika
 */
router.get('/:id', authMiddleware, async (req, res, next) => {
    try {
		const id = req.params.id;
        if (!/^\d+$/.test(id)) {
            return res.status(400).json({ message: 'Neustrezen format za ID labela!' });
        }
        if (!(await utils.labelaObstaja(id))) {
            return res.status(404).json({message: `Labela z ID-jem '${id}' ne obstaja!`});
        }
                
        const sql = 'SELECT id, naziv, tip FROM labela WHERE id = ?';
        const [result] = await pool.execute(sql, [id]);

        res.status(200).json(result);
    } catch (err) {
        next(err);
    }
});

/**
 * @swagger
 * /api/labele/{id}/kosi:
 *   get:
 *     summary: Pridobivanje kosov z labelo z {id} - brez slike
 *     tags: [Labele]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID labele
 *     responses:
 *       200:
 *         description: Uspešno vrnjen seznam kosov z labelo z vpisanim {id}
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   ime:
 *                     type: string
 *                   tip:
 *                     type: string
 *                     enum: 
 *                       - slika
 *                       - audio
 *                       - video
 *                       - pdf
 *       400:
 *         description: Neustrezen format za {id} labele
 *       404:
 *         description: Labela z vpisanim {id} ne obstaja
 *       500:
 *         description: Notranja napaka strežnika
 */
//pridobivanje vseh kosov z labelo :id
router.get('/:id/kosi', authMiddleware, async (req, res, next) => {
    try {
		const id = req.params.id;
       
        if (!/^\d+$/.test(id)) { //regex: any digit & one or more
            return res.status(400).json({ message: 'Neustrezen format za ID labele!' });
        }

        if (!(await utils.labelaObstaja(id))) {
            return res.status(404).json({ message: `Labela z ID-jem '${id}' ne obstaja!` });
        }

        const sql = `
            SELECT id, ime, tip 
            FROM kos k
            JOIN kos_labela kl ON k.id = kl.kos_id
            WHERE kl.labela_id = ?
        `;
        const [result] = await pool.execute(sql, [id]);

        res.status(200).json(result);
    } catch (err) {
        next(err);
    }
});

/**
 * @swagger
 * /api/labele/kos/{kos_id}:
 *   get:
 *     summary: Pridobivanje vseh label kosa s {kos_id}
 *     tags: [Labele]
 *     parameters:
 *       - in: path
 *         name: kos_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID kosa
 *     responses:
 *       200:
 *         description: Uspešno vrnjen seznam vseh label kosa
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Labele'
 *       400:
 *         description: Neustrezen format za {id} kosa
 *       404:
 *         description: Kos z vpisanim {kos_id} ne obstaja
 *       500:
 *         description: Notranja napaka strežnika
 */
//pridobivanje vseh label kosa s posredovanim kos_id
router.get('/kos/:kos_id', authMiddleware, async (req, res, next) => {
    try {
		const kos_id = req.params.kos_id;
        if (!/^\d+$/.test(kos_id)) {
            return res.status(400).json({ message: 'Neustrezen format za ID kosa!' });
        }
        if (!(await utils.kosObstaja(kos_id))) {
            return res.status(404).json({message: `Kos z ID-jem '${kos_id}' ne obstaja!`});
        }
                
        const sql = `
            SELECT id, naziv, tip 
            FROM labela l
            JOIN kos_labela kl ON l.id = kl.labela_id
            WHERE kl.kos_id = ?
            `;
        const [result] = await pool.execute(sql, [kos_id]);

        res.status(200).json(result);
    } catch (err) {
        next(err);
    }
});

/**
 * @swagger
 * /api/labele:
 *   post:
 *     summary: Dodajanje nove labele
 *     tags: [Labele]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               naziv:
 *                 type: string
 *               tip:
 *                 $ref: '#/components/schemas/Labele/properties/tip'
 *     responses:
 *       201:
 *         description: Labela uspešno dodana
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 url:
 *                   type: string
 *       400:
 *         description: Manjkajo podatki za dodajanje nove labele ali tip ni pravilen
 *       409:
 *         description: Labela z istim imenom že obstaja
 *       500:
 *         description: Notranja napaka strežnika
 */
router.post('/', authMiddleware, async (req, res, next) => { 
    const {naziv, tip} = req.body;

    if (!naziv || !tip) {
        return res.status(400).json({ message: 'Manjkajo podatki: naziv ali tip!' });
    }

    const dovoljeniTipi = ['pokrajina', 'tip_oblacila', 'spol', 'velikost', 'drugo'];
    if (!dovoljeniTipi.includes(tip)) {
        return res.status(400).json({
            message: `Neveljaven tip labele! Dovoljeni tipi: ${dovoljeniTipi.join(', ')}`
        });
    }
    try {
        //ali že obstaja labela z istim imenom
        const [rows] = await pool.execute('SELECT id FROM labela WHERE naziv = ?', [naziv]);
        if (rows.length > 0) {
            return res.status(409).json({ message: 'Labela z istim imenom že obstaja!' });
        }

        const sql = 'INSERT INTO labela (naziv, tip) VALUES (?, ?)';
        const [result] = await pool.execute(sql, [naziv, tip]);

        if (result.affectedRows === 1) {
            const id = result.insertId; //id nove labele
            const urlVira = utils.urlVira(req, `/api/labele/${id}`);
            res.location(urlVira);
            return res.status(201).json({
                message: 'Labela uspešno dodana.',
                url:urlVira
            });
        }
        throw new Error('Dodajanje labele ni bilo uspešno!');
    } catch (err) {
        next(err);
    }
});

/**
 * @swagger
 * /api/labele/{id}:
 *   delete:
 *     summary: Brisanje obstoječe labele z {id}
 *     tags: [Labele]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID labele
 *     responses:
 *       204:
 *         description: Labela je bila uspešno izbrisana
 *       400:
 *         description: Neustrezen format za {id} labele
 *       404:
 *         description: Labela z vpisanim {id} ne obstaja
 *       500:
 *         description: Notranja napaka strežnika
 */
router.delete('/:id', authMiddleware, async (req, res, next) => {
    const id = req.params.id;
    if (!/^\d+$/.test(id)) {
            return res.status(400).json({ message: 'Neustrezen format za ID labela!' });
        }

    try {        
        if (!(await utils.labelaObstaja(id))) {
            return res.status(404).json({ message: `Labela z ID-jem '${id}' ne obstaja!` });
        }
        const [result] = await pool.execute('DELETE FROM labela WHERE id = ?', [id]);
        
        if (result.affectedRows === 1) {
            return res.status(204).send();
        } 
        throw new Error('Brisanje labele ni bilo uspešno!');
    } catch (err) {
        next(err);
    }
});

module.exports = router;
