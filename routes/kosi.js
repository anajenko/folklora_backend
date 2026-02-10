const express = require('express');
const router = express.Router();
const pool = require('../utils/db.js'); // uvozimo Connection Pool
const utils = require('../utils/utils.js');
const multer = require('multer'); // nalaganje slik
const upload = multer({storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 }}); // pomnilnik max 10MB
const { fileTypeFromBuffer } = require('file-type');

/**
 * @swagger
 * components:
 *   schemas:
 *     Kosi:
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
 *         poskodovano:
 *           type: boolean
 *           description: Zastavica, če je kos poškodovan (1 -> je poškodovan)
 *           default: false
 */
/**
 * @swagger
 * /api/kosi:
 *   get:
 *     summary: Pridobivanje vseh kosov (id, ime, tip) brez slike
 *     tags: [Kosi]
 *     responses:
 *       200:
 *         description: Uspešno vrnjen seznam vseh kosov
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Kos'
 *       500:
 *         description: Notranja napaka strežnika
 */
router.get('/', async (req, res, next) => { // = '/kosi'
    try {
        // Uporabimo pool.execute() za varno izvedbo poizvedbe
        const [rows] = await pool.execute('SELECT id, ime, tip, poskodovano FROM kos');
        res.status(200).json(rows);		// Pošljemo podatke uporabniku kot JSON
    } catch (err) {
        next(err);
	}
});

/**
 * @swagger
 * /api/kosi/{id}:
 *   get:
 *     summary: Pridobivanje atriubuta vsebina kosa z {id} - samo slika
 *     tags: [Kosi]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID kosa
 *     responses:
 *       200:
 *         description: Vsebina kosa
 *         content:
 *           image/jpeg:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Neustrezen format za {id} kosa
 *       404:
 *         description: Kos z vpisanim {id} ne obstaja
 *       500:
 *         description: Notranja napaka strežnika
 */
router.get('/:id', async (req, res, next) => {
    try {
		const id = req.params.id;

        if (!/^\d+$/.test(id)) { //regex: številka & en ali več
            return res.status(400).json({ message: 'Neustrezen format za ID kosa!' });
        }

		if (!(await utils.kosObstaja(id))) {
            return res.status(404).json({
                message: `Kos z ID-jem '${id}' ne obstaja!`
            });
        }

        const [rows] = await pool.execute('SELECT ime, tip, vsebina, poskodovano FROM kos WHERE id=?', [id]);
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
 * /api/kosi:
 *   post:
 *     summary: Dodajanje novega kosa
 *     tags: [Kosi]
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
 *                 $ref: '#/components/schemas/Kos/properties/tip'
 *               slika:
 *                 type: string
 *                 format: binary
 *                 description: Binarna vsebina kosa (slika, pdf, audio, video)
 *     responses:
 *       201:
 *         description: Kos uspešno dodan
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
 *         description: Manjkajo podatki za dodajanje novega kosa ali vsebina ne ustreza izbranemu tipu ali tip kosa ni pravilen
 *       409: 
 *         description: Kos z istim imenom že obstaja  
 *       415:
 *         description: Nepodprt tip kosa
 *       500:
 *         description: Notranja napaka strežnika
 */
router.post('/', upload.single('slika'), async (req, res, next) => {
    const {ime, tip} = req.body;

    if(!ime || !tip || !req.file){
        return res.status(400).json({message: 'Manjkajo podatki za dodajanje novega kosa!'})
        //ce posljes kodo namesto message, lahko jezik nastavis na klientu
    }

    const dovoljeniTipi = ['slika', 'audio', 'video', 'pdf'];
    if (!dovoljeniTipi.includes(tip)) {
        return res.status(400).json({
            message: `Neveljaven tip kosa! Dovoljeni tipi: ${dovoljeniTipi.join(', ')}`
        });
    }

    const vsebina = req.file.buffer; //BLOB podatki
    try {
        //ali že obstaja kos z istim imenom
        const [rows] = await pool.execute('SELECT id FROM kos WHERE ime = ?', [ime]);
        if (rows.length > 0) {
            return res.status(409).json({ message: 'Kos z istim imenom že obstaja!' });
        }

        //preverim dejanski tip vnesenega kosa
        const detectedType = await fileTypeFromBuffer(vsebina);
        if (!detectedType) {
            return res.status(415).json({message: 'Nepodprt tip kosa!'});
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
            return res.status(400).json({message: `Vsebina kosa ne ustreza izbranemu tipu '${tip}'!`})
        }

        const sql = 'INSERT INTO kos (ime, tip, vsebina, poskodovano) VALUES (?, ?, ?, false)';
        const [result] = await pool.execute(sql, [ime, tip, vsebina]);

        if (result.affectedRows === 1) {
            const id = result.insertId; //id novega kosa
            const urlVira = utils.urlVira(req, `/api/kosi/${id}`);
            res.location(urlVira);
            return res.status(201).json({
                message: 'Kos uspešno dodan.',
                url:urlVira
            });
        } 
        throw new Error('Dodajanje kosa ni bilo uspešno!');
    } catch (err) {
        next(err);
    }
}); 

/**
 * @swagger
 * /api/kosi/{id}:
 *   delete:
 *     summary: Brisanje obstoječega kosa z {id}
 *     tags: [Kosi]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID kosa za brisanje
 *     responses:
 *       204:
 *         description: Kos je bil uspešno izbrisan
 *       400:
 *         description: Neustrezen format za {id} kosa
 *       404:
 *         description: Kos z vpisanim {id} ne obstaja
 *       500:
 *         description: Notranja napaka strežnika
 */
router.delete('/:id', async (req, res, next) => {
    const id = req.params.id;

    if (!/^\d+$/.test(id)) {
        return res.status(400).json({ message: 'Neustrezen format za ID kosa!' });
    }

    try {        
        if (!(await utils.kosObstaja(id))) {
            return res.status(404).json({ message: `Kos z ID-jem '${id}' ne obstaja!` });
        }
        
        const [result] = await pool.execute('DELETE FROM kos WHERE id = ?', [id]);
        
        if (result.affectedRows === 1) {
            return res.status(204).send();
        } 
        throw new Error('Brisanje kosa ni bilo uspešno!');
    } catch (err) {
        next(err);
    }
});

/**
 * @swagger
 * /api/kosi/{id}:
 *   put:
 *     summary: Posodabljanje imena kosa z {id} (ime ali poskodovano)
 *     tags: [Kosi]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID kosa
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ime:
 *                 type: string
 *                 description: Novo ime kosa
 *              poskodovano:
 *                type: boolean
 *                description: Zastavica, če je kos poškodovan (true -> je poškodovan)
 *     responses:
 *       204:
 *         description: Uspešno posodobljen kos
 *       400:
 *         description: Manjkajo podatki za shranjevanje kosa ali format za {id} kosa ni ustrezen
 *       404:
 *         description: Kos z vpisanim {id} ne obstaja
 *       500:
 *         description: Notranja napaka strežnika
 */
router.put('/:id', async (req, res, next) => {
    const id = req.params.id;
    const {ime, poskodovano} = req.body; //samo 'ime' in 'poskodovno' se lahko posodobi

    if (!/^\d+$/.test(id)) {
        return res.status(400).json({ message: 'Neustrezen format za ID kosa!' });
    }
    
    try{
        if (!(await utils.kosObstaja(id))) {
            return res.status(404).json({message: `Kos z ID-jem '${id}' ne obstaja!`});
        }

        // Gradimo dinamični SQL glede na poslana polja
        const updates = [];
        const params = [];

        if (ime !== undefined) {
            updates.push('ime = ?');
            params.push(ime);
        }

        if (poskodovano !== undefined) {
            // poskodovano naj bo vedno 0 ali 1
            const val = poskodovano ? 1 : 0;
            updates.push('poskodovano = ?');
            params.push(val);
        }

        if (updates.length === 0) {
            return res.status(400).json({ message: 'Ni podatkov za posodobitev!' });
        }

        params.push(id); // id za WHERE

        const sql = `UPDATE kos SET ${updates.join(', ')} WHERE id = ?`;
        const [result] = await pool.execute(sql, params);

        if (result.affectedRows === 1) {
            return res.status(204).send();
        }

        /*if(!ime){
            return res.status(400).json({message: 'Manjka podatek *ime* za posodabljanje kosa!'});
        }

        const sql = 'UPDATE kos SET ime=? WHERE id=?';
        const [result] = await pool.execute(sql, [ime, id]);
        
        if (result.affectedRows === 1) {
            return res.status(204).send(); 
        } */
        throw new Error('Spreminjanje kosa ni bilo uspešno!');
    } catch (err) {
        next(err);
    }
});

/**
 * @swagger
 * /api/kosi/{kos_id}/labele/{labela_id}:
 *   post:
 *     summary: Dodajanje labele na kos
 *     tags: [Kosi]
 *     parameters:
 *       - in: path
 *         name: kos_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID kosa
 *       - in: path
 *         name: labela_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID labele
 *     responses:
 *       201:
 *         description: Labela uspešno dodana na kos
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
 *         description: Manjkajo podatki kos_id ali labela_id ali {id} ni pravega formata
 *       404:
 *         description: Kos z {kos_id} ali labela z {labela_id} ne obstaja
 *       409:
 *         description: Ta labela je že povezana s kosom
 *       500:
 *         description: Notranja napaka strežnika
 */
// dodajanje labele :lab_id na kos :kos_id ----> kosi/:id/labele/:labela_id
router.post('/:kos_id/labele/:labela_id', async (req, res, next) => {
    const {kos_id, labela_id} = req.params;

    if (!kos_id || !labela_id) {
        return res.status(400).json({ message: 'Manjkajo podatki: kos_id ali labela_id!' });
    }
    if (!/^\d+$/.test(kos_id) || !/^\d+$/.test(labela_id)) {
        return res.status(400).json({ message: 'ID mora biti številka.' });
    }

    try {
        if (!(await utils.kosObstaja(kos_id))) {
            return res.status(404).json({ message: `Kos z ID-jem '${kos_id}' ne obstaja!` });
        }

        if (!(await utils.labelaObstaja(labela_id))) {
            return res.status(404).json({ message: `Labela z ID-jem '${labela_id}' ne obstaja!` });
        }
        
        const sql = 'INSERT INTO kos_labela (kos_id, labela_id) VALUES (?, ?)';
        const [result] = await pool.execute(sql, [kos_id, labela_id]);

        if (result.affectedRows === 1) {
            const id = result.insertId; //id nove labele
            const urlVira = utils.urlVira(req, `/api/kosi/${kos_id}/labele/${labela_id}`);
            res.location(urlVira);
            return res.status(201).json({
                message: 'Labela uspešno dodana na kos.',
                url:urlVira
            });
        }
        throw new Error('Dodajanje labele na kos ni bilo uspešno!');
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Ta labela je že povezana s kosom!' });
        } else {
            next(err);
        }
    }
});

/**
 * @swagger
 * /api/kosi/{kos_id}/labele/{labela_id}:
 *   delete:
 *     summary: Brisanje labele s kosa
 *     tags: [Kosi]
 *     parameters:
 *       - in: path
 *         name: kos_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID kosa
 *       - in: path
 *         name: labela_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID labele
 *     responses:
 *       204:
 *         description: Labela je bila uspešno odstranjena s kosa
 *       400:
 *         description: Neustrezen format za {id} kosa ali {id} labele
 *       404:
 *         description: Povezava kos_labela ne obstaja
 *       500:
 *         description: Notranja napaka strežnika
 */
// brisanje labele :lab_id z kosa :kos_id --------> kosi/:id/labele/:labela_id
router.delete('/:kos_id/labele/:labela_id', async (req, res, next) => {
    const {kos_id, labela_id} = req.params;

    if (!/^\d+$/.test(kos_id) || !/^\d+$/.test(labela_id)) {
        return res.status(400).json({ message: 'ID mora biti številka!' });
    }

    try {
        // Preverimo, če povezava obstaja
        const [povezava] = await pool.execute('SELECT kos_id, labela_id FROM kos_labela WHERE kos_id = ? AND labela_id = ?', [kos_id, labela_id]);
        if (povezava.length === 0) {
            return res.status(404).json({ message: 'Povezava kos_labela ne obstaja!' });
        }
        
        const sql = 'DELETE FROM kos_labela WHERE kos_id = ? AND labela_id = ?';
        const [result] = await pool.execute(sql, [kos_id, labela_id]);

        if (result.affectedRows === 1) {
            return res.status(204).send();
        }
        throw new Error('Brisanje labele iz kosa ni bilo uspešno!');
    } catch (err) {
        next(err);
    }
});

module.exports = router;