-- Import automatico da USDA FoodData Central (173/177 trovati)
-- 10 righe segnalate come DA VERIFICARE (vedi commenti sopra ogni riga)
insert into public.foods (name, category, kcal_100g, protein_100g, carbs_100g, fat_100g, fiber_100g, source, source_id)
values
-- Petto di pollo → USDA: "Chicken, breast, boneless, skinless, raw"
('Petto di pollo', 'proteine', 106, 22.5, 0, 1.9, 0, 'usda', '2646170'),
-- Coscia di pollo → USDA: "Chicken, skin (drumsticks and thighs), raw"
('Coscia di pollo', 'proteine', 440, 9.6, 0.8, 44.2, 0, 'usda', '172855'),
-- Petto di tacchino → USDA: "Turkey, whole, breast, meat only, raw"
('Petto di tacchino', 'proteine', 114, 23.7, 0.1, 1.5, 0, 'usda', '171098'),
-- Manzo macinato magro → USDA: "Beef, ground, 90% lean meat / 10% fat, raw"
('Manzo macinato magro', 'proteine', 176, 20, 0, 10, 0, 'usda', '174030'),
-- Manzo (scamone) → USDA: "Beef, top sirloin steak, raw"
('Manzo (scamone)', 'proteine', 140, 22, 0.2, 5.7, 0, 'usda', '2727574'),
-- Lonza di maiale → USDA: "Pork, loin, boneless, raw"
('Lonza di maiale', 'proteine', 168, 21.1, 0, 9.5, 0, 'usda', '2646168'),
-- Salmone → USDA: "Fish, salmon, Atlantic, farmed, raw"
('Salmone', 'proteine', 208, 20.4, 0, 13.4, 0, 'usda', '175167'),
-- Tonno fresco → USDA: "Fish, tuna, fresh, bluefin, raw"
('Tonno fresco', 'proteine', 144, 23.3, 0, 4.9, 0, 'usda', '173706'),
-- Tonno in scatola (al naturale) → USDA: "Fish, tuna, light, canned in water, drained solids"
('Tonno in scatola (al naturale)', 'proteine', 90, 19, 0.1, 0.9, 0, 'usda', '334194'),
-- Merluzzo → USDA: "Fish, cod, Atlantic, raw"
('Merluzzo', 'proteine', 82, 17.8, 0, 0.7, 0, 'usda', '171955'),
-- Gamberi → USDA: "Crustaceans, shrimp, raw"
('Gamberi', 'proteine', 85, 20.1, 0, 0.5, 0, 'usda', '175179'),
-- Uovo intero → USDA: "Egg, whole, raw, fresh"
('Uovo intero', 'proteine', 143, 12.6, 0.7, 9.5, 0, 'usda', '171287'),
-- Albume d'uovo → USDA: "Egg, white, raw, fresh"
('Albume d''uovo', 'proteine', 52, 10.9, 0.7, 0.2, 0, 'usda', '172183'),
-- Prosciutto cotto → USDA: "Ham, honey, smoked, cooked"
('Prosciutto cotto', 'proteine', 122, 17.9, 7.3, 2.4, 0, 'usda', '174611'),
-- Tofu → USDA: "Tofu, raw, firm, prepared with calcium sulfate"
('Tofu', 'legumi', 144, 17.3, 2.8, 8.7, 2.3, 'usda', '172475'),
-- Lenticchie (cotte) → USDA: "Lentils, mature seeds, cooked, boiled, with salt"
('Lenticchie (cotte)', 'legumi', 114, 9, 19.5, 0.4, 7.9, 'usda', '175254'),
-- Ceci (cotti) → USDA: "Chickpeas (garbanzo beans, bengal gram), mature seeds, cooked, boiled, with salt"
('Ceci (cotti)', 'legumi', 164, 8.9, 27.4, 2.6, 7.6, 'usda', '173799'),
-- Fagioli borlotti (cotti) → USDA: "Beans, kidney, red, mature seeds, cooked, boiled, with salt"
('Fagioli borlotti (cotti)', 'legumi', 127, 8.7, 22.8, 0.5, 7.4, 'usda', '175242'),
-- Fagioli neri (cotti) → USDA: "Beans, black, mature seeds, cooked, boiled, with salt"
('Fagioli neri (cotti)', 'legumi', 132, 8.9, 23.7, 0.5, 8.7, 'usda', '175237'),
-- Fagioli cannellini (cotti) → USDA: "Beans, cannellini, dry"
('Fagioli cannellini (cotti)', 'legumi', 345, 21.6, 59.8, 2.2, 0, 'usda', '2644281'),
-- Edamame → USDA: "Edamame, frozen, prepared"
('Edamame', 'legumi', 121, 11.9, 8.9, 5.2, 5.2, 'usda', '168411'),
-- Piselli (cotti) → USDA: "Peas, green, cooked, boiled, drained, with salt"
('Piselli (cotti)', 'legumi', 84, 5.4, 15.6, 0.2, 5.5, 'usda', '170102'),
-- Pasta di semola (cruda) → USDA: "Bulgur, dry, raw"
('Pasta di semola (cruda)', 'carboidrati', 372, 11.8, 75.9, 2.4, 11.7, 'usda', '2710820'),
-- Pasta integrale (cruda) → USDA: "Pasta, whole grain, 51% whole wheat, remaining unenriched semolina, dry"
('Pasta integrale (cruda)', 'carboidrati', 362, 13.5, 73.1, 2.7, 10.1, 'usda', '168915'),
-- Riso bianco (crudo) → USDA: "Rice, white, long grain, unenriched, raw"
('Riso bianco (crudo)', 'carboidrati', 359, 7, 80.3, 1, 0.1, 'usda', '2512381'),
-- Riso integrale (crudo) → USDA: "Rice, brown, long grain, unenriched, raw"
('Riso integrale (crudo)', 'carboidrati', 366, 7.3, 76.7, 3.3, 3, 'usda', '2512380'),
-- Riso basmati (crudo) → USDA: "Wild rice, raw"
('Riso basmati (crudo)', 'carboidrati', 357, 14.7, 74.9, 1.1, 6.2, 'usda', '169726'),
-- Pane bianco → USDA: "Bread, white wheat"
('Pane bianco', 'carboidrati', 238, 10.7, 43.9, 2.2, 9.2, 'usda', '167532'),
-- Pane integrale → USDA: "Bread, pita, whole-wheat"
('Pane integrale', 'carboidrati', 262, 9.8, 55.9, 1.7, 6.1, 'usda', '174916'),
-- Pane di segale → USDA: "Bread, rye"
('Pane di segale', 'carboidrati', 259, 8.5, 48.3, 3.3, 5.8, 'usda', '172684'),
-- Patate → USDA: "Potatoes, raw, skin"
('Patate', 'carboidrati', 58, 2.6, 12.4, 0.1, 2.5, 'usda', '170032'),
-- Patate dolci → USDA: "Sweet potato leaves, raw"
('Patate dolci', 'carboidrati', 42, 2.5, 8.8, 0.5, 5.3, 'usda', '169303'),
-- Fiocchi d'avena → USDA: "Cereals, oats, regular and quick, not fortified, dry"
('Fiocchi d''avena', 'carboidrati', 379, 13.2, 67.7, 6.5, 10.1, 'usda', '173904'),
-- Quinoa (cruda) → USDA: "Flour, quinoa"
('Quinoa (cruda)', 'carboidrati', 385, 11.9, 69.5, 6.6, 6.3, 'usda', '2512372'),
-- Cous cous (crudo) → USDA: "Couscous, dry"
('Cous cous (crudo)', 'carboidrati', 376, 12.8, 77.4, 0.6, 5, 'usda', '169699'),
-- Polenta (farina di mais) → USDA: "Cornmeal, degermed, enriched, yellow"
('Polenta (farina di mais)', 'carboidrati', 370, 7.1, 79.4, 1.8, 3.9, 'usda', '168867'),
-- Crackers integrali → USDA: "Crackers, whole-wheat"
('Crackers integrali', 'carboidrati', 427, 10.6, 69.6, 14.1, 10.3, 'usda', '172749'),
-- Gallette di riso → USDA: "Rice cake, cracker (include hain mini rice cakes)"
('Gallette di riso', 'carboidrati', 392, 7.1, 81.1, 4.3, 4.2, 'usda', '168107'),
-- Spinaci → USDA: "Spinach, raw"
('Spinaci', 'verdure', 23, 2.9, 3.6, 0.4, 2.2, 'usda', '168462'),
-- Broccoli → USDA: "Broccoli, raw"
('Broccoli', 'verdure', 31, 2.6, 6.3, 0.3, 2.4, 'usda', '747447'),
-- Zucchine → USDA: "Zucchini"
('Zucchine', 'verdure', 17, 1.21, 3.11, 0.32, 1.1, 'usda', '168565'),
-- Pomodori → USDA: "Tomatoes, grape, raw"
('Pomodori', 'verdure', 27, 0.8, 5.5, 0.6, 2.1, 'usda', '321360'),
-- Pomodorini → USDA: "Cherries, sweet, raw"
('Pomodorini', 'verdure', 63, 1.1, 16, 0.2, 2.1, 'usda', '171719'),
-- Carote → USDA: "Carrots, raw"
('Carote', 'verdure', 41, 0.9, 9.6, 0.2, 2.8, 'usda', '170393'),
-- Peperoni → USDA: "Peppers, bell, green, raw"
('Peperoni', 'verdure', 22.9, 0.7, 4.8, 0.1, 0.9, 'usda', '2258588'),
-- Melanzane → USDA: "Eggplant, raw"
('Melanzane', 'verdure', 25, 1, 5.9, 0.2, 3, 'usda', '169228'),
-- Lattuga → USDA: "Lettuce, cos or romaine, raw"
('Lattuga', 'verdure', 17, 1.2, 3.3, 0.3, 2.1, 'usda', '169247'),
-- Rucola → USDA: "Arugula, raw"
('Rucola', 'verdure', 25, 2.6, 3.7, 0.7, 1.6, 'usda', '169387'),
-- Cetrioli → USDA: "Cucumber, peeled, raw"
('Cetrioli', 'verdure', 10, 0.6, 2.2, 0.2, 0.7, 'usda', '169225'),
-- Cipolle → USDA: "Onions, raw"
('Cipolle', 'verdure', 40, 1.1, 9.3, 0.1, 1.7, 'usda', '170000'),
-- Aglio → USDA: "Garlic, raw"
('Aglio', 'verdure', 143, 6.6, 28.2, 0.4, 2.7, 'usda', '1104647'),
-- Funghi champignon → USDA: "Mushrooms, Chanterelle, raw"
('Funghi champignon', 'verdure', 32, 1.5, 6.9, 0.5, 3.8, 'usda', '168422'),
-- Cavolfiore → USDA: "Cauliflower, raw"
('Cavolfiore', 'verdure', 27.6, 1.6, 4.7, 0.2, 2, 'usda', '2685573'),
-- Fagiolini → USDA: "Beans, snap, green, raw"
('Fagiolini', 'verdure', 40, 2, 7.4, 0.3, 3, 'usda', '2346400'),
-- Asparagi → USDA: "Asparagus, raw"
('Asparagi', 'verdure', 20, 2.2, 3.9, 0.1, 2.1, 'usda', '168389'),
-- Cavolo → USDA: "Cabbage, raw"
('Cavolo', 'verdure', 25, 1.3, 5.8, 0.1, 2.5, 'usda', '169975'),
-- Carciofi → USDA: "Jerusalem-artichokes, raw"
('Carciofi', 'verdure', 73, 2, 17.4, 0, 1.6, 'usda', '169236'),
-- Finocchi → USDA: "Fennel, bulb, raw"
('Finocchi', 'verdure', 26.9, 0.9, 5.5, 0.1, 2.1, 'usda', '2747655'),
-- Sedano → USDA: "Celery, raw"
('Sedano', 'verdure', 16.7, 0.5, 3.3, 0.2, 0, 'usda', '2346405'),
-- Zucca → USDA: "Pumpkin, raw"
('Zucca', 'verdure', 26, 1, 6.5, 0.1, 0.5, 'usda', '168448'),
-- Banana → USDA: "Bananas, raw"
('Banana', 'frutta', 89, 1.1, 22.8, 0.3, 2.6, 'usda', '173944'),
-- Mela → USDA: "Rose-apples, raw"
('Mela', 'frutta', 25, 0.6, 5.7, 0.3, 0, 'usda', '168171'),
-- Arancia → USDA: "Orange peel, raw"
('Arancia', 'frutta', 97, 1.5, 25, 0.2, 10.6, 'usda', '169103'),
-- Fragole → USDA: "Strawberries, raw"
('Fragole', 'frutta', 32, 0.7, 7.7, 0.3, 2, 'usda', '167762'),
-- Mirtilli → USDA: "Blueberries, raw"
('Mirtilli', 'frutta', 63.9, 0.7, 14.6, 0.3, 0, 'usda', '2346411'),
-- Kiwi → USDA: "Kiwifruit (kiwi), green, peeled, raw"
('Kiwi', 'frutta', 65.1, 1, 13.8, 0.6, 2.1, 'usda', '2710831'),
-- Pera → USDA: "Pears, raw"
('Pera', 'frutta', 57, 0.4, 15.2, 0.1, 3.1, 'usda', '169118'),
-- Uva → USDA: "Grape leaves, raw"
('Uva', 'frutta', 93, 5.6, 17.3, 2.1, 11, 'usda', '168575'),
-- Ananas → USDA: "Pineapple, raw"
('Ananas', 'frutta', 60.1, 0.5, 14.1, 0.2, 0.9, 'usda', '2346398'),
-- Anguria → USDA: "Watermelon, raw"
('Anguria', 'frutta', 30, 0.6, 7.6, 0.2, 0.4, 'usda', '167765'),
-- Melone → USDA: "Melons, cantaloupe, raw"
('Melone', 'frutta', 34, 0.8, 8.2, 0.2, 0.8, 'usda', '746770'),
-- Pesca → USDA: "Peaches, yellow, raw"
('Pesca', 'frutta', 42, 0.9, 10.1, 0.3, 1.5, 'usda', '325430'),
-- Albicocca → USDA: "Apricots, raw"
('Albicocca', 'frutta', 48, 1.4, 11.1, 0.4, 2, 'usda', '171697'),
-- Avocado → USDA: "Avocados, raw, California"
('Avocado', 'frutta', 167, 2, 8.6, 15.4, 6.8, 'usda', '171706'),
-- Limone (succo) → USDA: "Lemon juice, raw"
('Limone', 'frutta', 22, 0.4, 6.9, 0.2, 0.3, 'usda', '167747'),
-- Fichi → USDA: "Figs, raw"
('Fichi', 'frutta', 74, 0.8, 19.2, 0.3, 2.9, 'usda', '173021'),
-- Uvetta → USDA: "Raisins, seeded"
('Uvetta', 'frutta', 296, 2.5, 78.5, 0.5, 6.8, 'usda', '168166'),
-- Datteri → USDA: "Dates, medjool"
('Datteri', 'frutta', 277, 1.8, 75, 0.2, 6.7, 'usda', '168191'),
-- Latte intero → USDA: "Cheese, mozzarella, whole milk"
('Latte intero', 'latticini', 299, 22.2, 2.4, 22.1, 0, 'usda', '170845'),
-- Latte scremato → USDA: "Yogurt, plain, skim milk"
('Latte scremato', 'latticini', 56, 5.7, 7.7, 0.2, 0, 'usda', '170887'),
-- Yogurt greco (0%) → USDA: "Yogurt, Greek, plain, nonfat"
('Yogurt greco (0%)', 'latticini', 61, 10.3, 3.6, 0.4, 0, 'usda', '330137'),
-- Yogurt intero → USDA: "Yogurt, plain, whole milk"
('Yogurt intero', 'latticini', 61, 3.5, 4.7, 3.3, 0, 'usda', '171284'),
-- Mozzarella → USDA: "Cheese, mozzarella, nonfat"
('Mozzarella', 'latticini', 141, 31.7, 3.5, 0, 1.8, 'usda', '169051'),
-- Parmigiano → USDA: "Cheese, parmesan, grated"
('Parmigiano', 'latticini', 420, 28.4, 13.9, 27.8, 0, 'usda', '171247'),
-- Ricotta → USDA: "Cheese, ricotta, whole milk"
('Ricotta', 'latticini', 157, 7.8, 6.9, 11, 0, 'usda', '746766'),
-- Cottage cheese (fiocchi di latte) → USDA: "Cheese, cottage, with vegetables"
('Cottage cheese (fiocchi di latte)', 'latticini', 95, 10.9, 3, 4.2, 0.1, 'usda', '169078'),
-- Feta → USDA: "Cheese, feta"
('Feta', 'latticini', 265, 14.2, 3.9, 21.5, 0, 'usda', '173420'),
-- Provolone → USDA: "Cheese, provolone"
('Provolone', 'latticini', 351, 25.6, 2.1, 26.6, 0, 'usda', '170850'),
-- Mascarpone → USDA: "Cheese spread, cream cheese base"
('Mascarpone', 'latticini', 295, 7.1, 3.5, 28.6, 0, 'usda', '169081'),
-- Olio extravergine d'oliva → USDA: "Oil, corn, peanut, and olive"
('Olio extravergine d''oliva', 'grassi', 884, 0, 0, 100, 0, 'usda', '167737'),
-- Burro → USDA: "Butter, Clarified butter (ghee)"
('Burro', 'grassi', 900, 0, 0, 100, 0, 'usda', '171314'),
-- Mandorle → USDA: "Nuts, almonds, whole, raw"
('Mandorle', 'grassi', 626, 21.5, 20, 51.1, 10.8, 'usda', '2346393'),
-- Noci → USDA: "Nuts, walnuts, English, halves, raw"
('Noci', 'grassi', 730, 14.6, 10.9, 69.7, 5.2, 'usda', '2346394'),
-- Pistacchi → USDA: "Nuts, pistachio nuts, raw"
('Pistacchi', 'grassi', 560, 20.2, 27.2, 45.3, 10.6, 'usda', '170184'),
-- Nocciole → USDA: "Nuts, hazelnuts or filberts, raw"
('Nocciole', 'grassi', 641, 13.5, 26.5, 53.5, 8.4, 'usda', '2515375'),
-- Arachidi → USDA: "Peanuts, raw"
('Arachidi', 'grassi', 588, 23.2, 26.5, 43.3, 8, 'usda', '2515376'),
-- Burro d'arachidi → USDA: "Peanut butter, creamy"
('Burro d''arachidi', 'grassi', 632, 24, 22.7, 49.4, 6.3, 'usda', '2262072'),
-- Semi di girasole → USDA: "Seeds, sunflower seed, kernel, raw"
('Semi di girasole', 'grassi', 609, 18.9, 24.5, 48.4, 7.2, 'usda', '2515381'),
-- Semi di chia → USDA: "Chia seeds, dry, raw"
('Semi di chia', 'grassi', 517, 17, 38.3, 32.9, 0, 'usda', '2710819'),
-- Semi di lino → USDA: "Flaxseed, ground"
('Semi di lino', 'grassi', 545, 18, 34.4, 37.3, 23.1, 'usda', '2262075'),
-- Olive → USDA: "Olive loaf, pork"
('Olive', 'grassi', 235, 11.8, 9.2, 16.5, 0, 'usda', '172926'),
-- Miele → USDA: "Honey"
('Miele', 'condimenti', 304, 0.3, 82.4, 0, 0.2, 'usda', '169640'),
-- Aceto balsamico → USDA: "Vinegar, balsamic"
('Aceto balsamico', 'condimenti', 88, 0.5, 17, 0, 0, 'usda', '172241'),
-- Passata di pomodoro → USDA: "Tomato products, canned, sauce"
('Passata di pomodoro', 'condimenti', 24, 1.2, 5.3, 0.3, 1.5, 'usda', '170054'),
-- Cioccolato fondente 70% → USDA: "Chocolate, dark, 70-85% cacao solids"
('Cioccolato fondente 70%', 'condimenti', 598, 7.8, 45.9, 42.6, 10.9, 'usda', '170273'),
-- Proteine whey (polvere) → USDA: "Beverages, Protein powder whey based"
('Proteine whey (polvere)', 'condimenti', 352, 78.1, 6.3, 1.6, 3.1, 'usda', '173180'),
-- Salsiccia di maiale → USDA: "Sausage, Italian, pork, mild, raw"
('Salsiccia di maiale', 'proteine', 290, 13.9, 3, 24.3, 0, 'usda', '171631'),
-- Bistecca di manzo → USDA: "Beef, tenderloin steak, raw"
('Bistecca di manzo', 'proteine', 143, 21.1, 0.2, 6.5, 0, 'usda', '2727573'),
-- Petto d'anatra → USDA: "Duck, wild, breast, meat only, raw"
('Petto d''anatra', 'proteine', 123, 19.8, 0, 4.3, 0, 'usda', '174469'),
-- Coniglio → USDA: "Game meat, rabbit, wild, raw"
('Coniglio', 'proteine', 114, 21.8, 0, 2.3, 0, 'usda', '174347'),
-- Sardine (in scatola) → USDA: "Fish, sardine, Atlantic, canned in oil, drained solids with bone"
('Sardine (in scatola)', 'proteine', 208, 24.6, 0, 11.4, 0, 'usda', '175139'),
-- Acciughe → USDA: "Fish, anchovy, european, raw"
('Acciughe', 'proteine', 131, 20.4, 0, 4.8, 0, 'usda', '174182'),
-- Cozze → USDA: "Mollusks, mussel, blue, raw"
('Cozze', 'proteine', 86, 11.9, 3.7, 2.2, 0, 'usda', '174216'),
-- Sgombro → USDA: "Fish, mackerel, Atlantic, raw"
('Sgombro', 'proteine', 205, 18.6, 0, 13.9, 0, 'usda', '175119'),
-- Vitello → USDA: "Veal, leg, top round, cap off, cutlet, boneless, raw"
('Vitello', 'proteine', 107, 22.1, 0, 2.1, 0, 'usda', '172643'),
-- Agnello → USDA: "Frog legs, raw"
('Agnello', 'proteine', 73, 16.4, 0, 0.3, 0, 'usda', '168148'),
-- Semi di soia (cotti) → USDA: "Oil, soybean, salad or cooking"
('Semi di soia (cotti)', 'legumi', 884, 0, 0, 100, 0, 'usda', '171411'),
-- Piselli spezzati (cotti) → USDA: "Peas, split, mature seeds, cooked, boiled, with salt"
('Piselli spezzati (cotti)', 'legumi', 116, 8.3, 20.5, 0.4, 8.3, 'usda', '175257'),
-- Fave (cotte) → USDA: "Broadbeans (fava beans), mature seeds, cooked, boiled, with salt"
('Fave (cotte)', 'legumi', 110, 7.6, 19.6, 0.4, 5.4, 'usda', '173798'),
-- Lupini → USDA: "Beans, liquid from stewed kidney beans"
('Lupini', 'legumi', 47, 1.8, 2.8, 3.2, 0.1, 'usda', '169885'),
-- Fagioli mung (cotti) → USDA: "Mung beans, mature seeds, cooked, boiled, with salt"
('Fagioli mung (cotti)', 'legumi', 105, 7, 19.2, 0.4, 7.6, 'usda', '175255'),
-- Farro (crudo) → USDA: "Farro, pearled, dry, raw"
('Farro (crudo)', 'carboidrati', 367, 12.6, 72.1, 3.1, 7.3, 'usda', '2710828'),
-- Orzo perlato (crudo) → USDA: "Barley, pearled, raw"
('Orzo perlato (crudo)', 'carboidrati', 352, 9.9, 77.7, 1.2, 15.6, 'usda', '170284'),
-- Grano saraceno (crudo) → USDA: "Buckwheat"
('Grano saraceno (crudo)', 'carboidrati', 343, 13.2, 71.5, 3.4, 10, 'usda', '170286'),
-- Tortilla di frumento → USDA: "Tortilla, wheat flour, shelf stable"
('Tortilla di frumento', 'carboidrati', 0, 0, 0, 0, 0, 'usda', '2758996'),
-- Grissini → USDA: "Fast foods, breadstick, soft, prepared with garlic and parmesan cheese"
('Grissini', 'carboidrati', 343, 12.2, 44.5, 12.9, 2.4, 'usda', '170788'),
-- Muesli → USDA: "Cereals ready-to-eat, ALPEN"
('Muesli', 'carboidrati', 352, 11.2, 75.7, 3.3, 9.1, 'usda', '169075'),
-- Pretzel → USDA: "Babyfood, pretzels"
('Pretzel', 'carboidrati', 397, 10.8, 82.2, 2, 2.3, 'usda', '171370'),
-- Fette croccanti di segale → USDA: "Crackers, crispbread, rye"
('Fette croccanti di segale', 'carboidrati', 366, 7.9, 82.2, 1.3, 16.5, 'usda', '172739'),
-- Semolino → USDA: "Flour, semolina, fine"
('Semolino', 'carboidrati', 358, 13.3, 72, 1.8, 3.7, 'usda', '2003589'),
-- Radicchio → USDA: "Radicchio, raw"
('Radicchio', 'verdure', 23, 1.4, 4.5, 0.3, 0.9, 'usda', '168564'),
-- Bietola → USDA: "Chard, swiss, raw"
('Bietola', 'verdure', 19, 1.8, 3.7, 0.2, 1.6, 'usda', '169991'),
-- Cime di rapa → USDA: "Turnip greens, raw"
('Cime di rapa', 'verdure', 32, 1.5, 7.1, 0.3, 3.2, 'usda', '170061'),
-- Verza → USDA: "Cabbage, savoy, raw"
('Verza', 'verdure', 27, 2, 6.1, 0.1, 3.1, 'usda', '170388'),
-- Cavolo nero → USDA: "Kale, raw"
('Cavolo nero', 'verdure', 35, 2.9, 4.4, 1.5, 4.1, 'usda', '168421'),
-- Porri → USDA: "Leeks, (bulb and lower leaf-portion), raw"
('Porri', 'verdure', 61, 1.5, 14.2, 0.3, 1.8, 'usda', '169246'),
-- Ravanelli → USDA: "Radishes, raw"
('Ravanelli', 'verdure', 16, 0.7, 3.4, 0.1, 1.6, 'usda', '169276'),
-- Barbabietola → USDA: "Abiyuch, raw"
('Barbabietola', 'verdure', 69, 1.5, 17.6, 0.1, 5.3, 'usda', '167782'),
-- Cavoletti di Bruxelles → USDA: "Brussels sprouts, raw"
('Cavoletti di Bruxelles', 'verdure', 59.5, 4, 9.6, 0.6, 4.8, 'usda', '2685575'),
-- Gombo → USDA: "Okra, raw"
('Gombo', 'verdure', 33, 1.9, 7.5, 0.2, 3.2, 'usda', '169260'),
-- Erba cipollina → USDA: "Chives, raw"
('Erba cipollina', 'verdure', 30, 3.3, 4.4, 0.7, 2.5, 'usda', '169994'),
-- Prezzemolo → USDA: "Parsley, fresh"
('Prezzemolo', 'verdure', 36, 3, 6.3, 0.8, 3.3, 'usda', '170416'),
-- Cipollotto → USDA: "Onions, spring or scallions (includes tops and bulb), raw"
('Cipollotto', 'verdure', 32, 1.8, 7.3, 0.2, 2.6, 'usda', '170005'),
-- Melograno → USDA: "Pomegranates, raw"
('Melograno', 'frutta', 83, 1.7, 18.7, 1.2, 4, 'usda', '169134'),
-- Cachi → USDA: "Persimmons, japanese, raw"
('Cachi', 'frutta', 70, 0.6, 18.6, 0.2, 3.6, 'usda', '169941'),
-- Prugna → USDA: "Plums, raw"
('Prugna', 'frutta', 46, 0.7, 11.4, 0.3, 1.4, 'usda', '169949'),
-- Ciliegie → USDA: "Cherries, sweet, raw"
('Ciliegie', 'frutta', 63, 1.1, 16, 0.2, 2.1, 'usda', '171719'),
-- Mandarino → USDA: "Mandarin, seedless, peeled, raw"
('Mandarino', 'frutta', 62, 1, 13.4, 0.5, 1.3, 'usda', '2710832'),
-- Papaya → USDA: "Papayas, raw"
('Papaya', 'frutta', 43, 0.5, 10.8, 0.3, 1.7, 'usda', '169926'),
-- Mango → USDA: "Mangos, raw"
('Mango', 'frutta', 60, 0.8, 15, 0.4, 1.6, 'usda', '169910'),
-- Cocco fresco → USDA: "Egg, white, raw, fresh"
('Cocco fresco', 'frutta', 52, 10.9, 0.7, 0.2, 0, 'usda', '172183'),
-- More → USDA: "Blackberries, raw"
('More', 'frutta', 43, 1.4, 9.6, 0.5, 5.3, 'usda', '173946'),
-- Lamponi → USDA: "Raspberries, raw"
('Lamponi', 'frutta', 57.3, 1, 12.9, 0.2, 0, 'usda', '2346410'),
-- Gorgonzola → USDA: "Cheese spread, cream cheese base"
('Gorgonzola', 'latticini', 295, 7.1, 3.5, 28.6, 0, 'usda', '169081'),
-- Taleggio → USDA: "Cheese spread, cream cheese base"
('Taleggio', 'latticini', 295, 7.1, 3.5, 28.6, 0, 'usda', '169081'),
-- Stracchino → USDA: "Cheese spread, cream cheese base"
('Stracchino', 'latticini', 295, 7.1, 3.5, 28.6, 0, 'usda', '169081'),
-- Kefir → USDA: "Croutons, plain"
('Kefir', 'latticini', 407, 11.9, 73.5, 6.6, 5.1, 'usda', '172751'),
-- Latte di mandorla (senza zucchero) → USDA: "Almond milk, unsweetened, plain, refrigerated"
('Latte di mandorla (senza zucchero)', 'latticini', 19.3, 0.7, 0.7, 1.6, 0, 'usda', '2257045'),
-- Latte di soia (senza zucchero) → USDA: "Soy milk, unsweetened, plain, shelf stable"
('Latte di soia (senza zucchero)', 'latticini', 38.5, 3.6, 1.3, 2.1, 0, 'usda', '1999630'),
-- Anacardi → USDA: "Nuts, cashew nuts, raw"
('Anacardi', 'grassi', 565, 17.4, 36.3, 38.9, 4.1, 'usda', '2515374'),
-- Macadamia → USDA: "Nuts, macadamia nuts, raw"
('Macadamia', 'grassi', 718, 7.9, 13.8, 75.8, 8.6, 'usda', '170178'),
-- Semi di zucca → USDA: "Seeds, pumpkin seeds (pepitas), raw"
('Semi di zucca', 'grassi', 555, 29.9, 18.7, 40, 5.1, 'usda', '2515380'),
-- Semi di sesamo → USDA: "Seeds, sesame seeds, whole, roasted and toasted"
('Semi di sesamo', 'grassi', 565, 17, 25.7, 48, 14, 'usda', '170151'),
-- Olio di cocco → USDA: "Oil, coconut"
('Olio di cocco', 'grassi', 892, 0, 0, 99.1, 0, 'usda', '171412'),
-- Tahina (crema di sesamo) → USDA: "Seeds, sesame butter, tahini, type of kernels unspecified"
('Tahina (crema di sesamo)', 'grassi', 592, 17.4, 21.5, 53, 4.7, 'usda', '168604'),
-- Pinoli → USDA: "Nuts, pine nuts, raw"
('Pinoli', 'grassi', 689, 15.7, 18.6, 61.3, 3.9, 'usda', '2346392'),
-- Senape → USDA: "Oil, mustard"
('Senape', 'condimenti', 884, 0, 0, 100, 0, 'usda', '172337'),
-- Salsa di soia → USDA: "Soy sauce made from soy (tamari)"
('Salsa di soia', 'condimenti', 60, 10.5, 5.6, 0.1, 0.8, 'usda', '174278'),
-- Aceto di mele → USDA: "Vinegar, cider"
('Aceto di mele', 'condimenti', 21, 0, 0.9, 0, 0, 'usda', '173469'),
-- Cacao amaro in polvere → USDA: "Cocoa, dry powder, unsweetened"
('Cacao amaro in polvere', 'condimenti', 228, 19.6, 57.9, 13.7, 37, 'usda', '169593'),
-- Sciroppo d'acero → USDA: "Syrups, maple"
('Sciroppo d''acero', 'condimenti', 260, 0, 67, 0.1, 0, 'usda', '169661'),
-- Marmellata → USDA: "Jams, preserves, marmalades, sweetened with fruit juice"
('Marmellata', 'condimenti', 212, 0, 52.9, 0, 0.9, 'usda', '170280');
