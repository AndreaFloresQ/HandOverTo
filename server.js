require('dotenv').config();
const app = require('./src/app');
const { conectarDB, sequelize } = require('./src/config/db');
require('./src/models');

const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'test') {
  conectarDB()
    .then(() => sequelize.sync())
    .then(() => {
      app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));
    });
}

module.exports = app;