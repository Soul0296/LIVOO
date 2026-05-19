const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

// Route de test
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Serveur Livoo fonctionne avec SQLite !' });
});

// Route d'accueil
app.get('/', (req, res) => {
  res.json({ message: 'Bienvenue sur l\'API Livoo' });
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Serveur Livoo démarré sur le port ${PORT}`);
});