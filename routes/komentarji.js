const express = require('express');
const router = express.Router();
const pool = require('../utils/db.js'); // uvozimo Connection Pool
const utils = require('../utils/utils.js'); // uvozimo pomožne funckije

/* Pridobivanje vseh komentarjev datoteke s posredovanim datoteka_id */
router.get('/datoteka/:datoteka_id', async (req, res, next) => {
    try {
		const datoteka_id = req.params.datoteka_id;
        // preverimo, če id obstaja --> TODO
        // preverimo, če datoteka obstaja
        if (!(await utils.datotekaObstaja(datoteka_id))) {
            res.status(404).json({message: 'Datoteka ne obstaja!'});
        }
                
        const sql = 'SELECT id, datoteka_id, besedilo, poskodovano FROM komentar WHERE datoteka_id = ?';
        const [result] = await pool.execute(sql, [datoteka_id]);

        res.status(200).json(result);

    } catch (err) {
        next(err);
    }
});

/* Pridobivanje komentarja s posredovanim id */
router.get('/:id', async (req, res, next) => {
    try {
		const id = req.params.id;
        // preverimo, če id obstaja --> TODO
        // preverimo, če datoteka obstaja
        if (!(await utils.komentarObstaja(id))) {
            res.status(404).json({message: 'Komentar ne obstaja!'});
        }
                
        const sql = 'SELECT id, datoteka_id, besedilo, poskodovano FROM komentar WHERE id = ?';
        const [result] = await pool.execute(sql, [id]);

        res.status(200).json(result);

    } catch (err) {
        next(err);
    }
});

/* Dodajanje komentarja */
router.post('/', async (req, res, next) => {
    const {datoteka_id, besedilo, poskodovano} = req.body;

    if (!datoteka_id || (!besedilo && poskodovano == 0)) {
        return res.status(400).json({ message: 'Manjkajo podatki: datoteka_id, besedilo ali poskodovano.' });
    }

    try {
        if (!(await utils.datotekaObstaja(datoteka_id))) {
            return res.status(409).json({ message: 'Datoteka ne obstaja!' });
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
        } else {
            return res.status(500).json({ message: 'Dodajanje komentarja ni bilo uspešno.' });
        }
    } catch (err) {
        // V primeru napake baze podatkov
        res.status(500).json({ message: 'Napaka strežnika pri dodajanju komentarja.' });
    }
});

//  brisanje komentarja
router.delete('/:id', async (req, res, next) => {
    //preverim, če sem dobil vse potrebne podatke
    const id = req.params.id;

    try {
        const [existingData] = await pool.execute('SELECT id FROM komentar WHERE id = ?', [id]);
        
        if (existingData.length === 0) {
            return res.status(404).json({ message: 'Komentar ni najden.' });
        }
        const [result] = await pool.execute('DELETE FROM komentar WHERE id = ?', [id]);
        
        if (result.affectedRows === 1) {
            res.status(204).send();
        } else {
            res.status(500).json({ message: 'Napaka pri brisanju komentarja.' });
        }
            } catch (err) {
        next(err);
    }
});

router.put('/:id', async (req, res, next) => {
    const id = req.params.id; //pride iz linka
    const {datoteka_id, besedilo, poskodovano} = req.body; //samo 'besedilo' ali 'poskodovano' se lahko posodobi

    try{
        if (!(await utils.datotekaObstaja(datoteka_id))) {
            res.status(404).json({message: 'Datoteka ne obstaja!'});
        }

        if(!besedilo || !poskodovano){
            return res.status(400).json({message: 'Manjkajo podatki za posodabljanje komentarja'});
        //ce posljes kodo namesto message, lahko jezik nastavis na klientu
        }

        const sql = 'UPDATE komentar SET besedilo=?, poskodovano=? WHERE id=?';
        const [result] = await pool.execute(sql, [besedilo, poskodovano, id]);
        
        if (result.affectedRows === 1) {
            res.status(204).send(); //204 je No Content - tut če pripnemo message, se ne prikaže
        } else {
            res.status(500).json({message: 'Posodabljanje komentarja NI bilo uspešno!'})
        }

    } catch (err) {
        next(err);
    }
});

module.exports = router;
