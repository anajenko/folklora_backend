const express = require('express');
const router = express.Router();
const pool = require('../utils/db.js'); // uvozimo Connection Pool
const utils = require('../utils/utils.js');
const multer = require('multer'); // nalaganje datotek
const upload = multer({storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 }}); // pomnilnik max 10MB
const { fileTypeFromBuffer } = require('file-type');

router.get('/', async (req, res, next) => { // = '/datoteke'
    try {
        // Uporabimo pool.execute() za varno izvedbo poizvedbe
        const [rows, fields] = await pool.execute('SELECT id, ime, tip, vsebina FROM datoteka');
        
        if (rows.length === 0) { // tabela je prazna
            return res.status(204).send(); //204 je No Content - tut če pripnemo message, se ne prikaže
        }
        res.status(200).json(rows);		// Pošljemo podatke uporabniku kot JSON
    } catch (err) {
        next(err);
	}
});
 
router.get('/:id', async (req, res, next) => {
    try {
		const id = req.params.id;

        if (!/^\d+$/.test(id)) { //regex: any digit & one or more
            return res.status(400).json({ message: 'Neustrezen format za ID datoteke' });
        }

        const [rows] = await pool.execute('SELECT ime, tip, vsebina FROM datoteka WHERE id=?', [id]);
        
		if (rows.length === 0) {
            return res.status(404).json({
                message: `Datoteka z ID-jem '${id}' ne obstaja.`
            });
        }
        
        const file = rows[0];

        // Set proper MIME type based on 'tip'
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
        res.send(file.vsebina); // send raw BLOB
    } catch (err) {
        next(err);
    }
});

//pridobivanje vseh datotek z labelo :id
router.get('/labele/:labela_id', async (req, res, next) => {
    try {
		const id = req.params.labela_id;
       
        if (!/^\d+$/.test(id)) { //regex: any digit & one or more
            return res.status(400).json({ message: 'Neustrezen format za ID labele.' });
        }

        const [labele] = await pool.execute('SELECT id, naziv, tip FROM labela WHERE id = ?', [id]);
        if (labele.length === 0) {
            return res.status(404).json({ message: `Labela z ID-jem '${id}' ne obstaja.` });
        }

        const sql = `
            SELECT id, ime, tip, vsebina 
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

router.post('/', upload.single('slika'), async (req, res, next) => {
    const {ime, tip} = req.body;

    if(!ime || !tip || !req.file){
        return res.status(400).json({message: 'Manjkajo podatki za dodajanje nove datoteke!'})
        //ce posljes kodo namesto message, lahko jezik nastavis na klientu
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
            return res.status(415).json({message: 'Nepodprt tip datoteke!'})
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
            const urlVira = utils.urlVira(req, `/datoteke/${id}`);
            res.location(urlVira);
            res.status(201).json({
                message: 'Datoteka uspešno dodana!',
                url:urlVira
            });
        } 
        throw new Error('Dodajanje datoteke ni bilo uspešno.');
    } catch (err) {
        next(err);
    }
}); 

router.delete('/:id', async (req, res, next) => {
    const id = req.params.id;

    if (!/^\d+$/.test(id)) {
        return res.status(400).json({ message: 'Neustrezen format za ID datoteke' });
    }

    try {
        const [existingData] = await pool.execute('SELECT id FROM datoteka WHERE id = ?', [id]);
        
        if (existingData.length === 0) {
            return res.status(404).json({ message: 'Datoteka ni najdena.' });
        }
        const [result] = await pool.execute('DELETE FROM datoteka WHERE id = ?', [id]);
        
        if (result.affectedRows === 1) {
            res.status(204).send();
        } 
        throw new Error('Brisanje datoteke ni bilo uspešno.');
    } catch (err) {
        next(err);
    }
});

router.put('/:id', async (req, res, next) => {
    const id = req.params.id;
    const {ime} = req.body; //samo 'ime' se lahko posodobi

    if (!/^\d+$/.test(id)) {
        return res.status(400).json({ message: 'Neustrezen format za ID datoteke' });
    }
    
    try{
        if (!(await utils.datotekaObstaja(id))) {
            return res.status(404).json({message: 'Datoteka ne obstaja!'});
        }

        if(!ime){
            return res.status(400).json({message: 'Manjka podatek *ime* za posodabljanje datoteke ali pa ni pravilno vnesen'});
        }

        const sql = 'UPDATE datoteka SET ime=? WHERE id=?';
        const [result] = await pool.execute(sql, [ime, id]);
        
        if (result.affectedRows === 1) {
            res.status(204).send(); 
        } 
        throw new Error('Spreminjanje datoteke ni bilo uspešno.');
    } catch (err) {
        next(err);
    }
});

// dodajanje labele :lab_id na datoteko :dat_id ----> datoteke/:id/labele/:labela_id
router.post('/:datoteka_id/labele/:labela_id', async (req, res, next) => {
    const {datoteka_id, labela_id} = req.params;

    if (!datoteka_id || !labela_id) {
        return res.status(400).json({ message: 'Manjkajo podatki: datoteka_id ali labela_id.' });
    }
    if (!/^\d+$/.test(datoteka_id) || !/^\d+$/.test(labela_id)) {
        return res.status(400).json({ message: 'ID mora biti številka.' });
    }

    try {
        // Preverimo, če datoteka obstaja
        if (!(await utils.datotekaObstaja(datoteka_id))) {
            return res.status(404).json({ message: 'Datoteka ne obstaja!' });
        }

        // Preverimo, če labela obstaja
        const [labela] = await pool.execute('SELECT id FROM labela WHERE id = ?', [labela_id]);
        if (labela.length === 0) {
            return res.status(404).json({ message: 'Labela ne obstaja!' });
        }
        
        const sql = 'INSERT INTO datoteka_labela (datoteka_id, labela_id) VALUES (?, ?)';
        const [result] = await pool.execute(sql, [datoteka_id, labela_id]);

        if (result.affectedRows === 1) {
            const id = result.insertId; //id nove labele
            const urlVira = utils.urlVira(req, `/datoteke/${datoteka_id}/labele/${labela_id}`);
            res.location(urlVira);
            res.status(201).json({
                message: 'Labela uspešno dodana na datoteko!',
                url:urlVira
            });
        }
        throw new Error('Dodajanje labele na datoteko ni bilo uspešno.');
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Ta labela je že povezana z datoteko.' });
        } else {
            next(err);
        }
    }
});


// brisanje labele :lab_id z datoteke :dat_id --------> datoteke/:id/labele/:labela_id
router.delete('/:datoteka_id/labele/:labela_id', async (req, res, next) => {
    const {datoteka_id, labela_id} = req.params;

    if (!/^\d+$/.test(datoteka_id) || !/^\d+$/.test(labela_id)) {
        return res.status(400).json({ message: 'ID mora biti številka.' });
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
            res.status(204).send();
        }
        throw new Error('Brisanje labele iz datoteke ni bilo uspešno.');
    } catch (err) {
        next(err);
    }
});

module.exports = router;
