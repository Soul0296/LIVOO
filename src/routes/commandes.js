const express = require('express');
const router = express.Router();

// Vendeur crée une nouvelle commande
router.post('/creer', async (req, res) => {
  try {
    const { vendeurId, description, photo, adresseRetrait } = req.body;
    
    // Générer un lien unique pour le client
    const lienUnique = 'livoo-' + Math.random().toString(36).substring(2, 10).toUpperCase();
    
    res.json({
      message: 'Commande créée avec succès ✅',
      lien: lienUnique,
      commande: {
        vendeurId,
        description,
        adresseRetrait,
        statut: 'En attente client',
        dateCreation: new Date()
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Voir le statut d'une commande
router.get('/statut/:lien', async (req, res) => {
  try {
    res.json({
      message: 'Statut de la commande',
      lien: req.params.lien,
      statut: 'En attente livreur',
      livreur: null
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Algorithme de matching — trouver le livreur le plus proche
router.post('/matching/:commandeId', async (req, res) => {
  try {
    const { latitudeVendeur, longitudeVendeur } = req.body;
    
    // Calcul de distance entre deux points GPS (formule Haversine)
    const calculerDistance = (lat1, lon1, lat2, lon2) => {
      const R = 6371; // Rayon de la Terre en km
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    };

    // Livreurs disponibles (exemple — sera remplacé par la base de données)
    const livreursDisponibles = [
      { id: '1', nom: 'Jean', latitude: 4.0511, longitude: 9.7679, disponible: true },
      { id: '2', nom: 'Paul', latitude: 4.0612, longitude: 9.7750, disponible: true },
      { id: '3', nom: 'Marie', latitude: 4.0420, longitude: 9.7600, disponible: false },
    ];

    // Rayon de recherche initial : 2 km
    let rayon = 2;
    let livreurTrouve = null;

    while (rayon <= 10 && !livreurTrouve) {
      const livreursProches = livreursDisponibles.filter(livreur => {
        if (!livreur.disponible) return false;
        const distance = calculerDistance(
          latitudeVendeur, longitudeVendeur,
          livreur.latitude, livreur.longitude
        );
        return distance <= rayon;
      });

      if (livreursProches.length > 0) {
        // Prendre le plus proche
        livreurTrouve = livreursProches.sort((a, b) => {
          const distA = calculerDistance(latitudeVendeur, longitudeVendeur, a.latitude, a.longitude);
          const distB = calculerDistance(latitudeVendeur, longitudeVendeur, b.latitude, b.longitude);
          return distA - distB;
        })[0];
      } else {
        // Élargir le rayon
        rayon += 2;
      }
    }

    if (livreurTrouve) {
      res.json({
        message: 'Livreur trouvé ✅',
        livreur: livreurTrouve,
        rayonUtilise: rayon + ' km'
      });
    } else {
      res.json({
        message: 'Aucun livreur disponible pour le moment ❌',
        suggestion: 'Réessayez dans quelques minutes'
      });
    }

  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

module.exports = router;