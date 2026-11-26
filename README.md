# 🎱 Labirynt Powiatu Raciborskiego 3D (WebGL / Gyroscope Game)

Interaktywna, trójwymiarowa gra zręcznościowa w przeglądarce (**Three.js / WebGL**), inspirowana klasycznym drewniano-mosiężnym labiryntem kulkowym, osadzona na geograficznej mapie **Powiatu Raciborskiego**. Zadaniem gracza jest bezpieczne przeprowadzenie kulki z miejscowości startowej (A) do docelowej (B) wyżłobionymi drogami powiatu, omijając pośrednie miejscowości oraz ruch drogowy.

🔗 **Zagraj na żywo (Live Demo):** [https://vercel.app](https://vercel.app)

---

## 🎯 Główne funkcje projektu

* **Autentyczna geografia Powiatu Raciborskiego (19 miejscowości i węzłów):** Sieć wyżłobionych dróg łącząca m.in. Racibórz, Kuźnię Raciborską, Rudy, Nędzę, Rudnik, Modzurów, Pawłów, Pietrowice Wielkie, Krzanowice, Kornowac, Tworków, Krzyżanowice, Chałupki oraz wyloty graniczne i kierunkowe (Głubczyce, Kędzierzyn-Koźle, Gliwice, Rybnik).
* **Hydrografia i punkty orientacyjne regionu:** Zintegrowane koryto **rzeki Odry** ze **Zbiornikiem Racibórz Dolny** i mostami drogowymi, Lasy Rudzkie, miniatura Zamku Piastowskiego oraz zabytkowego opactwa w Rudach.
* **Żywy świat i lokalne akcenty:** Ruch samochodowy na drogach (w tym niebieski TIR z okolic Modzurowa zmierzający ku granicy), leśne zwierzęta (sarny i owieczki), jachty na Odrze i zbiorniku, przelatujące klucze dzikich gęsi (rezerwat Łężczok) oraz motoparalotnie z oprawą dźwiękową (Web Audio API).
* **Sterowanie żyroskopem telefonu oraz na PC:** Na smartfonach plansza reaguje na fizyczne przechylanie dłonią (`DeviceOrientationEvent` z kalibracją poziomu i wibracjami), a na komputerach obsługuje sterowanie klawiaturą (`WASD` / strzałki) oraz myszką.
* **Dwa tryby rozgrywki i dynamiczne etykiety:** Klasyczny przejazd z punktu A do B oraz tryb **Kurier Powiatu (3 kulki jednocześnie)** z dynamicznym powiększaniem nazw mijanych miejscowości.

## 🛠️ Technologie

* **Frontend & Silnik 3D:** React, TypeScript, Vite, Three.js (Cienie kierunkowe, proceduralne modele low-poly)
* **Sensory mobilne & Audio:** DeviceOrientation API, Vibration API, Web Audio API, PWA
* **Wdrożenie:** GitHub + Vercel

---

## 🇬🇧 English Summary

**Racibórz County 3D Labyrinth (WebGL / Tilt Game)** is a browser-based 3D wooden marble maze game built with Three.js and mapped onto the real road network and geography of **Racibórz County, Poland** (19 towns and border crossings, the Oder River, Racibórz Dolny Reservoir, Rudy Forests, and local landmarks).

Players tilt their smartphones (using device orientation sensors) or use keyboard/mouse controls on desktop to guide single or multiple balls through carved road grooves while avoiding intermediate holes, traffic, and wildlife.

---

## 👤 Autor / Author

**Artur Wierzbicki**  
*Koncepcja, projekt i realizacja / Concept, Design & Development*  
🔗 LinkedIn: [://linkedin.com](https://linkedin.com)

📄 Licencja / License: **MIT**
