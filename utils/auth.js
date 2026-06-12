const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
    const authHeader = req.headers['authorization'];

    if (!authHeader) return res.sendStatus(401);

    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);

        req.user = user;
        next();
    });
}

function requireGarderober(req, res, next) {
    if (req.user?.tip_uporabnika !== 'garderober/-ka') {
        return res.status(403).json({
            message: 'Akcija je omogočena samo uporabnikom tipa: garderober/-ka.'
        });
    }
    next();
}

module.exports = { authMiddleware, requireGarderober };