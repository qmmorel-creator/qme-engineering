# Tâche planifiée « TikTok · diaporamas J+14 »

À créer par Quentin depuis l'interface des routines de claude.ai (une tâche créée depuis une session Claude Code
n'emporte ni le dépôt ni les connecteurs). Réglages : dépôt `qmmorel-creator/qme-engineering` ; connecteurs
Google Drive et Google Sheets ; chaque jour à 10:23 (Europe/Paris) ; nouvelle session à chaque exécution ;
notification push.

## Prompt

Tâche planifiée « TikTok · diaporamas J+14 » (QME). Lis d'abord CLAUDE.md et docs/templates/communication/tiktok/README.md.

Contexte : depuis le 18/11/2026 (décision de Quentin), chaque carrousel Instagram est republié sur TikTok par Instinct sous forme de diaporama vidéo, car l'import photo de TikTok Studio crée des doublons. Instinct cherche dans le dossier Drive « QME – Publications Instagram / Images » (ID 1ALPahoZEKdYjG5iUnPfa5aYubsOPWN3m) un fichier nommé comme le premier fichier de la colonne I, avec « -1.png » remplacé par « -tiktok.mp4 » (ex. IG-05-cout-revient-1.png → IG-05-cout-revient-tiktok.mp4). Ta mission : que ce fichier existe toujours pour les 14 prochains jours.

1. Lis l'onglet Planning du Sheet « Planning publications Instagram » (ID 1R9l_AHY5fQwGvuZE-ge6F3ghvzx8OvQarkzxBf1mhf8), colonnes A, B, D, I, N. Retiens les lignes au statut « Programmé » ou « Prêt », Format (N) = « Carrousel », date (B) entre aujourd'hui et aujourd'hui + 14 jours (heure de Paris).
2. Pour chacune, cherche dans le dossier Images (parentId = le dossier, title = nom attendu, trashed = false) si la vidéo -tiktok.mp4 existe. Si oui, passe.
3. Sinon, rends-la avec le moteur vidéo unique : `node docs/videos/diaporama.mjs <PNG de la colonne I, dans l'ordre, pris dans docs/templates/communication/instagram/png/> --sortie docs/videos/sortie/<nom attendu>`. N'utilise que les fichiers listés en colonne I (pas les « -story »). Vérifie avec ffprobe : 1080 × 1920, piste audio AAC sur toute la durée, taille < 2,9 Mo. Contrôle une planche (`ffmpeg -vf "fps=1/4.2,scale=108:192,tile=6x1"`) : toutes les diapositives présentes, dans l'ordre.
4. Dépose-la dans Drive : parentId = 1ALPahoZEKdYjG5iUnPfa5aYubsOPWN3m, titre = nom attendu exact, video/mp4, sans conversion, contenu = `sha256:<empreinte>:<chemin absolu>`. Vérifie que la taille correspond au fichier local.
5. Si les PNG d'une ligne ne sont pas dans le dépôt : ne télécharge pas les images par le connecteur Drive (trop lourd). Liste la ligne dans ton résumé comme « à traiter par Quentin », avec sa date.
6. N'écris rien dans le planning Instagram, ne publie rien, ne modifie pas le dépôt.
7. Résumé final, court, en français : vidéos créées (ID IG, date, ID Drive), vidéos déjà présentes, lignes bloquées et pourquoi.
