# Routines des réseaux sociaux (état au 24/11/2026)

Demande de Quentin du 24/11/2026 : une seule programmation par jour et par plateforme, et des routines qui tournent en
arrière-plan pour garder **au moins 7 jours d'avance chaque jour** sur chaque réseau. Instinct ne fait que publier les
lignes « Programmé » : il ne corrige jamais les plannings.

| Réseau | Planning (Sheet) | Qui produit (tâches planifiées quotidiennes) | Qui garantit une par jour et 7 jours d'avance |
|---|---|---|---|
| Instagram | `1R9l_AHY5fQwGvuZE-ge6F3ghvzx8OvQarkzxBf1mhf8` | Publications du jour (10:41), Vidéo démo du jour (11:44), Reel du soir (lun., mer., ven. 14:23) | Contrôle quotidien 15:07 |
| TikTok | suit Instagram (Instinct reprend chaque publication) | TikTok et YouTube · diaporamas J+14 (10:23) : vidéo des carrousels | Contrôle quotidien 15:07 (via Instagram) |
| YouTube | `1LYdQZabr6B4Z_Ctu0ayYF1tOOtMIPMiqeXa9LTfNTtE` | diaporamas J+14 (10:23), Vidéo démo du jour, Reel du soir | Contrôle quotidien 15:07 (comble les jours vides : Reel du jour, diaporama, ou Reel jamais passé sur YouTube) |
| LinkedIn | `1EejYs9y4AsdoAtQgHc2HzXK6LgWQHwNnZmqbesSxpWU` | Publications du jour (10:41), Vidéo démo du jour (11:44) | Contrôle quotidien 15:07 |
| X | `1lri4kqQO61Ei4s6w9za2UdudsPhdpas_zKuAIG5N8hM` | Campagne X · contenu J+7 (12:37) | Contrôle quotidien 15:07 |

**Contrôle quotidien 15:07** (« Réseaux sociaux · une par jour et 7 jours d'avance (contrôle) ») : il relit les quatre
plannings, déplace tout doublon de demain à J+60 vers le premier jour libre, comble tout jour vide de demain à J+7
(skills `publication-classique` et `campagne-x`, ou Short YouTube à partir d'une vidéo existante), et ne notifie Quentin
que s'il reste un problème. Il tourne après toutes les tâches de production.

Toutes ces tâches portent en tête la règle « une seule publication par plateforme et par jour » (`REGLES-CONTENU.md` § 1).
La tâche « TikTok et YouTube · diaporamas J+14 » appartient à une autre session : sa consigne n'a pas pu être modifiée
d'ici, mais elle n'ajoute un Short que sur un jour qui n'en a aucun (procédure `tiktok/ROUTINE-DIAPORAMAS.md` § 6).

Réserves au 24/11/2026 au soir : Instagram jusqu'au 21/04/2027, LinkedIn jusqu'au 02/04/2027, YouTube couvert chaque jour
jusqu'au 10/12 (jours suivants comblés au fil de l'eau par les tâches), X jusqu'au 02/12 (prolongé chaque jour).
