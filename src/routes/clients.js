const express = require('express');
const router = express.Router();

// Valider une commande (client clique sur le lien)
router.get('/commande/:lien', async (req, res) => {
  try {
    const { lien } = req.params;
    res.json({
      message: 'Commande trouvée ✅',
      lien,
      statut: 'En attente de validation'
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Client confirme sa livraison
router.post('/confirmer/:lien', async (req, res) => {
  try {
    const { adresse, quartier, telephone } = req.body;
    res.json({
      message: 'Livraison confirmée ✅',
      adresse,
      quartier,
      telephone,
      statut: 'Recherche livreur en cours...'
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Client confirme réception
router.post('/reception/:lien', async (req, res) => {
  try {
    res.json({
      message: 'Réception confirmée ✅ Merci d\'avoir utilisé Livoo !',
      statut: 'Livraison terminée'
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;
