require("dotenv").config();
const express = require("express");
const cors = require("cors");
require("./db");

const authRoutes = require("./routes/auth");
const disaRoutes = require("./routes/disaSetting");
const productRoutes = require("./routes/productRoutes");
const disaChecklistRoutes = require('./routes/disaChecklistRoutes');
const fourMChangeRoutes = require("./routes/fourMChangeRoutes");
const errorProofRoutes = require("./routes/errorProofRoutes");
const mouldRoutes = require('./routes/mouldRoutes');
const dmmRoutes = require('./routes/dmmRoutes');
const bottomLevelRoutes = require('./routes/bottomLevelRoutes');
const errorProofRoutes2 = require('./routes/errorProofRoutes2');
const userRoutes = require("./routes/userRoutes");
const dailyPerformanceRoutes = require("./routes/dailyPerformanceRoutes");
const configRoutes = require("./routes/configRoutes");
const mouldQualityRoutes = require('./routes/mouldQualityRoutes');
const verifyToken = require('./middleware/authMiddleware');
const qfRoutes = require("./routes/QFRoutes");
const componentRoutes = require("./routes/componentRoutes");
const delayRoutes = require("./routes/delayRoutes");

const app = express();

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);

// Protect all other routes starting with /api
app.use("/api", verifyToken);

app.use("/api/disa", disaRoutes);

// CHANGE HERE: Mapped to "/api" instead of "/api/product" 
// so that /api/forms works as expected by the frontend
app.use("/api", productRoutes);
app.use('/api/disa-checklist', disaChecklistRoutes);

app.use("/api/4m-change", fourMChangeRoutes);
app.use("/api/error-proof", errorProofRoutes);
app.use('/api/unpoured-moulds', mouldRoutes);
app.use('/api/dmm-settings', dmmRoutes);
app.use('/api/bottom-level-audit', bottomLevelRoutes);
app.use('/api/error-proof2', errorProofRoutes2);
app.use("/api/users", userRoutes);
app.use("/api/components", componentRoutes);
app.use("/api", dailyPerformanceRoutes);
app.use("/api/config", configRoutes);
app.use('/api/mould-quality', mouldQualityRoutes);
app.use('/api/settings', qfRoutes);
app.use('/api/delays', delayRoutes);


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});