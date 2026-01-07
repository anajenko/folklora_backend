const express = require('express');
const router = express.Router();
const pool = require('../utils/db.js'); // uvozimo Connection Pool
const utils = require('../utils/utils.js'); // uvozimo pomožne funckije
const multer = require('multer');
const upload = multer(); 

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
router.get('/', async (req, res, next) => {
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
router.get('/:id', async (req, res, next) => {
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
 * /api/labele/{id}/datoteke:
 *   get:
 *     summary: Pridobivanje datotek z labelo z {id} - brez slike
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
 *         description: Uspešno vrnjen seznam datotek z labelo z vpisanim {id}
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
//pridobivanje vseh datotek z labelo :id
router.get('/:id/datoteke', async (req, res, next) => {
    try {
		const id = req.params.id;
       
        if (!/^\d+$/.test(id)) { //regex: any digit & one or more
            return res.status(400).json({ message: 'Neustrezen format za ID labele!' });
        }

        if (!(await utils.labelaObstaja(id))) { // todo poglej ce sm prou napisal !!!!
            return res.status(404).json({ message: `Labela z ID-jem '${id}' ne obstaja!` });
        }

        const sql = `
            SELECT id, ime, tip 
            FROM datoteka d
            JOIN datoteka_labela dl ON d.id = dl.datoteka_id
            WHERE dl.labela_id = ?
        `;
        const [result] = await pool.execute(sql, [id]);

        res.status(200).json(result);
    } catch (err) {
        next(err);
    }
});

/**
 * @swagger
 * /api/labele/datoteka/{datoteka_id}:
 *   get:
 *     summary: Pridobivanje vseh label datoteke z {datoteka_id}
 *     tags: [Labele]
 *     parameters:
 *       - in: path
 *         name: datoteka_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID datoteke
 *     responses:
 *       200:
 *         description: Uspešno vrnjen seznam vseh label datoteke
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Labele'
 *       400:
 *         description: Neustrezen format za {id} datoteke
 *       404:
 *         description: Datoteka z vpisanim {datoteka_id} ne obstaja
 *       500:
 *         description: Notranja napaka strežnika
 */
//pridobivanje vseh label datoteke s posredovanim datoteka_id
router.get('/datoteka/:datoteka_id', async (req, res, next) => {
    try {
		const datoteka_id = req.params.datoteka_id;
        if (!/^\d+$/.test(datoteka_id)) {
            return res.status(400).json({ message: 'Neustrezen format za ID datoteke!' });
        }
        if (!(await utils.datotekaObstaja(datoteka_id))) {
            return res.status(404).json({message: `Datoteka z ID-jem '${datoteka_id}' ne obstaja!`});
        }
                
        const sql = `
            SELECT id, naziv, tip 
            FROM labela l
            JOIN datoteka_labela dl ON l.id = dl.labela_id
            WHERE dl.datoteka_id = ?
            `;
        const [result] = await pool.execute(sql, [datoteka_id]);

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
router.post('/', upload.none(), async (req, res, next) => { // todo upload.none pomoje ne rabis - stestiraj
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
router.delete('/:id', async (req, res, next) => {
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
