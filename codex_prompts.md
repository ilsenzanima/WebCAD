# 🤖 Prompt per Codex: Integrazione UI con lo Store Offline

Puoi copiare ed incollare i seguenti prompt in **Codex** per lavorare in parallelo sull'integrazione delle schermate con il nuovo Store Offline. Antigravity si occuperà poi di verificare la correttezza del codice ed eseguire i test.

---

## 📋 Prompt 1: Adattamento di `ProjectDetailClient.tsx` per Supporto Offline

Incolla questo prompt in Codex per aggiornare la dashboard di dettaglio del cantiere in modo da precaricare la cache locale e operare offline:

```markdown
Modifica il file `app/ui/projects/ProjectDetailClient.tsx` per integrarlo con lo store Zustand offline definito in `lib/stores/offline-store.ts`.

Segui queste istruzioni passo dopo passo:
1. Importa lo store offline:
   `import { useOfflineStore, generateTempId } from "@/lib/stores/offline-store";`
2. All'avvio del componente (in un `useEffect`), carica i dati passati come props nella cache locale dello store per assicurarne la disponibilità offline:
   - `setProjectsCache([project])`
   - `setLevelsCache(project.id, drawings)`
   - `setFieldNotesCache(notesList)`
3. Sostituisci la visualizzazione dei livelli leggendoli in modo dinamico dallo store offline tramite `useOfflineStore(state => state.levels[project.id] ?? drawings)` per mostrare i livelli ottimistici creati offline.
4. Nello handler di creazione dei livelli (`handleCreateLevelSubmit`):
   - Se `isOnline` dello store è false, genera un `tempId` usando `generateTempId()` e invoca l'azione ottimistica:
     `addLevelOptimistic(tempId, project.id, name, elevationZ, drawingType, piano)`
     In questo modo il nuovo livello apparirà all'istante anche offline.
   - Se `isOnline` è true, procedi con l'azione server standard `addLevel` come fa già ora il codice.
5. Fai lo same per `handleToggleCompleted` usando `toggleLevelCompletedOptimistic` se offline.
6. Assicurati che l'input di ricerca e l'ordinamento funzionino in modo identico usando lo stato letto dallo store.
```

---

## 📋 Prompt 2: Adattamento di `NewNoteForm.tsx` per Supporto Offline ed Inserimento Misure

Incolla questo prompt in Codex per aggiornare il form di compilazione degli appunti di cantiere:

```markdown
Modifica il file `app/ui/projects/NewNoteForm.tsx` per integrarlo con lo store offline `lib/stores/offline-store.ts`.

Segui queste istruzioni passo dopo passo:
1. Importa lo store offline:
   `import { useOfflineStore } from "@/lib/stores/offline-store";`
2. All'avvio, carica i materiali e i tipi di note passati come props nella cache dello store offline usando:
   - `setCatalogMaterialsCache(catalogMaterials)`
   - `setNoteTypesCache(noteTypes)`
3. Nello handler di salvataggio delle misure (`handleSubmit` o analogo handler di salvataggio del form):
   - Se `isOnline` dello store è false:
     - Aggiorna optimisticamente la nota locale salvando le voci/misure tramite:
       `saveFieldNoteItemsOptimistic(noteId, projectId, levelId, items)`
     - Mostra una notifica o indicatore all'utente: *"Misura salvata in locale (Offline)"*.
   - Se `isOnline` è true, procedi con il salvataggio server standard tramite `updateFieldNote`.
4. Nel caricamento iniziale delle note, se offline, usa la cache dello store `fieldNotes[noteId]` come fonte dati prioritaria rispetto alle API.
```
