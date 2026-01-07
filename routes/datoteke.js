const express = require('express');
const router = express.Router();
const pool = require('../utils/db.js'); // uvozimo Connection Pool
const utils = require('../utils/utils.js');
const multer = require('multer'); // nalaganje datotek
const upload = multer({storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 }}); // pomnilnik max 10MB
const { fileTypeFromBuffer } = require('file-type');

/**
 * @swagger
 * components:
 *   schemas:
 *     Datoteke:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         ime:
 *           type: string
 *         tip:
 *           type: string
 *           enum: 
 *             - slika
 *             - audio
 *             - video
 *             - pdf
 */
/**
 * @swagger
 * /api/datoteke:
 *   get:
 *     summary: Pridobivanje vseh datotek (id, ime, tip) brez slike
 *     tags: [Datoteke]
 *     responses:
 *       200:
 *         description: Uspešno vrnjen seznam vseh datotek
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Datoteke'
 *       500:
 *         description: Notranja napaka strežnika
 */
router.get('/', async (req, res, next) => { // = '/datoteke'
    try {
        // Uporabimo pool.execute() za varno izvedbo poizvedbe
        const [rows] = await pool.execute('SELECT id, ime, tip FROM datoteka');
        res.status(200).json(rows);		// Pošljemo podatke uporabniku kot JSON
    } catch (err) {
        next(err);
	}
});

/**
 * @swagger
 * /api/datoteke/{id}:
 *   get:
 *     summary: Pridobivanje atriubuta vsebina datoteke z {id} - samo slika
 *     tags: [Datoteke]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID datoteke
 *     responses:
 *       200:
 *         description: Vsebina datoteke
 *         content:
 *           image/jpeg:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Neustrezen format za {id} datoteke
 *       404:
 *         description: Datoteka z vpisanim {id} ne obstaja
 *       500:
 *         description: Notranja napaka strežnika
 */
router.get('/:id', async (req, res, next) => {
    try {
		const id = req.params.id;

        if (!/^\d+$/.test(id)) { //regex: številka & en ali več
            return res.status(400).json({ message: 'Neustrezen format za ID datoteke!' });
        }

		if (!(await utils.datotekaObstaja(id))) {
            return res.status(404).json({
                message: `Datoteka z ID-jem '${id}' ne obstaja!`
            });
        }

        const [rows] = await pool.execute('SELECT ime, tip, vsebina FROM datoteka WHERE id=?', [id]);
        const file = rows[0];

        // nastavimo pravi MIME glede na 'tip'
        let contentType = 'application/octet-stream';
        switch (file.tip) {
            case 'slika':
                contentType = 'image/jpeg';
                break;
            case 'audio':
                contentType = 'audio/mpeg';
                break;
            case 'video':
                contentType = 'video/mp4';
                break;
            case 'pdf':
                contentType = 'application/pdf';
                break;
        }

        res.setHeader('Content-Type', contentType);
        res.send(file.vsebina); // pošljemo raw BLOB 
    } catch (err) {
        next(err);
    }
});

/**
 * @swagger
 * /api/datoteke:
 *   post:
 *     summary: Dodajanje nove datoteke
 *     tags: [Datoteke]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               ime:
 *                 type: string
 *               tip:
 *                 $ref: '#/components/schemas/Datoteke/properties/tip'
 *               slika:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Datoteka uspešno dodana
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
 *         description: Manjkajo podatki za dodajanje nove datoteke ali vsebina ne ustreza izbranemu tipu ali tip datoteke ni pravilen
 *       409: 
 *         description: Datoteka z istim imenom že obstaja  
 *       415:
 *         description: Nepodprt tip datoteke
 *       500:
 *         description: Notranja napaka strežnika
 */
router.post('/', upload.single('slika'), async (req, res, next) => {
    const {ime, tip} = req.body;

    if(!ime || !tip || !req.file){
        return res.status(400).json({message: 'Manjkajo podatki za dodajanje nove datoteke!'})
        //ce posljes kodo namesto message, lahko jezik nastavis na klientu
    }

    const dovoljeniTipi = ['slika', 'audio', 'video', 'pdf'];
    if (!dovoljeniTipi.includes(tip)) {
        return res.status(400).json({
            message: `Neveljaven tip datoteke! Dovoljeni tipi: ${dovoljeniTipi.join(', ')}`
        });
    }

    const vsebina = req.file.buffer; //BLOB podatki
    try {
        //ali že obstaja datoteka z istim imenom
        const [rows] = await pool.execute('SELECT id FROM datoteka WHERE ime = ?', [ime]);
        if (rows.length > 0) {
            return res.status(409).json({ message: 'Datoteka z istim imenom že obstaja!' });
        }

        //preverim dejanski tip vnesene datoteke
        const detectedType = await fileTypeFromBuffer(vsebina);
        if (!detectedType) {
            return res.status(415).json({message: 'Nepodprt tip datoteke!'});
        }
        // Mapiranje MIME -> moj tip
        const mimeMap = {
            'image/jpeg': 'slika',
            'application/pdf': 'pdf',
            'audio/mpeg': 'audio',
            'video/mp4': 'video'
        }
        const realTip = mimeMap[detectedType.mime];
        if (tip !== realTip) {
            return res.status(400).json({message: `Vsebina datoteke ne ustreza izbranemu tipu '${tip}'!`})
        }

        const sql = 'INSERT INTO datoteka (ime, tip, vsebina) VALUES (?, ?, ?)';
        const [result] = await pool.execute(sql, [ime, tip, vsebina]);

        if (result.affectedRows === 1) {
            const id = result.insertId; //id nove datoteke
            const urlVira = utils.urlVira(req, `/api/datoteke/${id}`);
            res.location(urlVira);
            return res.status(201).json({
                message: 'Datoteka uspešno dodana.',
                url:urlVira
            });
        } 
        throw new Error('Dodajanje datoteke ni bilo uspešno!');
    } catch (err) {
        next(err);
    }
}); 

/**
 * @swagger
 * /api/datoteke/{id}:
 *   delete:
 *     summary: Brisanje obstoječe datoteke z {id}
 *     tags: [Datoteke]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID datoteke za brisanje
 *     responses:
 *       204:
 *         description: Datoteka je bila uspešno izbrisana
 *       400:
 *         description: Neustrezen format za {id} datoteke
 *       404:
 *         description: Datoteka z vpisanim {id} ne obstaja
 *       500:
 *         description: Notranja napaka strežnika
 */
router.delete('/:id', async (req, res, next) => {
    const id = req.params.id;

    if (!/^\d+$/.test(id)) {
        return res.status(400).json({ message: 'Neustrezen format za ID datoteke!' });
    }

    try {        
        if (!(await utils.datotekaObstaja(id))) {
            return res.status(404).json({ message: `Datoteka z ID-jem '${id}' ne obstaja!` });
        }
        
        const [result] = await pool.execute('DELETE FROM datoteka WHERE id = ?', [id]);
        
        if (result.affectedRows === 1) {
            return res.status(204).send();
        } 
        throw new Error('Brisanje datoteke ni bilo uspešno!');
    } catch (err) {
        next(err);
    }
});

/**
 * @swagger
 * /api/datoteke/{id}:
 *   put:
 *     summary: Posodabljanje imena datoteke z {id}
 *     tags: [Datoteke]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID datoteke
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ime:
 *                 type: string
 *                 description: Novo ime datoteke
 *     responses:
 *       204:
 *         description: Uspešno posodobljena datoteka
 *       400:
 *         description: Manjkajo podatki za shranjevanje datoteke ali format za {id} datoteke ni ustrezen
 *       404:
 *         description: Datoteka z vpisanim {id} ne obstaja
 *       500:
 *         description: Notranja napaka strežnika
 */
router.put('/:id', async (req, res, next) => {
    const id = req.params.id;
    const {ime} = req.body; //samo 'ime' se lahko posodobi

    if (!/^\d+$/.test(id)) {
        return res.status(400).json({ message: 'Neustrezen format za ID datoteke!' });
    }
    
    try{
        if (!(await utils.datotekaObstaja(id))) {
            return res.status(404).json({message: `Datoteka z ID-jem '${id}' ne obstaja!`});
        }

        if(!ime){
            return res.status(400).json({message: 'Manjka podatek *ime* za posodabljanje datoteke!'});
        }

        const sql = 'UPDATE datoteka SET ime=? WHERE id=?';
        const [result] = await pool.execute(sql, [ime, id]);
        
        if (result.affectedRows === 1) {
            return res.status(204).send(); 
        } 
        throw new Error('Spreminjanje datoteke ni bilo uspešno!');
    } catch (err) {
        next(err);
    }
});

/**
 * @swagger
 * /api/datoteke/{datoteka_id}/labele/{labela_id}:
 *   post:
 *     summary: Dodajanje labele na datoteko
 *     tags: [Datoteke]
 *     parameters:
 *       - in: path
 *         name: datoteka_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID datoteke
 *       - in: path
 *         name: labela_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID labele
 *     responses:
 *       201:
 *         description: Labela uspešno dodana na datoteko
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
 *         description: Manjkajo podatki datoteka_id ali labela_id ali {id} ni pravega formata
 *       404:
 *         description: Datoteka z {datoteka_id} ali labela z {labela_id} ne obstaja
 *       409:
 *         description: Ta labela je že povezana z datoteko
 *       500:
 *         description: Notranja napaka strežnika
 */
// dodajanje labele :lab_id na datoteko :dat_id ----> datoteke/:id/labele/:labela_id
router.post('/:datoteka_id/labele/:labela_id', async (req, res, next) => {
    const {datoteka_id, labela_id} = req.params;

    if (!datoteka_id || !labela_id) {
        return res.status(400).json({ message: 'Manjkajo podatki: datoteka_id ali labela_id!' });
    }
    if (!/^\d+$/.test(datoteka_id) || !/^\d+$/.test(labela_id)) {
        return res.status(400).json({ message: 'ID mora biti številka.' });
    }

    try {
        if (!(await utils.datotekaObstaja(datoteka_id))) {
            return res.status(404).json({ message: `Datoteka z ID-jem '${datoteka_id}' ne obstaja!` });
        }

        if (!(await utils.labelaObstaja(labela_id))) {
            return res.status(404).json({ message: `Labela z ID-jem '${labela_id}' ne obstaja!` });
        }
        
        const sql = 'INSERT INTO datoteka_labela (datoteka_id, labela_id) VALUES (?, ?)';
        const [result] = await pool.execute(sql, [datoteka_id, labela_id]);

        if (result.affectedRows === 1) {
            const id = result.insertId; //id nove labele
            const urlVira = utils.urlVira(req, `/api/datoteke/${datoteka_id}/labele/${labela_id}`);
            res.location(urlVira);
            return res.status(201).json({
                message: 'Labela uspešno dodana na datoteko.',
                url:urlVira
            });
        }
        throw new Error('Dodajanje labele na datoteko ni bilo uspešno!');
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Ta labela je že povezana z datoteko!' });
        } else {
            next(err);
        }
    }
});

/**
 * @swagger
 * /api/datoteke/{datoteka_id}/labele/{labela_id}:
 *   delete:
 *     summary: Brisanje labele z datoteke
 *     tags: [Datoteke]
 *     parameters:
 *       - in: path
 *         name: datoteka_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID datoteke
 *       - in: path
 *         name: labela_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID labele
 *     responses:
 *       204:
 *         description: Labela je bila uspešno odstranjena z datoteke
 *       400:
 *         description: Neustrezen format za {id} datoteke ali {id} labele
 *       404:
 *         description: Povezava datoteka_labela ne obstaja
 *       500:
 *         description: Notranja napaka strežnika
 */
// brisanje labele :lab_id z datoteke :dat_id --------> datoteke/:id/labele/:labela_id
router.delete('/:datoteka_id/labele/:labela_id', async (req, res, next) => {
    const {datoteka_id, labela_id} = req.params;

    if (!/^\d+$/.test(datoteka_id) || !/^\d+$/.test(labela_id)) {
        return res.status(400).json({ message: 'ID mora biti številka!' });
    }

    try {
        // Preverimo, če povezava obstaja
        const [povezava] = await pool.execute('SELECT datoteka_id, labela_id FROM datoteka_labela WHERE datoteka_id = ? AND labela_id = ?', [datoteka_id, labela_id]);
        if (povezava.length === 0) {
            return res.status(404).json({ message: 'Povezava datoteka_labela ne obstaja!' });
        }
        
        const sql = 'DELETE FROM datoteka_labela WHERE datoteka_id = ? AND labela_id = ?';
        const [result] = await pool.execute(sql, [datoteka_id, labela_id]);

        if (result.affectedRows === 1) {
            return res.status(204).send();
        }
        throw new Error('Brisanje labele iz datoteke ni bilo uspešno!');
    } catch (err) {
        next(err);
    }
});

module.exports = router;