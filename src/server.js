const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const { db, dbPath } = require('./config/database');
const { calculateDeliveryPrice } = require('./services/pricing');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'livoo_dev_secret_change_me';

app.use(cors());
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true, limit: '12mb' }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, '../public')));

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function publicUser(user) {
  if (!user) return null;
  const { password, ...safeUser } = user;
  return safeUser;
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, telephone: user.telephone },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function getToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return null;
}

function optionalAuth(req, _res, next) {
  const token = getToken(req);
  if (!token) return next();

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.id);
    if (user) req.user = user;
  } catch (_error) {
    req.user = null;
  }

  next();
}

function requireAuth(req, res, next) {
  optionalAuth(req, res, () => {
    if (!req.user) {
      return res.status(401).json({ message: 'Connexion requise' });
    }
    next();
  });
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Acces refuse' });
    }
    next();
  };
}

function makeReference() {
  return `LV-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function makeToken() {
  return crypto.randomBytes(8).toString('hex');
}

function findOrder(code) {
  return db.prepare(`
    SELECT
      c.*,
      vendeur.nom AS vendeur_nom,
      vendeur.telephone AS vendeur_telephone,
      livreur.nom AS livreur_nom,
      livreur.telephone AS livreur_telephone,
      livreur.latitude AS livreur_latitude,
      livreur.longitude AS livreur_longitude,
      livreur.credit AS livreur_credit,
      livreur.agence_id AS livreur_agence_id
    FROM commandes c
    LEFT JOIN users vendeur ON vendeur.id = c.vendeur_id
    LEFT JOIN users livreur ON livreur.id = c.livreur_id
    WHERE c.reference = ? OR c.lien_token = ?
  `).get(code, code);
}

function finishOrderIfReady(orderId) {
  const order = db.prepare('SELECT * FROM commandes WHERE id = ?').get(orderId);
  if (!order || order.statut === 'terminee') return order;
  if (!order.client_confirmed_at || !order.livreur_confirmed_at) return order;

  const livreur = db.prepare('SELECT * FROM users WHERE id = ?').get(order.livreur_id);
  if (!livreur) return order;

  const commissionLivoo = Number(order.commission_livoo || 0);
  const commissionAgence = Number(order.commission_agence || 0);
  const totalCommission = commissionLivoo + commissionAgence;

  db.exec('BEGIN');
  try {
    db.prepare('UPDATE users SET credit = credit - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(totalCommission, livreur.id);

    db.prepare(`
      INSERT INTO transactions (user_id, montant, type, commande_id, description, status)
      VALUES (?, ?, 'commission', ?, ?, 'completed')
    `).run(livreur.id, -totalCommission, order.id, `Commission Livoo ${order.reference}`);

    if (livreur.agence_id && commissionAgence > 0) {
      db.prepare('UPDATE users SET credit = credit + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(commissionAgence, livreur.agence_id);

      db.prepare(`
        INSERT INTO transactions (user_id, montant, type, commande_id, description, status)
        VALUES (?, ?, 'commission', ?, ?, 'completed')
      `).run(livreur.agence_id, commissionAgence, order.id, `Commission agence ${order.reference}`);
    }

    db.prepare(`
      UPDATE commandes
      SET statut = 'terminee',
          livree_at = COALESCE(livree_at, CURRENT_TIMESTAMP)
      WHERE id = ?
    `).run(order.id);

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return db.prepare('SELECT * FROM commandes WHERE id = ?').get(orderId);
}

function distanceKm(lat1, lon1, lat2, lon2) {
  const aLat = Number(lat1);
  const aLon = Number(lon1);
  const bLat = Number(lat2);
  const bLon = Number(lon2);
  if (![aLat, aLon, bLat, bLon].every(Number.isFinite)) return null;

  const earthRadiusKm = 6371;
  const dLat = (bLat - aLat) * Math.PI / 180;
  const dLon = (bLon - aLon) * Math.PI / 180;
  const startLat = aLat * Math.PI / 180;
  const endLat = bLat * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(startLat) * Math.cos(endLat) * Math.sin(dLon / 2) ** 2;
  return earthRadiusKm * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

app.get('/api/health', (_req, res) => {
  const tables = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all().map((row) => row.name);

  res.json({
    status: 'OK',
    message: 'Serveur Livoo fonctionne',
    database: dbPath,
    tables,
    timestamp: new Date().toISOString()
  });
});

app.post('/api/auth/register', asyncRoute(async (req, res) => {
  const {
    nom,
    telephone,
    password,
    email,
    role,
    ville,
    zone,
    agence_id,
    agenceId,
    plateforme,
    nom_agence,
    adresse,
    responsable,
    naissance,
    telephone_secondaire,
    vehicule_type,
    immatriculation,
    operateur_momo,
    numero_momo
  } = req.body;

  const cleanRole = String(role || '').toLowerCase();
  const allowedRoles = new Set(['vendeur', 'livreur', 'agence', 'admin']);

  if (!nom || !telephone || !password || !allowedRoles.has(cleanRole)) {
    return res.status(400).json({ message: 'Nom, telephone, mot de passe et role sont obligatoires' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE telephone = ?').get(telephone);
  if (existing) {
    return res.status(409).json({ message: 'Ce numero est deja utilise' });
  }

  const hash = await bcrypt.hash(password, 10);
  const selectedAgencyId = agence_id || agenceId || null;

  db.exec('BEGIN');
  try {
    const result = db.prepare(`
      INSERT INTO users (nom, telephone, password, email, role, zone, ville, agence_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(nom, telephone, hash, email || null, cleanRole, zone || null, ville || null, selectedAgencyId);

    const userId = Number(result.lastInsertRowid);

    if (cleanRole === 'vendeur') {
      db.prepare('INSERT INTO vendeurs (user_id, plateforme) VALUES (?, ?)')
        .run(userId, plateforme || null);
    }

    if (cleanRole === 'livreur') {
      db.prepare(`
        INSERT INTO livreurs (
          user_id, naissance, telephone_secondaire, adresse, vehicule_type,
          immatriculation, operateur_momo, numero_momo
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        userId,
        naissance || null,
        telephone_secondaire || null,
        adresse || null,
        vehicule_type || null,
        immatriculation || null,
        operateur_momo || null,
        numero_momo || null
      );
    }

    if (cleanRole === 'agence') {
      db.prepare(`
        INSERT INTO agences (user_id, nom_agence, adresse, responsable, telephone, ville)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(userId, nom_agence || nom, adresse || null, responsable || nom, telephone, ville || null);
    }

    db.exec('COMMIT');

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    res.status(201).json({
      message: 'Compte cree avec succes',
      user: publicUser(user),
      token: signToken(user)
    });
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}));

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const { telephone, password, role } = req.body;
  if (!telephone || !password) {
    return res.status(400).json({ message: 'Telephone et mot de passe obligatoires' });
  }

  const user = db.prepare('SELECT * FROM users WHERE telephone = ?').get(telephone);
  if (!user) {
    return res.status(401).json({ message: 'Numero ou mot de passe incorrect' });
  }

  if (role && user.role !== role) {
    return res.status(403).json({ message: 'Ce compte ne correspond pas au role choisi' });
  }

  let isValid = false;
  if (String(user.password).startsWith('$2')) {
    isValid = await bcrypt.compare(password, user.password);
  } else {
    isValid = user.password === password;
    if (isValid) {
      const hash = await bcrypt.hash(password, 10);
      db.prepare('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(hash, user.id);
      user.password = hash;
    }
  }

  if (!isValid) {
    return res.status(401).json({ message: 'Numero ou mot de passe incorrect' });
  }

  res.json({
    message: 'Connexion reussie',
    user: publicUser(user),
    token: signToken(user)
  });
}));

app.get('/api/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

app.get('/api/agences', (req, res) => {
  const ville = req.query.ville ? String(req.query.ville).trim() : null;
  const rows = ville
    ? db.prepare(`
        SELECT u.id, u.nom, u.telephone, u.ville, u.zone, a.nom_agence, a.adresse, a.responsable
        FROM users u
        LEFT JOIN agences a ON a.user_id = u.id
        WHERE u.role = 'agence' AND u.statut = 'actif' AND LOWER(u.ville) = LOWER(?)
        ORDER BY COALESCE(a.nom_agence, u.nom)
      `).all(ville)
    : db.prepare(`
        SELECT u.id, u.nom, u.telephone, u.ville, u.zone, a.nom_agence, a.adresse, a.responsable
        FROM users u
        LEFT JOIN agences a ON a.user_id = u.id
        WHERE u.role = 'agence' AND u.statut = 'actif'
        ORDER BY COALESCE(a.nom_agence, u.nom)
      `).all();

  res.json(rows);
});

app.post('/api/pricing/calculate', (req, res) => {
  res.json(calculateDeliveryPrice(req.body));
});

app.post(['/api/commandes', '/api/commandes/creer'], optionalAuth, (req, res) => {
  const vendeurId = req.user?.role === 'vendeur'
    ? req.user.id
    : Number(req.body.vendeurId || req.body.vendeur_id);

  if (!vendeurId) {
    return res.status(400).json({ message: 'Vendeur obligatoire pour creer une commande' });
  }

  const vendeur = db.prepare("SELECT id FROM users WHERE id = ? AND role IN ('vendeur', 'admin')")
    .get(vendeurId);
  if (!vendeur) {
    return res.status(404).json({ message: 'Vendeur introuvable' });
  }

  const pricing = calculateDeliveryPrice(req.body);
  const reference = makeReference();
  const lienToken = makeToken();
  const statut = req.body.adresse_livraison || req.body.adresseLivraison
    ? 'en_recherche_livreur'
    : 'en_attente_client';

  const result = db.prepare(`
    INSERT INTO commandes (
      reference, lien_token, vendeur_id, client_nom, client_telephone,
      client_adresse, description, volume, poids, ville, distance_km,
      prix_estime, prix_final, commission_livoo, commission_agence,
      livreur_gain, statut, adresse_prise_en_charge, adresse_livraison,
      latitude, longitude
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    reference,
    lienToken,
    vendeurId,
    req.body.client_nom || req.body.clientNom || null,
    req.body.client_telephone || req.body.clientTelephone || null,
    req.body.client_adresse || req.body.clientAdresse || null,
    req.body.description || null,
    pricing.volume,
    pricing.poids,
    req.body.ville || null,
    pricing.distanceKm,
    pricing.prixFinal,
    pricing.prixFinal,
    pricing.commissionLivoo,
    pricing.commissionAgence,
    pricing.livreurGain,
    statut,
    req.body.adresse_prise_en_charge || req.body.adresseRetrait || req.body.adresse || null,
    req.body.adresse_livraison || req.body.adresseLivraison || null,
    req.body.latitude || null,
    req.body.longitude || null
  );

  const order = db.prepare('SELECT * FROM commandes WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({
    message: 'Commande creee avec succes',
    commande: order,
    pricing,
    lien: `/commande.html?code=${lienToken}`,
    lienCourt: `livoo.cm/commande/${lienToken}`
  });
});

app.get('/api/commandes/disponibles', requireAuth, requireRole('livreur'), (req, res) => {
  const livreur = req.user;
  const rows = db.prepare(`
    SELECT c.*, u.nom AS vendeur_nom, u.telephone AS vendeur_telephone
    FROM commandes c
    JOIN users u ON u.id = c.vendeur_id
    WHERE c.statut = 'en_recherche_livreur' AND c.livreur_id IS NULL
    ORDER BY c.created_at ASC
  `).all();

  const commandes = rows.map((order) => {
    const distanceToPickup = distanceKm(
      livreur.latitude,
      livreur.longitude,
      order.latitude,
      order.longitude
    );
    const requiredCredit = Number(order.commission_livoo || 0) + Number(order.commission_agence || 0);
    return {
      ...order,
      distance_livreur_km: distanceToPickup === null ? null : Number(distanceToPickup.toFixed(2)),
      credit_requis: requiredCredit,
      peut_accepter: Number(livreur.credit || 0) >= requiredCredit
    };
  });

  commandes.sort((a, b) => {
    if (a.distance_livreur_km === null) return 1;
    if (b.distance_livreur_km === null) return -1;
    return a.distance_livreur_km - b.distance_livreur_km;
  });

  res.json({ commandes });
});

app.get('/api/commandes/:code', (req, res) => {
  const order = findOrder(req.params.code);
  if (!order) return res.status(404).json({ message: 'Commande introuvable' });
  res.json(order);
});

app.get('/api/commandes/statut/:code', (req, res) => {
  const order = findOrder(req.params.code);
  if (!order) return res.status(404).json({ message: 'Commande introuvable' });
  res.json({
    reference: order.reference,
    statut: order.statut,
    livreur: order.livreur_id ? {
      id: order.livreur_id,
      nom: order.livreur_nom,
      telephone: order.livreur_telephone,
      latitude: order.livreur_latitude,
      longitude: order.livreur_longitude
    } : null
  });
});

app.get('/api/commandes/:code/tracking', (req, res) => {
  const order = findOrder(req.params.code);
  if (!order) return res.status(404).json({ message: 'Commande introuvable' });
  res.json({
    reference: order.reference,
    statut: order.statut,
    client_adresse: order.client_adresse,
    adresse_prise_en_charge: order.adresse_prise_en_charge,
    adresse_livraison: order.adresse_livraison,
    livreur: order.livreur_id ? {
      id: order.livreur_id,
      nom: order.livreur_nom,
      telephone: order.livreur_telephone,
      latitude: order.livreur_latitude,
      longitude: order.livreur_longitude
    } : null
  });
});

app.post('/api/commandes/:code/client-confirm', (req, res) => {
  const order = findOrder(req.params.code);
  if (!order) return res.status(404).json({ message: 'Commande introuvable' });

  db.prepare(`
    UPDATE commandes
    SET client_nom = COALESCE(?, client_nom),
        client_telephone = COALESCE(?, client_telephone),
        client_adresse = COALESCE(?, client_adresse),
        adresse_livraison = COALESCE(?, adresse_livraison),
        latitude = COALESCE(?, latitude),
        longitude = COALESCE(?, longitude),
        statut = 'en_recherche_livreur',
        client_validation_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    req.body.nom || req.body.client_nom || null,
    req.body.telephone || req.body.client_telephone || null,
    req.body.adresse || req.body.client_adresse || null,
    req.body.adresse || req.body.adresse_livraison || null,
    req.body.latitude || null,
    req.body.longitude || null,
    order.id
  );

  res.json({
    message: 'Adresse client confirmee. Recherche de livreur en cours.',
    commande: findOrder(req.params.code)
  });
});

app.post('/api/commandes/:code/accepter', requireAuth, requireRole('livreur'), (req, res) => {
  const order = findOrder(req.params.code);
  if (!order) return res.status(404).json({ message: 'Commande introuvable' });
  if (order.statut !== 'en_recherche_livreur' || order.livreur_id) {
    return res.status(409).json({ message: 'Cette commande a deja ete prise' });
  }

  const requiredCredit = Number(order.commission_livoo || 0) + Number(order.commission_agence || 0);
  if (Number(req.user.credit || 0) < requiredCredit) {
    return res.status(402).json({
      message: 'Credit insuffisant pour accepter cette commande',
      credit: Number(req.user.credit || 0),
      credit_requis: requiredCredit
    });
  }

  const result = db.prepare(`
    UPDATE commandes
    SET livreur_id = ?, statut = 'acceptee'
    WHERE id = ? AND livreur_id IS NULL AND statut = 'en_recherche_livreur'
  `).run(req.user.id, order.id);

  if (result.changes === 0) {
    return res.status(409).json({ message: 'Un autre livreur a accepte avant vous' });
  }

  res.json({
    message: 'Commande acceptee',
    commande: findOrder(req.params.code)
  });
});

app.put('/api/commandes/:code/statut', requireAuth, requireRole('livreur', 'admin'), (req, res) => {
  const order = findOrder(req.params.code);
  if (!order) return res.status(404).json({ message: 'Commande introuvable' });
  if (req.user.role === 'livreur' && order.livreur_id !== req.user.id) {
    return res.status(403).json({ message: 'Cette commande ne vous appartient pas' });
  }

  const nextStatus = req.body.statut;
  const allowed = new Set(['recuperee', 'en_route', 'livree_en_attente_confirmation']);
  if (!allowed.has(nextStatus)) {
    return res.status(400).json({ message: 'Statut non autorise' });
  }

  const updates = {
    prise_en_charge_at: nextStatus === 'recuperee' ? 'CURRENT_TIMESTAMP' : 'prise_en_charge_at',
    livree_at: nextStatus === 'livree_en_attente_confirmation' ? 'CURRENT_TIMESTAMP' : 'livree_at'
  };

  db.prepare(`
    UPDATE commandes
    SET statut = ?,
        photo_prise_en_charge = COALESCE(?, photo_prise_en_charge),
        photo_livraison = COALESCE(?, photo_livraison),
        prise_en_charge_at = ${updates.prise_en_charge_at},
        livree_at = ${updates.livree_at}
    WHERE id = ?
  `).run(
    nextStatus,
    req.body.photo_prise_en_charge || req.body.photoRetrait || null,
    req.body.photo_livraison || req.body.photoLivraison || null,
    order.id
  );

  res.json({
    message: 'Statut mis a jour',
    commande: findOrder(req.params.code)
  });
});

app.post('/api/commandes/:code/confirmer-livraison', optionalAuth, (req, res) => {
  const order = findOrder(req.params.code);
  if (!order) return res.status(404).json({ message: 'Commande introuvable' });

  const source = req.body.source || req.body.role || req.user?.role;
  if (!['client', 'livreur', 'admin'].includes(source)) {
    return res.status(400).json({ message: 'Precisez source: client ou livreur' });
  }

  if (source === 'livreur' && (!req.user || req.user.id !== order.livreur_id)) {
    return res.status(403).json({ message: 'Seul le livreur de la commande peut confirmer cote livreur' });
  }

  if (source === 'client') {
    db.prepare('UPDATE commandes SET client_confirmed_at = CURRENT_TIMESTAMP WHERE id = ?').run(order.id);
  } else {
    db.prepare('UPDATE commandes SET livreur_confirmed_at = CURRENT_TIMESTAMP WHERE id = ?').run(order.id);
  }

  const updated = finishOrderIfReady(order.id);
  res.json({
    message: updated.statut === 'terminee'
      ? 'Livraison terminee et commissions prelevees'
      : 'Confirmation enregistree, attente de la deuxieme confirmation',
    commande: findOrder(req.params.code)
  });
});

app.put('/api/livreurs/position', requireAuth, requireRole('livreur'), (req, res) => {
  const { latitude, longitude, disponible } = req.body;
  if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) {
    return res.status(400).json({ message: 'Latitude et longitude obligatoires' });
  }

  db.prepare(`
    UPDATE users
    SET latitude = ?, longitude = ?, disponible = COALESCE(?, disponible), updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(latitude, longitude, disponible === undefined ? null : disponible ? 1 : 0, req.user.id);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ message: 'Position mise a jour', user: publicUser(user) });
});

app.get('/api/wallet', requireAuth, (req, res) => {
  const transactions = db.prepare(`
    SELECT * FROM transactions
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 50
  `).all(req.user.id);

  res.json({
    credit: Number(req.user.credit || 0),
    transactions
  });
});

app.post('/api/wallet/recharge', requireAuth, requireRole('livreur', 'agence', 'admin'), (req, res) => {
  const montant = Number(req.body.montant);
  if (!Number.isFinite(montant) || montant <= 0) {
    return res.status(400).json({ message: 'Montant invalide' });
  }

  const provider = req.body.provider || 'momo';
  const providerReference = req.body.provider_reference || req.body.reference || `SIM-${makeToken()}`;

  db.exec('BEGIN');
  try {
    db.prepare('UPDATE users SET credit = credit + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(montant, req.user.id);

    db.prepare(`
      INSERT INTO transactions (user_id, montant, type, description, provider, provider_reference, status)
      VALUES (?, ?, 'depot', ?, ?, ?, 'completed')
    `).run(req.user.id, montant, 'Recharge de credit', provider, providerReference);

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({
    message: 'Credit recharge avec succes',
    credit: Number(user.credit || 0)
  });
});

app.get('/api/users', requireAuth, requireRole('admin'), (_req, res) => {
  const users = db.prepare(`
    SELECT id, nom, telephone, email, role, ville, zone, credit, statut, agence_id, created_at
    FROM users
    ORDER BY created_at DESC
  `).all();
  res.json(users);
});

app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ message: 'Route API introuvable' });
  }
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({
    message: 'Erreur serveur',
    details: process.env.NODE_ENV === 'production' ? undefined : error.message
  });
});

app.listen(PORT, () => {
  console.log(`Serveur Livoo demarre sur http://localhost:${PORT}`);
  console.log(`API health: http://localhost:${PORT}/api/health`);
});
