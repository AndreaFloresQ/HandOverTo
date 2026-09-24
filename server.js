require('dotenv').config();
const app = require('./src/app');
const { conectarDB, sequelize  } = require('./src/config/db');
require('./src/models');

const PORT = process.env.PORT || 3000;

conectarDB()
  .then(() => sequelize.sync())
  .then(() => {
    app.listen(PORT, () => console.log(`Servidor en http://localhost:${PORT}`));
  });