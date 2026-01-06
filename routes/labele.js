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
 */

/**
 * @swagger
 * /api/labele:
 *   get:
 *     summary: Get all labels
 *     tags: [Labele]
 *     responses:
 *       200:
 *         description: List of labels
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Labela'
 *       204:
 *         description: No labels
 */
router.get('/', async (req, res, next) => {
    try {
        const [rows, fields] = await pool.execute('SELECT id, naziv, tip FROM labela');
        
        if (rows.length === 0) { // tabela je prazna
            return res.status(204).send(); //no content
        }
        res.status(200).json(rows);		// Pošljemo podatke uporabniku kot JSON

    } catch (err) {
        next(err);
	}
});

/**
 * @swagger
 * /api/labele/datoteka/{datoteka_id}:
 *   get:
 *     summary: Get all labels for a specific file
 *     tags: [Labele]
 *     parameters:
 *       - in: path
 *         name: datoteka_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the file
 *     responses:
 *       200:
 *         description: List of labels associated with the file
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   naziv:
 *                     type: string
 *                   tip:
 *                     type: string
 *       400:
 *         description: Invalid file ID
 *       404:
 *         description: File not found
 */
//pridobivanje vseh label datoteke s posredovanim datoteka_id
router.get('/datoteka/:datoteka_id', async (req, res, next) => {
    try {
		const datoteka_id = req.params.datoteka_id;
        if (!/^\d+$/.test(datoteka_id)) {
            return res.status(400).json({ message: 'Neustrezen format za ID datoteke' });
        }
        if (!(await utils.datotekaObstaja(datoteka_id))) {
            return res.status(404).json({message: 'Datoteka ne obstaja!'});
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
 * /api/labele/{id}:
 *   get:
 *     summary: Get label details by ID
 *     tags: [Labele]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the label
 *     responses:
 *       200:
 *         description: Label details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 naziv:
 *                   type: string
 *                 tip:
 *                   type: string
 *       400:
 *         description: Invalid label ID
 *       404:
 *         description: Label not found
 */
router.get('/:id', async (req, res, next) => {
    try {
		const id = req.params.id;
        if (!/^\d+$/.test(id)) {
            return res.status(400).json({ message: 'Neustrezen format za ID labela' });
        }
        if (!(await utils.labelaObstaja(id))) {
            return res.status(404).json({message: 'Labela ne obstaja!'});
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
 * /api/labele:
 *   post:
 *     summary: Add a new label
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
 *                 type: string
 *     responses:
 *       201:
 *         description: Label created
 *       400:
 *         description: Bad request
 */
router.post('/', upload.none(), async (req, res, next) => {
    const {naziv, tip} = req.body;

    if (!naziv || !tip) {
        return res.status(400).json({ message: 'Manjkajo podatki: naziv ali tip.' });
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
            const urlVira = utils.urlVira(req, `/labele/${id}`);
            res.location(urlVira);
            res.status(201).json({
                message: 'Labela uspešno dodana!',
                url:urlVira
            });
        }
        throw new Error('Dodajanje labele ni bilo uspešno.');
    } catch (err) {
        next(err);
    }
});

/**
 * @swagger
 * /api/labele/{id}:
 *   delete:
 *     summary: Delete a label by ID
 *     tags: [Labele]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the label to delete
 *     responses:
 *       204:
 *         description: Label deleted successfully
 *       400:
 *         description: Invalid label ID
 *       404:
 *         description: Label not found
 */
router.delete('/:id', async (req, res, next) => {
    const id = req.params.id;
    if (!/^\d+$/.test(id)) {
            return res.status(400).json({ message: 'Neustrezen format za ID labela' });
        }

    try {
        const [existingData] = await pool.execute('SELECT id FROM labela WHERE id = ?', [id]);
        
        if (existingData.length === 0) {
            return res.status(404).json({ message: 'Labela ni najdena.' });
        }
        const [result] = await pool.execute('DELETE FROM labela WHERE id = ?', [id]);
        
        if (result.affectedRows === 1) {
            res.status(204).send();
        } 
        throw new Error('Brisanje labele ni bilo uspešno.');
    } catch (err) {
        next(err);
    }
});

module.exports = router;
