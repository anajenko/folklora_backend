const express = require('express');
const router = express.Router();
const pool = require('../utils/db.js'); // uvozimo Connection Pool
const utils = require('../utils/utils.js'); // uvozimo pomožne funckije
const multer = require('multer'); // za nalaganje datotek
const upload = multer({storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 }}); // za nalaganje datotek v pomnilnik max 10MB

/* Pridobivanje vseh datotek */
router.get('/', async (req, res, next) => { // '/' pomeni '/datoteke'
    try {
        // Uporabimo pool.execute() za varno izvedbo poizvedbe
        const [rows, fields] = await pool.execute('SELECT id, ime, tip, vsebina FROM datoteka');
        res.status(200).json(rows);		// Pošljemo podatke uporabniku kot JSON
        //res.render('datoteke', { datoteke: rows });
    } catch (err) {
        next(err);
	}
});

/* Pridobivanje datoteke s posredovanim ID-jem */
router.get('/:id', async (req, res, next) => {
    try {
		const id = req.params.id;
        const [rows] = await pool.execute('SELECT ime, tip, vsebina FROM datoteka WHERE id=?', [id]);
        
		if (rows.length === 0) {
            // Če je dolžina niza 0, datoteka ne obstaja
            return res.status(404).json({
                message: `Datoteka z ID-jem '${id}' ne obstaja.`
            });
        }
        
        const file = rows[0];

        // Set proper MIME type based on 'tip'
        let contentType = 'application/octet-stream';
        switch (file.tip) {
            case 'slika':
                contentType = 'image/jpeg'; // adjust if PNG
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

// pridobivanje vseh datotek z labelo :id
router.get('/labele/:labela_id', async (req, res, next) => {
    try {
		const id = req.params.labela_id;
        // preverimo, če id obstaja --> TODO
        // preverimo, če labela obstaja
                
        const [labele] = await pool.execute('SELECT id, naziv, tip FROM labela WHERE id = ?', [id]);
        if (labele.length === 0) {
            return res.status(404).json({ message: 'Labela ne obstaja!' });
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

// Dodajanje nove datoteke
router.post('/', upload.single('slika'), async (req, res, next) => {
    //preverim, če sem dobil vse potrebne podatke
    const {ime, tip} = req.body;

    if(!ime || !tip || !req.file){
        return res.status(400).json({message: 'Manjkajo podatki za dodajanje nove datoteke!'})
        //ce posljes kodo namesto message, lahko jezik nastavis na klientu
    }

    const vsebina = req.file.buffer; //BLOB podatki
    try {
        //preverim, ce datoteka ze obstaja
        if (await utils.datotekaObstaja(ime)) {
            return res.status(409).json({message: 'Datoteka z istim imenom ze obstaja!'})
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
        } else {
            res.status(500).json({message: 'Dodajanje datoteke NI bilo uspešno!'})
        }

    } catch (err) {
        next(err);
    }
}); 

//  brisanje datoteke
router.delete('/:id', async (req, res, next) => {
    //preverim, če sem dobil vse potrebne podatke
    const id = req.params.id;

    try {
        const [existingData] = await pool.execute('SELECT id FROM datoteka WHERE id = ?', [id]);
        
        if (existingData.length === 0) {
            return res.status(404).json({ message: 'Datoteka ni najdena.' });
        }
        const [result] = await pool.execute('DELETE FROM datoteka WHERE id = ?', [id]);
        
        if (result.affectedRows === 1) {
            res.status(204).send();
        } else {
            res.status(500).json({ message: 'Napaka pri brisanju datoteke.' });
        }
            } catch (err) {
        next(err);
    }
});

router.put('/:id', async (req, res, next) => {
    const id = req.params.id; //pride iz linka
    const {ime} = req.body; //samo 'ime' se lahko posodobi
    
    try{
        if (!(await utils.datotekaObstaja(id))) {
            res.status(404).json({message: 'Datoteka ne obstaja!'});
        }

        if(!ime){
            return res.status(400).json({message: 'Manjkajo podatki za posodabljanje datoteke ali pa niso pravilno vneseni?'});
        //ce posljes kodo namesto message, lahko jezik nastavis na klientu
        }

        const sql = 'UPDATE datoteka SET ime=? WHERE id=?';
        const [result] = await pool.execute(sql, [ime, id]);
        
        if (result.affectedRows === 1) {
            res.status(204).send(); //204 je No Content - tut če pripnemo message, se ne prikaže
        } else {
            res.status(500).json({message: 'Posodabljanje datoteke NI bilo uspešno!'})
        }

    } catch (err) {
        next(err);
    }
});

// dodajanje labele :lab_id na datoteko :dat_id
///datoteke/:id/labele/:labela_id
router.post('/:datoteka_id/labele/:labela_id', async (req, res, next) => {
    const {datoteka_id, labela_id} = req.params;

    if (!datoteka_id || !labela_id) {
        return res.status(400).json({ message: 'Manjkajo podatki: datoteka_id ali labela_id.' });
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
        } else {
            return res.status(500).json({ message: 'Dodajanje labele na datoteko ni bilo uspešno.' });
        }
    } catch (err) {
        // V primeru napake baze podatkov
        //res.status(500).json({ message: 'Napaka strežnika pri dodajanju labele na datoteko.' });
        if (err.code === 'ER_DUP_ENTRY') {
            res.status(409).json({ message: 'Ta labela je že povezana z datoteko.' });
        } else {
            next(err);
        }
    }
});


// brisanje labele :lab_id z datoteke :dat_id
///datoteke/:id/labele/:labela_id

router.delete('/:datoteka_id/labele/:labela_id', async (req, res, next) => {
    const {datoteka_id, labela_id} = req.params;

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
        } else {
            return res.status(500).json({ message: 'Brisanje labele z datoteke ni bilo uspešno.' });
        }
    } catch (err) {
        next(err);
    }
});

module.exports = router;
