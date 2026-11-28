# Création des brouillons Gmail · vague 3 d'affiliation QME (validée par Quentin le 27/11/2026)

Dossier : /tmp/claude-0/-home-user-qme-engineering/398edc15-27ed-5f53-ab37-06c82a4aa80b/scratchpad/vague3/file
Gmail uniquement : n'envoie RIEN, n'écris rien dans Nexora, ne supprime aucun brouillon.

1. ToolSearch "select:mcp__Gmail__create_draft".
2. Pour chaque id de ton lot (fichier lotN.txt, un id par ligne), lis out/<id>.json (to, subject, htmlBody, body,
   attachments) et appelle `mcp__Gmail__create_draft` avec EXACTEMENT ces valeurs : to, subject, htmlBody, body,
   attachments. Les attachments sont recopiés tels quels (références « sha256:…:/chemin », filename, mimeType,
   inline true) : pas de base64, pas de cc ni bcc, pas de signature Gmail (includeSignature absent). htmlBody et body
   caractère pour caractère, sans reformater, sans tronquer.
   Lis les fichiers un par un (Read ou cat) juste avant chaque appel, pour ne rien mélanger entre créateurs.
3. Après chaque création, ajoute une ligne JSON au fichier resN.jsonl : {"id":"a-…","to":"…","draftId":"r…","threadId":"…"}
   (avec Bash : echo '<json>' >> resN.jsonl). Si un appel échoue, réessaie une fois ; sinon ligne {"id","to","erreur"}.
   Si resN.jsonl existe déjà (reprise), ne recrée pas les ids qui y ont un draftId.
4. Contrôle final : nombre de lignes avec draftId = nombre d'ids du lot ; aucun id en double.
Rapport final : nombre créé, erreurs éventuelles (id + motif). Pas de recopie du contenu des mails.
