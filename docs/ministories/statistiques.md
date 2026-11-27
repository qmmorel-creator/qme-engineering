# Mini-stories : statistiques et seuil d'arrêt (décision de Quentin du 27/11/2026)

Audit `AUDIT-VIRALITE-2026-11-27.md` § 6. **Indicateurs décisifs** : durée moyenne regardée et taux de vision complète
(Instagram et TikTok), relevés 48 h après publication. Envois, enregistrements, commentaires : notés, non décisifs.

**Source** : Instinct relève les statistiques de chaque mini-story publiée (consigne `instagram/PROMPT-INSTINCT-v9.md`)
dans la colonne Remarque de sa ligne du planning Instagram, sous la forme
`Stats J+2 · IG : <vues> vues, <durée moyenne> s, <vision complète> % | TT : <vues> vues, <durée moyenne> s, <vision complète> %`.
La tâche « Mini-story QME du jour » (8:40) recopie chaque relevé ici et calcule la moyenne glissante.

**Seuil d'arrêt fixé d'avance** : si la vision complète moyenne Instagram des **10 dernières** mini-stories relevées est
**inférieure à 30 %**, l'agent master le signale à Quentin avec une proposition (transformer le format ou arrêter).
Rien n'est arrêté sans sa décision. Comparaison : la mini-story contre la publication du jour même, pas dans l'absolu.

| ID | Épisode | Publié le | IG vues | IG durée moy. (s) | IG vision complète (%) | TT vues | TT durée moy. (s) | TT vision complète (%) | Envois / enreg. / comm. |
|---|---|---|---|---|---|---|---|---|---|
