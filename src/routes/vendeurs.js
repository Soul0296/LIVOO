const express = require('express');
const router = express.Router();

// Inscription vendeur
router.post('/inscription', async (req, res) => {
  try {
    const { nom, telephone, zone } = req.body;
    res.json({ 
      message: 'Vendeur inscrit avec succès ✅',
      vendeur: { nom, telephone, zone }
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Connexion vendeur
router.post('/connexion', async (req, res) => {
  try {
    const { telephone } = req.body;
    res.json({ 
      message: 'Connexion réussie ✅',
      telephone
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Récupérer le profil vendeur
router.get('/:id', async (req, res) => {
  try {
    res.json({ message: 'Profil vendeur', id: req.params.id });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;