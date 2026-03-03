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

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
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
app.use("/api", dailyPerformanceRoutes);
app.use("/api/config", configRoutes);
app.use('/api/mould-quality', mouldQualityRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});