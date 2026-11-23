require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const apiRoutes = require('./src/routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend assets
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Mount API routes
app.use('/api', apiRoutes);

// Fallback to index.html for Single-Page Application routing
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

let server;
if (!process.env.VERCEL && require.main === module) {
  server = app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`  APANAH: AI Back Office for Small Shops & MSMEs     `);
    console.log(`  President's Innovation Fund - Prototype Online     `);
    console.log(`  Listening at: http://localhost:${PORT}             `);
    console.log(`====================================================`);
  });
}

module.exports = app;
module.exports.app = app;
module.exports.server = server;
