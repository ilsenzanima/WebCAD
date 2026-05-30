# 🎯 Direttive di Sviluppo: "Abaco di Cantiere Smart" (WebCAD Pivot)

> **Stato del Progetto:** PIVOT - Semplificazione drastica. Il motore CAD geometrico basato su Canvas 2D/3D (react-konva) è DEPRECATO e rimosso dalle priorità.
> **Nuovo Obiettivo:** Creare un'applicazione di censimento misure, annotazioni visive e ottimizzazione materiali (nesting) altamente performante e focalizzata sull'uso offline in cantiere.

---

## 0. Regole Generali per l'Agente IA (Antigravity & Codex)
- 🇮🇹 **Lingua:** Tutta la comunicazione con l'utente e i messaggi di commit Git DEVONO essere in italiano.
- 📁 **Dati Sensibili:** Cartella `_sample_data/` ed `.env` tassativamente ignorati nel `.gitignore`.
- 🧠 **Prima di procedere:** Leggere sempre questo file per verificare l'allineamento dell'architettura.

---

## 1. Nuova Architettura di Riferimento

### 1.1. Funzionamento Mobile (Smartphone / Cantiere)
- **Tecnologia:** Next.js + Tailwind CSS, pacchettizzato in App Nativa tramite Capacitor.
- **Resilienza Offline (Priorità Assoluta):** L'applicazione deve consentire l'inserimento di progetti, livelli e misure anche in totale assenza di rete (es. interrati).
- **Stato Locale:** Sfruttare Zustand con persistenza locale (o SQLite locale tramite Capacitor) per salvare i dati sul telefono. Sincronizzare con Supabase solo quando la rete è disponibile.
- **Interfaccia:** Input tabellare rapido (Abaco) e Photo-Quotatura (Scatto foto + nodi/frecce di quota posizionati sopra l'immagine).

### 1.2. Funzionamento Desktop (Ufficio / Baracca)
- **Visualizzazione:** Dashboard web per rivedere le foto scattate, modificare i dati inseriti e analizzare i report.
- **Nesting & BoM:** Computazione degli algoritmi di taglio (1D/2D) basati sul magazzino materiali inserito, con generazione di report PDF/CSV esportabili per la squadra.

---

## 2. Stato del Database (Supabase) da Preservare
Mantenere e utilizzare le migrazioni già esistenti:
- `001_materials.sql` e `FIX_materials_setup.sql` (Anagrafica materiali)
- `002_project_notes.sql` fino a `007_field_note_posizione.sql` (Note di campo, foto, dimensioni e posizioni)
- `010_field_note_materiale.sql` e `011_user_tags.sql` (Associazione materiali e tag)

---

## 3. RoadMap di Sviluppo Corrente
1. **Fase 1:** Pulizia delle vecchie schermate del Canvas/Editor3D non più necessarie.
2. **Fase 2:** Implementazione dello Store locale persistente per la gestione offline.
3. **Fase 3:** Creazione dell'interfaccia di inserimento misure rapido a tabelle ottimizzata per mobile.
4. **Fase 4:** Modulo di Photo-Quotatura sulle immagini caricate nelle note di campo.
