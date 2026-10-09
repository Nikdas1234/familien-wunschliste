# Familien-Wunschliste

Eine Wunschliste fürs Handy: Jedes Familienmitglied trägt seine Wünsche ein, alle sehen die
Listen der anderen. Pro Wunsch gibt es Titel, Link zum Shop, ungefähren Preis und Wichtigkeit.
Eigene Wünsche kann man bearbeiten, als erfüllt abhaken und löschen.

Technisch ist es eine **Web-App, die sich wie eine App installieren lässt** (PWA): Man öffnet
eine Adresse im Handy-Browser und legt sie auf den Startbildschirm. Das läuft auf Android und
iPhone gleich und braucht keinen App Store.

## Stand (09.10.2026)

| Teil | Stand |
|---|---|
| App-Oberfläche | fertig, im Browser in Handygröße getestet (Demo-Modus) |
| Datenbank-Skript `supabase/setup.sql` | geschrieben, **noch nicht gegen eine echte Datenbank getestet** |
| Supabase-Konto und Projekt | offen — muss Niklas selbst anlegen |
| Veröffentlichung im Internet (damit die Handys die App erreichen) | offen |

## Am Rechner ausprobieren

```powershell
node dev-server.js
```

Dann <http://localhost:5180> im Browser öffnen. Solange in `config.js` nichts eingetragen ist,
läuft der **Demo-Modus** mit Beispielfamilie; die Daten liegen dann nur in diesem Browser.

## Gemeinsame Liste einrichten (einmalig)

1. Auf <https://supabase.com> ein kostenloses Konto anlegen und ein neues Projekt erstellen
   (Region z. B. Frankfurt). Supabase ist eine fertige Online-Datenbank; der Gratis-Tarif reicht.
2. Im Projekt links **SQL Editor** öffnen, den kompletten Inhalt von `supabase/setup.sql`
   einfügen und ausführen. Das legt Tabellen und Zugriffsfunktionen an.
3. Im SQL Editor die Familie anlegen — Code und Namen vorher anpassen. Der Code muss
   mindestens 8 Zeichen haben; je länger, desto schwerer zu erraten:

   ```sql
   insert into public.wl_families (code, name) values ('HIER-EUER-CODE', 'Familie Mustermann');
   ```

4. Unter **Project Settings → API** die *Project URL* und den öffentlichen Schlüssel
   (*publishable* bzw. *anon*) kopieren und in `config.js` eintragen. **Nicht** den geheimen
   Schlüssel (*secret* / *service_role*) verwenden.
5. App veröffentlichen (siehe unten) und die Adresse samt Familiencode an die Familie geben.

## Auf dem Handy installieren

- **Android (Chrome):** Adresse öffnen → Menü ⋮ → „Zum Startbildschirm hinzufügen“ / „App installieren“.
- **iPhone (Safari):** Adresse öffnen → Teilen-Symbol → „Zum Home-Bildschirm“.

## Was man wissen muss

- **Familiencode statt Passwort:** Wer den Code kennt, kann alles lesen und ändern — auch als
  jemand anderes auftreten. Für eine Familie gewollt einfach; den Code nicht öffentlich posten.
- **Der Familiencode steht in keiner Datei dieses Ordners**, nur in der Datenbank. `config.js`
  enthält nur Adresse und öffentlichen Schlüssel; die dürfen sichtbar sein, weil die Tabellen
  gesperrt sind und jede Abfrage den Code verlangt.
- **Personen umbenennen oder entfernen** geht bisher nicht in der App, sondern im
  *Table Editor* von Supabase (Tabelle `wl_members`).
- **Kein Live-Abgleich:** Die Liste lädt neu beim Öffnen, beim Zurückkehren in die App und
  über den Knopf ↻.
- **Ohne Netz** zeigt die App den zuletzt geladenen Stand; ändern geht dann nicht.
- Supabase pausiert Gratis-Projekte nach längerer Nichtnutzung (Stand meines Wissens: etwa
  eine Woche ohne Zugriffe). Dann im Supabase-Dashboard auf „Restore“ klicken.

## Dateien

| Datei | Zweck |
|---|---|
| `index.html`, `style.css`, `app.js` | die App |
| `config.js` | Verbindung zur Datenbank (leer = Demo-Modus) |
| `sw.js`, `manifest.webmanifest`, `icons/` | machen die Seite installierbar und offline startfähig |
| `supabase/setup.sql` | Einrichtung der Datenbank |
| `dev-server.js` | Testserver für den eigenen Rechner |
| `werkzeuge/icons-erzeugen.ps1` | zeichnet das App-Symbol neu |
