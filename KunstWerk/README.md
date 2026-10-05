# KunstWerk

Diese Webapp ist eine statische Browser-Version des Photoshop-aehnlichen Editors. Sie läuft ohne Backend, Build-Schritt oder externe CDN-Abhängigkeiten und kann direkt über GitHub Pages ausgeliefert werden.

## Deployment

Wenn GitHub Pages den Repository-Root ausliefert, ist die App unter folgendem Pfad erreichbar:

```text
https://<user>.github.io/<repository>/webapp/
```

Alle Pfade sind relativ gehalten. Du kannst den Ordner `webapp/` also auch separat als Pages-Root oder in ein anderes statisches Hosting kopieren.

![KunstWerk Webapp nach automatischer Hintergrundentfernung](../docs/screenshots/bildwerk-webapp-background-remove.png)

## Enthalten

- Bild öffnen per Datei-Picker oder Drag-and-drop
- PNG-Export
- Rückgängig/Wiederholen
- Zoom, 100-Prozent-Ansicht und Einpassen
- Auswahlrechteck, Zuschneiden, Auswahl verpixeln und Auswahl transparent leeren
- Verpixelungspinsel mit Pinsel- und Rastergröße
- Automatische Hintergrundentfernung per Randanalyse und Flood-Fill
- Magic Pen mit Konturmodus: eine geschlossene Linie um den Vordergrund entfernt den außen erreichbaren Hintergrund und typische grün/blaue Hintergrundreste
- Korrekturen für Helligkeit, Kontrast, Sättigung, Wärme, Schärfe und Weichzeichnen
- Filter: Schwarzweiß, Sepia, Invertieren, Autokontrast, Tonwerte, Posterize, Kanten und Vignette

Die Webversion verwendet nur Browser-Canvas-Funktionen. Die `rembg`-KI-Hintergrundentfernung der Desktop-App ist deshalb nicht enthalten, aber der Button **Hintergrund entfernen** entfernt zusammenhängende Hintergründe automatisch anhand der Randfarben. Für komplexe Fotos ist der beste Ablauf: mit dem Magic Pen eine möglichst geschlossene Kontur um die Person oder das Objekt zeichnen und dann **Magic anwenden**.

![KunstWerk Webapp nach Magic-Pen-Konturfreistellung](../docs/screenshots/bildwerk-webapp-magic-contour.png)
