const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();

const app = express();
app.use(cors());
app.use(express.json());

// Base de données
const db = new sqlite3.Database('livoo.db');

// Créer la table users si elle n'existe pas
db.run(`CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nom TEXT,
  telephone TEXT UNIQUE,
  password TEXT,
  role TEXT
)`);

// Route de test
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Serveur Livoo simple fonctionne !' });
});

// Route pour lister les utilisateurs
app.get('/api/users', (req, res) => {
  db.all('SELECT id, nom, telephone, role FROM users', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log('✅ Serveur démarré sur http://localhost:' + PORT);
  console.log('📝 Test: http://localhost:' + PORT + '/api/health');
  console.log('👥 Utilisateurs: http://localhost:' + PORT + '/api/users');
});