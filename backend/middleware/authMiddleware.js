const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "super_secret_key_2026";

const verifyToken = (req, res, next) => {
    const token = req.headers["authorization"];

    if (!token) {
        return res.status(403).json({ message: "A token is required for authentication" });
    }

    try {
        // The token typically comes in as "Bearer <token>"
        const tokenPart = token.split(" ")[1];
        const decoded = jwt.verify(tokenPart, JWT_SECRET);
        req.user = decoded; // Store the decoded user payload in req.user
    } catch (err) {
        return res.status(401).json({ message: "Invalid Token" });
    }
    return next();
};

module.exports = verifyToken;
