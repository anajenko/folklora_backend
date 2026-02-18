const express = require('express');
const router = express.Router();
const pool = require('../utils/db.js'); // uvozimo Connection Pool
const utils = require('../utils/utils.js'); // uvozimo pomožne funckije
const bcrypt = require('bcrypt'); // knjižnica za zgoščevanje gesel (hash)
const jwt = require('jsonwebtoken');

/**
 * @swagger
 * components:
 *   schemas:
 *     Uporabniki:
 *       type: object
 *       properties:
 *         id:
 *          type: integer
 *         uporabnisko_ime:
 *           type: string
 *         tip_uporabnika:
 *           type: string
 *           enum:
 *             - garderober/-ka
 *             - plesalec/-ka
 *             - glasbenik/-ca
 */

/**
 * @swagger
 * /api/uporabniki:
 *   post:
 *     security: []
 *     summary: Dodajanje novega uporabnika => registracija
 *     description: Ustvari novega uporabnika z zgoščenim (hash) geslom.
 *     tags: [Uporabniki]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               uporabnisko_ime:
 *                 type: string
 *               geslo:
 *                 type: string
 *               tip_uporabnika:
 *                 type: string
 *                 enum:
 *                   - garderober/-ka
 *                   - plesalec/-ka
 *                   - glasbenik/-ca
 *     responses:
 *       201:
 *         description: Uporabnik uspešno dodan
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
 *         description: Manjkajo podatki za registracijo
 *       409:
 *         description: Uporabniško ime že obstaja
 *       500:
 *         description: Napaka pri dodajanju uporabnika
 */
router.post('/', async (req, res, next) => {
    const {uporabnisko_ime, geslo, tip_uporabnika} = req.body;
    
    if(!uporabnisko_ime || !geslo || !tip_uporabnika){
        return res.status(400).json({message: 'Manjkajo podatki za registracijo!'})
    }

    try {
        if (await utils.uporabnikObstaja(uporabnisko_ime)) {
            return res.status(409).json({message: 'Uporabniško ime je že zasedeno!'})
        }

        const hashed_geslo = await bcrypt.hash(geslo, 10); //geslo je hash od gesla

        const sql = 'INSERT INTO uporabnik (uporabnisko_ime, geslo, tip_uporabnika) VALUES (?, ?, ?)';
        const [result] = await pool.execute(sql, [uporabnisko_ime, hashed_geslo, tip_uporabnika]);

        if (result.affectedRows === 1) {
            const urlVira = utils.urlVira(req, `/api/uporabniki/${uporabnisko_ime}`);
            res.location(urlVira);
            res.status(201).json({
                message: 'Uporabnik uspešno dodan!',
                url:urlVira
            });
        } else {
            res.status(500).json({message: 'Dodajanje uporabnika NI bilo uspešno!'})
        }

    } catch (err) {
        console.error('Registration exception:', err);
        next(err);
    }
}); 

/**
 * @swagger
 * /api/uporabniki/prijava:
 *   post:
 *     security: []
 *     summary: Prijava uporabnika
 *     description: Preveri uporabniško ime in geslo ter vrne JWT žeton.
 *     tags: [Uporabniki]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - uporabnisko_ime
 *               - geslo
 *             properties:
 *               uporabnisko_ime:
 *                 type: string
 *               geslo:
 *                 type: string
 *     responses:
 *       200:
 *         description: Prijava uspešna
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 token:
 *                   type: string
 *                   description: JWT žeton za avtentikacijo
 *                 uporabnisko_ime:
 *                   type: string
 *       400:
 *         description: Manjkajo podatki za prijavo
 *       401:
 *         description: Napačno uporabniško ime ali geslo
 *       500:
 *         description: Napaka strežnika
 */
router.post('/prijava', async (req, res, next) => {
    const {uporabnisko_ime, geslo} = req.body;

    if(!uporabnisko_ime || !geslo){
        return res.status(400).json({message: 'Manjkajo podatki za prijavo!'}) 
    }

    try {
        if (!(await utils.uporabnikObstaja(uporabnisko_ime))) {
            return res.status(401).json({message: 'Uporabnik z vpisanim uporabniškim imenom ne obstaja ali pa kombinacija uporabniškega imena in gesla ni pravilna!'})
        }

        const [rows] = await pool.execute('SELECT * FROM uporabnik WHERE uporabnisko_ime = ?', [uporabnisko_ime]);
        const uporabnik = rows[0];

        const gesloSeUjema = await bcrypt.compare(geslo, uporabnik.geslo);

        if (!gesloSeUjema) {
            return res.status(401).json({message: 'Uporabnik z vpisanim uporabniškim imenom ne obstaja ali pa kombinacija uporabniškega imena in gesla ni pravilna!'})
        } 
        
        const token = jwt.sign(
            {
                id: uporabnik.id,
                uporabnisko_ime: uporabnik.uporabnisko_ime,
                tip_uporabnika: uporabnik.tip_uporabnika
            },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );
        
        res.status(200).json({message: 'Prijava uspešna!', token: token, uporabnisko_ime: uporabnik.uporabnisko_ime});
    } catch (err) {
        next(err);
    }
}); 

module.exports = router;