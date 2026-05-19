const express = require('express');
const router = express.Router();

// Inscription livreur
router.post('/inscription', async (req, res) => {
  try {
    const { nom, telephone, zone, latitude, longitude } = req.body;
    res.json({
      message: 'Livreur inscrit avec succès ✅',
      livreur: { nom, telephone, zone, latitude, longitude }
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Livreur met à jour sa position GPS
router.put('/position/:id', async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    res.json({
      message: 'Position mise à jour ✅',
      id: req.params.id,
      latitude,
      longitude
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Livreur accepte une commande
router.post('/accepter/:commandeId', async (req, res) => {
  try {
    res.json({
      message: 'Commande acceptée ✅',
      commandeId: req.params.commandeId,
      statut: 'Livreur en route vers le vendeur'
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Livreur marque commande comme livrée
router.post('/livree/:commandeId', async (req, res) => {
  try {
    res.json({
      message: 'Commande livrée avec succès ✅',
      commandeId: req.params.commandeId,
      statut: 'Livraison terminée'
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;