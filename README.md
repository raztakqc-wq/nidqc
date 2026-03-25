# NidQC Local

Application Next.js locale avec :
- carte fonctionnelle OpenStreetMap + Leaflet
- sauvegarde réelle dans `data/reports.json`
- backend local avec API Next.js

## Lancer le projet

```bash
npm install
npm run dev
```

Ensuite ouvre `http://localhost:3000`

## API
- GET `/api/reports`
- POST `/api/reports`
- PATCH `/api/reports`
- DELETE `/api/reports`

## Tests manuels
1. Ajouter un signalement
2. Utiliser le GPS
3. Confirmer / Transmis ville / Marquer réparé
4. Redémarrer le serveur et vérifier que `data/reports.json` garde les données
