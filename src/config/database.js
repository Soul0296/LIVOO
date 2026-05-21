const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../livoo.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON');

function isSafeIdentifier(value) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);
}

function tableColumns(table) {
  if (!isSafeIdentifier(table)) {
    throw new Error(`Invalid table name: ${table}`);
  }
  return db.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name);
}

function ensureColumns(table, columns) {
  const existing = new Set(tableColumns(table));
  for (const [name, definition] of Object.entries(columns)) {
    if (!existing.has(name)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
    }
  }
}

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      telephone TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      email TEXT,
      role TEXT CHECK(role IN ('vendeur', 'livreur', 'agence', 'admin')) NOT NULL,
      zone TEXT,
      ville TEXT,
      disponible INTEGER DEFAULT 1,
      latitude REAL,
      longitude REAL,
      credit REAL DEFAULT 0,
      statut TEXT DEFAULT 'actif',
      agence_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS livreurs (
      user_id INTEGER PRIMARY KEY,
      naissance DATE,
      telephone_secondaire TEXT,
      adresse TEXT,
      vehicule_type TEXT,
      immatriculation TEXT,
      operateur_momo TEXT,
      numero_momo TEXT,
      note_moyenne REAL DEFAULT 0,
      nb_evaluations INTEGER DEFAULT 0,
      total_commandes INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS vendeurs (
      user_id INTEGER PRIMARY KEY,
      plateforme TEXT,
      total_commandes INTEGER DEFAULT 0,
      note_moyenne REAL DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS agences (
      user_id INTEGER PRIMARY KEY,
      nom_agence TEXT,
      adresse TEXT,
      responsable TEXT,
      telephone TEXT,
      ville TEXT,
      commission_rate REAL DEFAULT 0.05,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS commandes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference TEXT UNIQUE NOT NULL,
      lien_token TEXT UNIQUE,
      vendeur_id INTEGER NOT NULL,
      livreur_id INTEGER,
      client_nom TEXT,
      client_telephone TEXT,
      client_adresse TEXT,
      description TEXT,
      volume TEXT,
      poids TEXT,
      ville TEXT,
      distance_km REAL,
      prix_estime REAL,
      prix_final REAL,
      commission_livoo REAL DEFAULT 0,
      commission_agence REAL DEFAULT 0,
      livreur_gain REAL DEFAULT 0,
      statut TEXT DEFAULT 'en_attente_client',
      adresse_prise_en_charge TEXT,
      adresse_livraison TEXT,
      photo_prise_en_charge TEXT,
      photo_livraison TEXT,
      latitude REAL,
      longitude REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      client_validation_at DATETIME,
      prise_en_charge_at DATETIME,
      livree_at DATETIME,
      client_confirmed_at DATETIME,
      livreur_confirmed_at DATETIME,
      FOREIGN KEY (vendeur_id) REFERENCES users(id),
      FOREIGN KEY (livreur_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      montant REAL NOT NULL,
      type TEXT CHECK(type IN ('depot', 'retrait', 'commission', 'paiement')) NOT NULL,
      commande_id INTEGER,
      description TEXT,
      provider TEXT,
      provider_reference TEXT,
      status TEXT DEFAULT 'completed',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (commande_id) REFERENCES commandes(id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      commande_id INTEGER NOT NULL,
      expediteur_id INTEGER NOT NULL,
      destinataire_id INTEGER NOT NULL,
      contenu TEXT NOT NULL,
      lu INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (commande_id) REFERENCES commandes(id),
      FOREIGN KEY (expediteur_id) REFERENCES users(id),
      FOREIGN KEY (destinataire_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS litiges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      commande_id INTEGER NOT NULL,
      utilisateur_id INTEGER NOT NULL,
      type TEXT CHECK(type IN ('non_recu', 'endommage', 'mauvaise_adresse')) NOT NULL,
      description TEXT,
      preuves TEXT,
      status TEXT DEFAULT 'en_cours',
      resolution TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME,
      FOREIGN KEY (commande_id) REFERENCES commandes(id),
      FOREIGN KEY (utilisateur_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      titre TEXT NOT NULL,
      message TEXT NOT NULL,
      lu INTEGER DEFAULT 0,
      commande_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (commande_id) REFERENCES commandes(id)
    );
  `);

  ensureColumns('users', {
    credit: 'REAL DEFAULT 0',
    statut: "TEXT DEFAULT 'actif'",
    agence_id: 'INTEGER',
    updated_at: 'DATETIME'
  });

  ensureColumns('agences', {
    ville: 'TEXT',
    commission_rate: 'REAL DEFAULT 0.05'
  });

  ensureColumns('commandes', {
    lien_token: 'TEXT',
    ville: 'TEXT',
    distance_km: 'REAL',
    commission_livoo: 'REAL DEFAULT 0',
    commission_agence: 'REAL DEFAULT 0',
    livreur_gain: 'REAL DEFAULT 0',
    client_validation_at: 'DATETIME',
    client_confirmed_at: 'DATETIME',
    livreur_confirmed_at: 'DATETIME'
  });

  ensureColumns('transactions', {
    provider: 'TEXT',
    provider_reference: 'TEXT'
  });
}

initDatabase();

module.exports = {
  db,
  dbPath,
  initDatabase
};
