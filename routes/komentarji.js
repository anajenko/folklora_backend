const express = require('express');
const router = express.Router();
const pool = require('../utils/db.js'); // uvozimo Connection Pool
const utils = require('../utils/utils.js');

/**
 * @swagger
 * components:
 *   schemas:
 *     Komentarji:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         datoteka_id:
 *           type: integer
 *         besedilo:
 *           type: string
 *         poskodovano:
 *           type: boolean
 */

/**
 * @swagger
 * /api/komentarji/datoteka/{datoteka_id}:
 *   get:
 *     summary: Get all comments for a material
 *     tags: [Komentarji]
 *     parameters:
 *       - in: path
 *         name: datoteka_id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of comments
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Komentar'
 *       204:
 *         description: No comments
 */
//pridobivanje vseh komentarjev datoteke s posredovanim datoteka_id
router.get('/datoteka/:datoteka_id', async (req, res, next) => {
    try {
		const datoteka_id = req.params.datoteka_id;
        
        if (!/^\d+$/.test(datoteka_id)) {
            return res.status(400).json({ message: 'Neustrezen format za ID datoteke' });
        }

        if (!(await utils.datotekaObstaja(datoteka_id))) {
            return res.status(404).json({message: 'Datoteka ne obstaja!'});
        }
                
        const sql = 'SELECT id, datoteka_id, besedilo, poskodovano FROM komentar WHERE datoteka_id = ?';
        const [result] = await pool.execute(sql, [datoteka_id]);

        res.status(200).json(result);

    } catch (err) {
        next(err);
    }
});

/**
 * @swagger
 * /api/komentarji/{id}:
 *   get:
 *     summary: Get a comment by ID
 *     tags: [Komentarji]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the comment
 *     responses:
 *       200:
 *         description: Comment details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 datoteka_id:
 *                   type: integer
 *                 besedilo:
 *                   type: string
 *                 poskodovano:
 *                   type: integer
 *       400:
 *         description: Invalid comment ID
 *       404:
 *         description: Comment not found
 */
router.get('/:id', async (req, res, next) => {
    try {
		const id = req.params.id;
        if (!/^\d+$/.test(id)) {
            return res.status(400).json({ message: 'Neustrezen format za ID komentarja' });
        }
        if (!(await utils.komentarObstaja(id))) {
            return res.status(404).json({message: 'Komentar ne obstaja!'});
        }
                
        const sql = 'SELECT id, datoteka_id, besedilo, poskodovano FROM komentar WHERE id = ?';
        const [result] = await pool.execute(sql, [id]);

        res.status(200).json(result);

    } catch (err) {
        next(err);
    }
});

/**
 * @swagger
 * /api/komentarji:
 *   post:
 *     summary: Add a comment to a material
 *     tags: [Komentarji]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               datoteka_id:
 *                 type: integer
 *               besedilo:
 *                 type: string
 *               poskodovano:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Comment created
 *       400:
 *         description: Bad request
 */
router.post('/', async (req, res, next) => {
    const {datoteka_id, besedilo, poskodovano} = req.body;

    if (!datoteka_id || (!besedilo && (poskodovano == 0 || poskodovano === undefined))) { // todo stestiraj, ce ne pa odstrani un === undefidne
        return res.status(400).json({ message: 'Manjkajo podatki: datoteka_id, besedilo ali poskodovano.' });
    }

    try {
        if (!(await utils.datotekaObstaja(datoteka_id))) {
            return res.status(404).json({ message: 'Datoteka ne obstaja!' });
        }

        const sql = 'INSERT INTO komentar (datoteka_id, besedilo, poskodovano) VALUES (?, ?, ?)';
        const [result] = await pool.execute(sql, [datoteka_id, besedilo, poskodovano]);

        if (result.affectedRows === 1) {
            const id = result.insertId; //id novega komentarja
            const urlVira = utils.urlVira(req, `/komentarji/${id}`);
            res.location(urlVira);
            res.status(201).json({
                message: 'Komentar uspešno dodan!',
                url:urlVira
            });
        } 
        throw new Error('Dodajanje komentarja ni bilo uspešno.');
    } catch (err) {
        res.status(500).json({ message: 'Napaka strežnika pri dodajanju komentarja.' });
    }
});

/**
 * @swagger
 * /api/komentarji/{id}:
 *   delete:
 *     summary: Delete a comment by ID
 *     tags: [Komentarji]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the comment to delete
 *     responses:
 *       204:
 *         description: Comment deleted successfully
 *       400:
 *         description: Invalid comment ID
 *       404:
 *         description: Comment not found
 */
router.delete('/:id', async (req, res, next) => {
    const id = req.params.id;
    if (!/^\d+$/.test(id)) {
        return res.status(400).json({ message: 'Neustrezen format za ID komentarja' });
    }

    try {        
        if (!(await utils.komentarObstaja(id))) {
            return res.status(404).json({ message: 'Komentar ni najden.' });
        }
        const [result] = await pool.execute('DELETE FROM komentar WHERE id = ?', [id]);
        
        if (result.affectedRows === 1) {
            res.status(204).send();
        } 
        throw new Error('Brisanje komentarja ni bilo uspešno.');
    } catch (err) {
        next(err);
    }
});

/**
 * @swagger
 * /api/komentarji/{id}:
 *   put:
 *     summary: Update a comment's content
 *     tags: [Komentarji]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the comment to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               datoteka_id:
 *                 type: integer
 *                 description: ID of the file the comment belongs to
 *               besedilo:
 *                 type: string
 *                 description: Text of the comment
 *               poskodovano:
 *                 type: integer
 *                 description: Flag if the comment is marked
 *     responses:
 *       204:
 *         description: Comment updated successfully
 *       400:
 *         description: Missing or invalid data
 *       404:
 *         description: File or comment not found
 */
router.put('/:id', async (req, res, next) => {
    const id = req.params.id;
    const {datoteka_id, besedilo, poskodovano} = req.body; //samo 'besedilo' ali 'poskodovano' se lahko posodobi

    if (!/^\d+$/.test(datoteka_id) || !/^\d+$/.test(id)) {
        return res.status(400).json({ message: 'ID mora biti številka.' });
    }

    try{
        if (!(await utils.datotekaObstaja(datoteka_id))) {
            return res.status(404).json({message: 'Datoteka ne obstaja!'});
        }

        if(!datoteka_id || (!besedilo && (poskodovano == 0 || poskodovano === undefined))){
            return res.status(400).json({message: 'Manjkajo podatki za posodabljanje komentarja'});
        }

        const sql = 'UPDATE komentar SET besedilo=?, poskodovano=? WHERE id=?';
        const [result] = await pool.execute(sql, [besedilo, poskodovano, id]);
        
        if (result.affectedRows === 1) {
            res.status(204).send(); //204 je No Content - tut če pripnemo message, se ne prikaže
        } 
        throw new Error('Spreminjanje komentarja ni bilo uspešno.');
    } catch (err) {
        next(err);
    }
});

module.exports = router;
