# Familien-Wunschliste

Eine Wunschliste fürs Handy: Jedes Familienmitglied trägt seine Wünsche ein, alle sehen die
Listen der anderen. Pro Wunsch gibt es Titel, Link zum Shop, ungefähren Preis und Wichtigkeit.
Eigene Wünsche kann man bearbeiten, als erfüllt abhaken und löschen.

Es gibt sie in zwei Formen mit demselben Inhalt und derselben Datenbank:

- **Android-App** zum direkten Installieren als APK-Datei (das Installationspaket einer
  Android-App) — der Hauptweg für die Familie.
- **Web-App** unter einer Internetadresse, z. B. für den Rechner oder ein iPhone.

## Stand (09.10.2026)

| Teil | Stand |
|---|---|
| App-Oberfläche | fertig, im Browser in Handygröße getestet |
| Supabase-Projekt „Wunschliste“ (Region eu-west-1) | eingerichtet, `supabase/setup.sql` ausgeführt |
| Datenbank-Funktionen | per Selbsttest in der Datenbank geprüft (anlegen, ändern, abhaken, löschen, falscher Code, unzulässiger Link) |
| Zugriff von außen | geprüft: Tabellen gesperrt, falscher Code wird abgewiesen |
| `config.js` | Adresse und öffentlicher Schlüssel eingetragen |
| Familie mit Familiencode | angelegt (von Niklas, Code steht nur in der Datenbank) |
| Veröffentlichung im Internet | GitHub Pages, siehe Adresse unten |
| Android-App | wird auf GitHub gebaut und signiert; Version 1.0.0 liegt als `2026-10-09_Wunschliste-1.0.0.apk` im Projektordner. **Noch nicht auf einem echten Handy getestet.** |

## Android-App

**Installieren:** Die APK-Datei aufs Handy bringen (Messenger, E-Mail, USB, Cloud) und antippen.
Android fragt einmal, ob die App, mit der man die Datei öffnet, „unbekannte Apps installieren“
darf — erlauben. Meldet Play Protect einen unbekannten Entwickler, „Trotzdem installieren“ wählen.

**Neue Version bauen:** Die App enthält ihre Dateien selbst. Eine Änderung kommt deshalb erst
mit einer neuen APK auf die Handys:

1. Änderung committen und mit `git push` zu GitHub hochladen. Für eine neue Versionsnummer
   vorher `version` in `package.json` erhöhen.
2. GitHub baut automatisch (Reiter „Actions“, Ablauf „Android-App bauen“, ca. 2 Minuten).
3. Ergebnis herunterladen und verteilen:

   ```powershell
   gh run download --name Wunschliste-APK
   ```

   (`gh` ist das GitHub-Kommandozeilenwerkzeug; ohne weitere Angabe fragt es nach dem Lauf.)

Die neue APK wird einfach über die alte installiert; Familiencode und Name bleiben gespeichert.

**Signaturschlüssel:** Android nimmt ein Update nur an, wenn es mit demselben Schlüssel
unterschrieben ist. Der Schlüssel liegt im Ordner `signatur/` (nicht im Repository) und als
Secret bei GitHub. **Den Ordner `signatur/` einmal sichern**, siehe `signatur/LIESMICH.txt`.

Auf diesem Rechner lässt sich die App nicht bauen: Android SDK und ein aktuelles Java fehlen.
Deshalb läuft der Bau auf GitHub.

## Adresse der Web-App

**<https://nikdas1234.github.io/familien-wunschliste/>**

Die Adresse zusammen mit dem Familiencode an die Familie geben. Ausgeliefert wird der Stand des
öffentlichen Repositorys <https://github.com/Nikdas1234/familien-wunschliste> (Branch `main`).
Änderungen erscheinen dort erst nach einem `git push`, etwa eine Minute später.

## Am Rechner ausprobieren

```powershell
node dev-server.js
```

Dann <http://localhost:5180> im Browser öffnen. Die App fragt nach dem Familiencode und arbeitet dann mit der echten Datenbank. Leert man die
beiden Werte in `config.js`, läuft der **Demo-Modus** mit Beispielfamilie nur in diesem Browser.

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

## Web-App auf dem Handy installieren (Alternative zur Android-App)

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
| `android/`, `capacitor.config.json`, `package.json` | Android-Hülle (Capacitor: packt die Web-Dateien in eine Android-App) |
| `.github/workflows/android.yml` | Bauablauf auf GitHub |
| `werkzeuge/www-bauen.js` | stellt die Dateien für die Android-App zusammen |
| `signatur/` | Signaturschlüssel, nur lokal |
| `werkzeuge/icons-erzeugen.ps1` | zeichnet das App-Symbol neu |
