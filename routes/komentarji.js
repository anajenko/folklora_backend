const express = require('express');
const router = express.Router({ mergeParams: true }); 
// IMPORTANT: mergeParams allows access to kosId
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
 *         uporabnik_id:
 *           type: integer
 *         uporabnisko_ime:
 *           type: string
 *         besedilo:
 *           type: string
 *           description: Besedilo komentarja
 */

/**
 * @swagger
 * /api/kosi/{kos_id}/komentarji:
 *   get:
 *     summary: Pridobivanje vseh komentarjev kosa z {kos_id}
 *     tags: [Kosi]
 *     parameters:
 *       - in: path
 *         name: kos_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID kosa, ki mu pripadajo komentarji
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
router.get('/', authMiddleware, async (req, res, next) => {
    try {
		const {kos_id} = req.params;
        
        if (!/^\d+$/.test(kos_id)) {
            return res.status(400).json({ message: 'Neustrezen format za ID kosa!' });
        }

        if (!(await utils.kosObstaja(kos_id))) {
            return res.status(404).json({message: `Kos z ID-jem '${kos_id}' ne obstaja!`});
        }
                
        const sql = `
            SELECT 
                k.id,
                k.kos_id,
                k.besedilo,
                k.uporabnik_id,
                u.uporabnisko_ime
            FROM komentar k
            JOIN uporabnik u ON k.uporabnik_id = u.id
            WHERE k.kos_id = ?
        `;

        const [result] = await pool.execute(sql, [kos_id]);
        res.status(200).json(result);

    } catch (err) {
        next(err);
    }
});

/**
 * @swagger
 * /api/kosi/{kos_id}/komentarji/{id}:
 *   get:
 *     summary: Pridobivanje komentarja z vpisanim {id}
 *     tags: [Kosi]
 *     parameters:
 *       - in: path
 *         name: kos_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID kosa, ki mu pripada komentar
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
 *               $ref: '#/components/schemas/Komentarji'
 *       400:
 *         description: Neustrezen format za ID kosa ali komentarja
 *       404:
 *         description: Komentar z vpisanim {id} ne obstaja na kosu z vpisanim {kos_id}
 *       500:
 *         description: Notranja napaka strežnika
 */
router.get('/:id', authMiddleware, async (req, res, next) => {
    const {kos_id, id} = req.params;

    if (!/^\d+$/.test(kos_id)) {
        return res.status(400).json({ message: 'Neustrezen format za ID kosa!' });
    }
    if (!/^\d+$/.test(id)) {
        return res.status(400).json({ message: 'Neustrezen format za ID komentarja!' });
    }
    
    try {      
        const sql = `
            SELECT 
                k.id,
                k.kos_id,
                k.besedilo,
                k.uporabnik_id,
                u.uporabnisko_ime
            FROM komentar k
            JOIN uporabnik u ON k.uporabnik_id = u.id
            WHERE k.id = ? and k.kos_id = ?
        `;

        const [result] = await pool.execute(sql, [id, kos_id]);
        if (result.length === 0) {
            return res.status(404).json({ message: `Kos z ID-jem '${kos_id}' nima komentarja z ID-jem '${id}'!` });
        }

        res.status(200).json(result[0]);

    } catch (err) {
        next(err);
    }
});

/**
 * @swagger
 * /api/kosi/{kos_id}/komentarji:
 *   post:
 *     summary: Dodajanje komentarja na kos
 *     tags: [Kosi]
 *     parameters:
 *       - in: path
 *         name: kos_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID kosa, na katerega želimo dodati komentar
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - besedilo
 *             properties:
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
 *         description: Manjkajo podatki za dodajanje komentarja ali neustrezen format za ID kosa
 *       404:
 *         description: Kos z {kos_id} ne obstaja
 *       500:
 *         description: Notranja napaka strežnika
 */
router.post('/', authMiddleware, async (req, res, next) => {
    const {kos_id} = req.params;
    const {besedilo} = req.body;

    if (!/^\d+$/.test(kos_id)) {
        return res.status(400).json({ message: 'Neustrezen format za ID kosa!' });
    }
    
    if (!besedilo) { 
        return res.status(400).json({ message: 'Manjka podatek besedilo!' });
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
            const urlVira = utils.urlVira(req, `/api/kosi/${kos_id}/komentarji/${id}`);
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
 * /api/kosi/{kos_id}/komentarji/{id}:
 *   delete:
 *     summary: Brisanje obstoječega komentarja z {id}
 *     tags: [Kosi]
 *     parameters:
 *       - in: path
 *         name: kos_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID kosa, ki mu pripada komentar
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
 *         description: Neustrezen format za ID komentarja ali kosa
 *       404:
 *         description: Komentar z vpisanim {id} ne obstaja na kosu z vpisanim {kos_id}
 *       500:
 *         description: Notranja napaka strežnika
 */
router.delete('/:id', authMiddleware, async (req, res, next) => {
    const {kos_id, id} = req.params;
    
    if (!/^\d+$/.test(kos_id)) {
        return res.status(400).json({ message: 'Neustrezen format za ID kosa!' });
    }
    if (!/^\d+$/.test(id)) {
        return res.status(400).json({ message: 'Neustrezen format za ID komentarja!' });
    }

    try {        
        const [result] = await pool.execute('DELETE FROM komentar WHERE id = ? AND kos_id = ?', [id, kos_id]);
        
        if (result.affectedRows === 1) {
            return res.status(204).send();
        } 

        return res.status(404).json({ message: `Komentar z ID-jem '${id}' ne obstaja na kosu z ID-jem '${kos_id}'!` });

    } catch (err) {
        next(err);
    }
});

/**
 * @swagger
 * /api/kosi/{kos_id}/komentarji/{id}:
 *   put:
 *     summary: Posodabljanje vsebine komentarja z vpisanim {id}
 *     tags: [Kosi]
 *     parameters:
 *       - in: path
 *         name: kos_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID kosa, ki mu pripada komentar
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
 *             required:
 *               - besedilo
 *             properties:
 *               besedilo:
 *                 type: string
 *     responses:
 *       204:
 *         description: Uspešno posodobljen komentar
 *       400:
 *         description: Manjkajo podatki za shranjevanje komentarja ali neustrezen format za ID komentarja ali kosa
 *       404:
 *         description: Komentar z vpisanim {id} ne obstaja na kosu z vpisanim {kos_id}
 *       500:
 *         description: Notranja napaka strežnika
 */
router.put('/:id', authMiddleware, async (req, res, next) => {
    const {kos_id, id} = req.params;
    const {besedilo} = req.body; //samo 'besedilo' se lahko posodobi

    if (!/^\d+$/.test(kos_id)) {
        return res.status(400).json({ message: 'Neustrezen format za ID kosa!' });
    }
    if (!/^\d+$/.test(id)) {
        return res.status(400).json({ message: 'Neustrezen format za ID komentarja!' });
    }
    
    if(!besedilo){
        return res.status(400).json({message: 'Manjkajo podatki za posodabljanje komentarja!'});
    }

    try{
        if (!(await utils.kosObstaja(kos_id))) {
            return res.status(404).json({message: `Kos z ID-jem '${kos_id}' ne obstaja!`});
        }

        const sql = 'UPDATE komentar SET besedilo=? WHERE id=? AND kos_id=?';
        const [result] = await pool.execute(sql, [besedilo, id, kos_id]);
        
        if (result.affectedRows === 1) {
            return res.status(204).send(); //204 je No Content - tut če pripnemo message, se ne prikaže
        } 

        return res.status(404).json({ message: `Komentar z ID-jem '${id}' ne obstaja na kosu z ID-jem '${kos_id}'!` });

    } catch (err) {
        next(err);
    }
});

module.exports = router;
