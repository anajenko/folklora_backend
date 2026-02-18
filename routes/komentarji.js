const express = require('express');
const router = express.Router();
const pool = require('../utils/db.js'); // uvozimo Connection Pool
const utils = require('../utils/utils.js');
const authMiddleware = require('../utils/auth');

/**
 * @swagger
 * components:
 *   schemas:
 *     Komentarji:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         kos_id:
 *           type: integer
 *           description: ID kosa, ki mu pripada komentar
 *         besedilo:
 *           type: string
 *           description: Besedilo komentarja
 */

/**
 * @swagger
 * /api/komentarji/kos/{kos_id}:
 *   get:
 *     summary: Pridobivanje vseh komentarjev kosa z {kos_id}
 *     tags: [Komentarji]
 *     parameters:
 *       - in: path
 *         name: kos_id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Uspešno vrnjen seznam vseh komentarjev kosa
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Komentarji'
 *       400:
 *         description: Neustrezen format za {id} kosa
 *       404:
 *         description: Kos z vpisanim {id} ne obstaja
 *       500:
 *         description: Notranja napaka strežnika
 */
//pridobivanje vseh komentarjev kosa s posredovanim kos_id
router.get('/kos/:kos_id', authMiddleware, async (req, res, next) => {
    try {
		const kos_id = req.params.kos_id;
        
        if (!/^\d+$/.test(kos_id)) {
            return res.status(400).json({ message: 'Neustrezen format za ID kosa!' });
        }

        if (!(await utils.kosObstaja(kos_id))) {
            return res.status(404).json({message: `Kos z ID-jem '${kos_id}' ne obstaja!`});
        }
                
        const sql = 'SELECT id, kos_id, besedilo FROM komentar WHERE kos_id = ?';
        const [result] = await pool.execute(sql, [kos_id]);

        res.status(200).json(result);
    } catch (err) {
        next(err);
    }
});

/**
 * @swagger
 * /api/komentarji/{id}:
 *   get:
 *     summary: Pridobivanje komentarja z vpisanim {id}
 *     tags: [Komentarji]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID komentarja
 *     responses:
 *       200:
 *         description: Uspešno vrnjen komentar z vpisanim {id}
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Komentar'
 *       400:
 *         description: Neustrezen format za {id} komentarja
 *       404:
 *         description: Komentar z vpisanim {id} ne obstaja
 *       500:
 *         description: Notranja napaka strežnika
 */
router.get('/:id', authMiddleware, async (req, res, next) => {
    try {
		const id = req.params.id;
        if (!/^\d+$/.test(id)) {
            return res.status(400).json({ message: 'Neustrezen format za ID komentarja!' });
        }
        if (!(await utils.komentarObstaja(id))) {
            return res.status(404).json({message: `Komentar z ID-jem '${id}' ne obstaja!`});
        }
                
        const sql = 'SELECT id, kos_id, besedilo FROM komentar WHERE id = ?';
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
 *     summary: Dodajanje komentarja na kos
 *     tags: [Komentarji]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               kos_id:
 *                 type: integer
 *               besedilo:
 *                 type: string
 *     responses:
 *       201:
 *         description: Komentar uspešno dodan na kos
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
 *         description: Manjkajo podatki za dodajanje komentarja
 *       404:
 *         description: Kos z {kos_id} ne obstaja
 *       500:
 *         description: Notranja napaka strežnika
 */
router.post('/', authMiddleware, async (req, res, next) => {
    const {kos_id, besedilo} = req.body;

    if (!kos_id || !besedilo) { 
        return res.status(400).json({ message: 'Manjka podatek kos_id ali besedilo!' });
    }
     if (besedilo.trim() === '') { 
        return res.status(400).json({ message: 'Komentar ne sme biti prazen!' });
    }
    try {
        if (!(await utils.kosObstaja(kos_id))) {
            return res.status(404).json({ message: `Kos z ID-jem '${kos_id}' ne obstaja!` });
        }

        const uporabnik_id = req.user.id; 

        const sql = 'INSERT INTO komentar (kos_id, uporabnik_id, besedilo) VALUES (?, ?, ?)';
        const [result] = await pool.execute(sql, [kos_id, uporabnik_id, besedilo]);

        if (result.affectedRows === 1) {
            const id = result.insertId; //id novega komentarja
            const urlVira = utils.urlVira(req, `/api/komentarji/${id}`);
            res.location(urlVira);
            return res.status(201).json({
                message: 'Komentar uspešno dodan.',
                url:urlVira
            });
        } 
        throw new Error('Dodajanje komentarja ni bilo uspešno!');
    } catch (err) {
        next(err);
    }
});

/**
 * @swagger
 * /api/komentarji/{id}:
 *   delete:
 *     summary: Brisanje obstoječega komentarja z {id}
 *     tags: [Komentarji]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID komentarja
 *     responses:
 *       204:
 *         description: Komentar je bil uspešno izbrisan
 *       400:
 *         description: Neustrezen format za {id} komentarja
 *       404:
 *         description: Komentar z vpisanim {id} ne obstaja
 *       500:
 *         description: Notranja napaka strežnika
 */
router.delete('/:id', authMiddleware, async (req, res, next) => {
    const id = req.params.id;
    if (!/^\d+$/.test(id)) {
        return res.status(400).json({ message: 'Neustrezen format za ID komentarja!' });
    }

    try {        
        if (!(await utils.komentarObstaja(id))) {
            return res.status(404).json({ message: `Komentar z ID-jem '${id}' ne obstaja!` });
        }
        const [result] = await pool.execute('DELETE FROM komentar WHERE id = ?', [id]);
        
        if (result.affectedRows === 1) {
            return res.status(204).send();
        } 
        throw new Error('Brisanje komentarja ni bilo uspešno!');
    } catch (err) {
        next(err);
    }
});

/**
 * @swagger
 * /api/komentarji/{id}:
 *   put:
 *     summary: Posodabljanje vsebine komentarja z vpisanim {id}
 *     tags: [Komentarji]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID komentarja
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               kos_id:
 *                 type: integer
 *               besedilo:
 *                 type: string
 *     responses:
 *       204:
 *         description: Uspešno posodobljen komentar
 *       400:
 *         description: Manjkajo podatki za shranjevanje komentarja ali format za {id} ni ustrezen
 *       404:
 *         description: Kos z vpisanim {kos_id} ne obstaja
 *       500:
 *         description: Notranja napaka strežnika
 */
router.put('/:id', authMiddleware, async (req, res, next) => {
    const id = req.params.id;
    const {kos_id, besedilo} = req.body; //samo 'besedilo' se lahko posodobi

    if (!/^\d+$/.test(kos_id) || !/^\d+$/.test(id)) {
        return res.status(400).json({ message: 'ID mora biti številka!' });
    }

    try{
        if (!(await utils.kosObstaja(kos_id))) {
            return res.status(404).json({message: `Kos z ID-jem '${kos_id}' ne obstaja!`});
        }

        if(!kos_id || !besedilo){
            return res.status(400).json({message: 'Manjkajo podatki za posodabljanje komentarja!'});
        }

        const sql = 'UPDATE komentar SET besedilo=? WHERE id=?';
        const [result] = await pool.execute(sql, [besedilo, id]);
        
        if (result.affectedRows === 1) {
            return res.status(204).send(); //204 je No Content - tut če pripnemo message, se ne prikaže
        } 
        throw new Error('Posodabljanje komentarja ni bilo uspešno!');
    } catch (err) {
        next(err);
    }
});

module.exports = router;
