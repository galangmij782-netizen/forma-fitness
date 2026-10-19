// Built-in food table for typed meal logging. Values are per 100 g (USDA-style averages,
// Filipino dishes are typical home recipes). `u` maps a unit or size to grams per one.
// Everything here is an estimate: the meal editor lets the user correct any line.

import { MORE_ROWS } from './foodDbMore'

export interface BuiltinFood {
  name: string
  aliases: string[]
  kcal: number; protein: number; carbs: number; fat: number
  u: Partial<Record<UnitKey, number>>
  /** grams per ml, for volume units the food doesn't list itself */
  d?: number
}

export type UnitKey = 'piece' | 'small' | 'medium' | 'large' | 'xl' | 'slice' | 'cup' | 'tbsp' | 'tsp' | 'serving' | 'scoop'
  | 'bowl' | 'glass' | 'mug' | 'can' | 'bottle' | 'pack' | 'handful' | 'plate'

type Row = [name: string, aliases: string, kcal: number, protein: number, carbs: number, fat: number, units: BuiltinFood['u'], density?: number]

const ROWS: Row[] = [
  // eggs and dairy
  ['Egg', 'eggs, itlog, boiled egg, hard boiled egg, soft boiled egg, nilagang itlog, raw egg', 143, 12.6, 0.7, 9.5, { piece: 50, small: 38, medium: 44, large: 50, xl: 56 }],
  ['Fried egg', 'fried eggs, sunny side up, pritong itlog, over easy', 196, 13.6, 0.8, 15, { piece: 46, small: 40, medium: 46, large: 52, xl: 58 }],
  ['Scrambled egg', 'scrambled eggs, scrambled', 149, 10, 1.6, 11, { piece: 55, small: 47, medium: 55, large: 61, xl: 68, cup: 220 }],
  ['Omelette', 'omelet, omelettes, tortang itlog', 154, 10.6, 0.6, 12, { piece: 120, serving: 120 }],
  ['Egg white', 'egg whites', 52, 10.9, 0.7, 0.2, { piece: 33, large: 33, cup: 243 }],
  ['Whole milk', 'milk, fresh milk, gatas, full cream milk', 61, 3.2, 4.8, 3.3, { cup: 244, glass: 250, mug: 300, serving: 244, tbsp: 15 }, 1.03],
  ['Low-fat milk', 'low fat milk, 2% milk, reduced fat milk', 50, 3.3, 4.8, 2, { cup: 244, glass: 250, serving: 244 }, 1.03],
  ['Skim milk', 'nonfat milk, non fat milk, fat free milk', 34, 3.4, 5, 0.1, { cup: 245, glass: 250, serving: 245 }, 1.03],
  ['Almond milk', 'almond milk unsweetened', 15, 0.6, 0.6, 1.1, { cup: 240, glass: 250 }],
  ['Soy milk', 'soymilk', 54, 3.3, 6, 1.8, { cup: 243, glass: 250 }],
  ['Greek yogurt', 'greek yoghurt, nonfat greek yogurt', 59, 10.3, 3.6, 0.4, { cup: 245, serving: 170, piece: 170, tbsp: 15 }],
  ['Yogurt', 'yoghurt, plain yogurt', 61, 3.5, 4.7, 3.3, { cup: 245, serving: 170, piece: 125 }],
  ['Cheddar cheese', 'cheddar, cheese, keso', 403, 24.9, 1.3, 33.1, { slice: 21, cup: 113, tbsp: 7, piece: 28, serving: 28 }],
  ['Cheese slice', 'sliced cheese, processed cheese, american cheese, quickmelt, eden cheese', 312, 18, 7, 24, { slice: 21, piece: 21 }],
  ['Mozzarella', 'mozzarella cheese', 280, 28, 3, 17, { cup: 112, slice: 28, serving: 28 }],
  ['Cottage cheese', '', 98, 11, 3.4, 4.3, { cup: 226, serving: 113 }],
  ['Cream cheese', '', 342, 6, 4, 34, { tbsp: 14.5, serving: 28 }],
  ['Butter', 'margarine', 717, 0.9, 0.1, 81, { tbsp: 14, tsp: 4.7, piece: 5, slice: 10, serving: 10 }],
  ['Condensed milk', 'sweetened condensed milk', 321, 7.9, 54, 8.7, { tbsp: 19, tsp: 6.5, can: 300 }],
  ['Evaporated milk', 'evap', 134, 6.8, 10, 7.6, { tbsp: 15, cup: 252, can: 370 }],
  ['Coffee creamer', 'creamer, coffee mate, coffeemate', 545, 4.8, 55, 35, { tsp: 2, tbsp: 6, piece: 6 }],
  ['Heavy cream', 'cream, whipping cream, all purpose cream', 340, 2.8, 2.7, 36, { tbsp: 15, cup: 238 }],
  ['Ice cream', 'icecream, sorbetes', 207, 3.5, 24, 11, { cup: 132, scoop: 66, serving: 66 }],

  // grains, bread, starch
  ['White rice', 'rice, kanin, steamed rice, jasmine rice, plain rice, cooked rice, puting kanin', 130, 2.7, 28, 0.3, { cup: 158, bowl: 200, plate: 200, serving: 158 }],
  ['Brown rice', 'brown rice cooked', 123, 2.7, 25.6, 1, { cup: 195, serving: 195 }],
  ['Garlic fried rice', 'fried rice, sinangag, garlic rice', 174, 3.5, 27, 5.7, { cup: 140, serving: 160, plate: 250 }],
  ['Rolled oats', 'oats, oatmeal dry, quick oats, instant oats, rolled oat', 379, 13, 68, 6.5, { cup: 81, tbsp: 5, serving: 40, pack: 30 }],
  ['Oatmeal (cooked)', 'cooked oatmeal, porridge, oatmeal', 71, 2.5, 12, 1.5, { cup: 234, bowl: 234, serving: 234 }],
  ['White bread', 'bread, loaf bread, tasty, sliced bread, toast, gardenia', 265, 9, 49, 3.2, { slice: 28, piece: 28 }],
  ['Whole wheat bread', 'wheat bread, whole grain bread, brown bread', 247, 13, 41, 3.4, { slice: 32, piece: 32 }],
  ['Pandesal', 'pan de sal, pandesals', 293, 8.5, 52, 5.5, { piece: 30, small: 22, medium: 30, large: 40 }],
  ['Ensaymada', 'ensaimada', 380, 7, 45, 19, { piece: 70 }],
  ['Bagel', 'bagels', 257, 10, 50, 1.6, { piece: 105 }],
  ['Flour tortilla', 'tortilla, wrap', 312, 8, 52, 8, { piece: 45 }],
  ['Pasta (cooked)', 'pasta, macaroni, penne, noodles cooked', 158, 5.8, 31, 0.9, { cup: 140, plate: 250, serving: 200 }],
  ['Spaghetti', 'filipino spaghetti, spaghetti with meat sauce, jolly spaghetti', 160, 6, 22, 5.5, { cup: 250, serving: 250, plate: 300 }],
  ['Pancit canton (instant)', 'lucky me pancit canton, instant pancit canton', 470, 9, 60, 21, { pack: 80, piece: 80 }],
  ['Instant noodles', 'ramen, cup noodles, nissin, instant noodle, lucky me noodles', 440, 9, 62, 17, { pack: 70, piece: 70, cup: 70 }],
  ['Pancit', 'pancit bihon, pancit guisado, bihon, sotanghon guisado', 150, 7, 22, 4, { cup: 150, serving: 200, plate: 300 }],
  ['Corn flakes', 'cornflakes, cereal', 357, 7.5, 84, 0.4, { cup: 28, serving: 30 }],
  ['Granola', '', 471, 10, 64, 20, { cup: 122, serving: 50, tbsp: 8 }],
  ['Pancake', 'pancakes, hotcake, hotcakes', 227, 6.4, 28, 9.7, { piece: 75, small: 40, medium: 75, large: 100 }],
  ['Waffle', 'waffles', 291, 7.9, 33, 14, { piece: 75 }],
  ['Crackers', 'skyflakes, sky flakes, biscuit, biscuits, cracker', 430, 9, 70, 13, { piece: 8, pack: 25 }],
  ['Potato (boiled)', 'potato, potatoes, boiled potato, patatas', 87, 1.9, 20, 0.1, { piece: 213, small: 150, medium: 213, large: 300, cup: 156 }],
  ['Mashed potato', 'mashed potatoes', 113, 2, 17, 4.2, { cup: 210, serving: 150 }],
  ['French fries', 'fries, chips fries', 312, 3.4, 41, 15, { serving: 117, small: 71, medium: 117, large: 154, cup: 50 }],
  ['Sweet potato', 'kamote, camote, boiled sweet potato', 86, 1.6, 20, 0.1, { piece: 130, small: 60, medium: 130, large: 180, cup: 200 }],
  ['Corn', 'corn on the cob, mais, sweet corn', 96, 3.4, 21, 1.5, { piece: 100, cup: 145 }],

  // meat, fish, protein
  ['Chicken breast', 'chicken breast cooked, grilled chicken breast, chicken breast fillet, chicken', 165, 31, 0, 3.6, { piece: 172, serving: 100, cup: 140 }],
  ['Chicken thigh', 'chicken thigh cooked, chicken leg', 209, 26, 0, 10.9, { piece: 100, serving: 100 }],
  ['Fried chicken', 'chickenjoy, fried chicken leg, fried chicken thigh, pritong manok', 260, 22, 9, 15, { piece: 120, small: 75, medium: 120, large: 160 }],
  ['Chicken adobo', 'adobo, adobong manok, adobo chicken', 200, 19, 3, 12, { serving: 150, cup: 150, piece: 90 }],
  ['Pork adobo', 'adobong baboy, adobo pork', 280, 18, 4, 21, { serving: 150, cup: 150, piece: 60 }],
  ['Tinola', 'chicken tinola, tinolang manok', 55, 6, 2, 2.5, { bowl: 400, cup: 240, serving: 350 }],
  ['Ground beef', 'beef mince, minced beef, giniling', 250, 26, 0, 15, { cup: 135, serving: 100 }],
  ['Beef steak', 'steak, beef, sirloin, ribeye, bistek', 250, 26, 0, 15, { piece: 225, serving: 150 }],
  ['Beef tapa', 'tapa, tapsilog meat', 230, 24, 6, 12, { serving: 100, piece: 25 }],
  ['Pork chop', 'porkchop, pork chops', 231, 26, 0, 13, { piece: 150 }],
  ['Lechon kawali', 'crispy pork belly, lechon, bagnet', 550, 15, 0, 54, { serving: 100, piece: 30 }],
  ['Grilled pork belly', 'liempo, inihaw na liempo, pork belly', 450, 20, 0, 41, { serving: 120, piece: 120 }],
  ['Pork barbecue', 'bbq, barbecue, pork bbq, barbeque', 230, 18, 12, 12, { piece: 60, serving: 120 }],
  ['Longganisa', 'longanisa, longganiza, longsilog meat', 360, 15, 12, 28, { piece: 40 }],
  ['Tocino', 'pork tocino, chicken tocino', 300, 18, 20, 16, { serving: 100, piece: 25 }],
  ['Hotdog', 'hot dog, hotdogs, sausage, frankfurter', 290, 10, 4, 26, { piece: 45, small: 30, large: 70 }],
  ['Bacon', 'bacon strip, bacon strips', 541, 37, 1.4, 42, { piece: 8, slice: 8 }],
  ['Ham', 'sliced ham', 145, 21, 1.5, 5.5, { slice: 28, piece: 28 }],
  ['Luncheon meat', 'spam, maling, luncheon', 315, 13, 3, 27, { slice: 56, piece: 56, can: 340 }],
  ['Corned beef', 'canned corned beef, corned beef hash', 250, 27, 0.5, 15, { can: 150, serving: 75, cup: 220, tbsp: 15 }],
  ['Tuna (canned in water)', 'tuna, canned tuna, tuna flakes', 116, 26, 0, 0.8, { can: 120, cup: 154, serving: 85, tbsp: 15 }],
  ['Tuna (canned in oil)', 'tuna in oil', 198, 29, 0, 8, { can: 120, serving: 85 }],
  ['Sardines', 'sardines in tomato sauce, sardinas, canned sardines', 186, 18, 1.5, 12, { can: 155, piece: 25 }],
  ['Salmon', 'salmon fillet, grilled salmon', 206, 22, 0, 12, { piece: 154, serving: 150 }],
  ['Tilapia', 'tilapia fillet, fried tilapia, pritong tilapia', 170, 25, 1, 7, { piece: 120, serving: 120 }],
  ['Bangus', 'milkfish, daing na bangus, fried bangus', 250, 23, 0, 17, { serving: 150, piece: 150 }],
  ['Fried fish', 'fish, pritong isda, isda', 200, 22, 3, 11, { piece: 100, serving: 120 }],
  ['Shrimp', 'prawns, hipon, shrimps', 99, 24, 0.2, 0.3, { piece: 6, cup: 145, serving: 85 }],
  ['Tofu', 'tokwa, firm tofu, bean curd', 144, 17, 3, 8.7, { cup: 252, piece: 80, serving: 100 }],
  ['Fried tofu', 'pritong tokwa, tokwa fried', 271, 17, 10, 20, { piece: 80, serving: 100 }],
  ['Whey protein', 'whey, protein powder, protein shake powder, whey protein powder', 400, 80, 8, 6, { scoop: 30, serving: 30, tbsp: 8 }],
  ['Peanut butter', 'pb, peanutbutter', 588, 25, 20, 50, { tbsp: 16, tsp: 5.3, serving: 32 }],
  ['Black beans', 'beans, black beans cooked', 132, 8.9, 23.7, 0.5, { cup: 172, serving: 130 }],
  ['Ginisang monggo', 'monggo, munggo, mung beans, mung bean soup', 110, 7, 15, 2.5, { cup: 200, bowl: 300, serving: 250 }],

  // filipino dishes and snacks
  ['Tapsilog', 'tapa silog', 195, 11.5, 15.5, 9.5, { serving: 306, plate: 306, piece: 306 }],
  ['Tocilog', 'tocino silog', 218, 9.6, 21, 11, { serving: 306, plate: 306, piece: 306 }],
  ['Longsilog', 'longganisa silog', 245, 8, 19, 15, { serving: 326, plate: 326, piece: 326 }],
  ['Sinigang', 'sinigang na baboy, pork sinigang, sinigang na hipon, sinigang soup', 60, 5, 3, 3, { bowl: 400, cup: 240, serving: 350 }],
  ['Nilaga', 'nilagang baka, nilagang baboy, beef nilaga', 70, 6, 4, 3.5, { bowl: 400, cup: 240, serving: 350 }],
  ['Bulalo', '', 90, 7, 3, 5.5, { bowl: 400, cup: 240, serving: 350 }],
  ['Kare-kare', 'kare kare, karekare', 180, 11, 6, 12.5, { serving: 200, cup: 200 }],
  ['Sisig', 'pork sisig', 300, 18, 4, 24, { serving: 150, cup: 150 }],
  ['Menudo', '', 160, 11, 7, 10, { serving: 150, cup: 150 }],
  ['Caldereta', 'kaldereta, beef caldereta', 180, 13, 6, 11, { serving: 150, cup: 150 }],
  ['Afritada', 'chicken afritada, pork afritada', 140, 12, 6, 7.5, { serving: 150, cup: 150 }],
  ['Chop suey', 'chopsuey, stir fry vegetables', 70, 4, 7, 3, { cup: 220, serving: 200 }],
  ['Pinakbet', 'pakbet', 70, 3, 7, 3.5, { cup: 200, serving: 200 }],
  ['Lumpia shanghai', 'lumpiang shanghai, shanghai, spring roll, spring rolls', 300, 12, 22, 18, { piece: 20 }],
  ['Fresh lumpia', 'lumpiang sariwa', 120, 4, 15, 5, { piece: 150 }],
  ['Lugaw', 'congee, goto, rice porridge', 70, 2.5, 12, 1.5, { bowl: 350, cup: 240, serving: 350 }],
  ['Champorado', '', 120, 2.5, 24, 2, { bowl: 300, cup: 240, serving: 300 }],
  ['Turon', 'banana lumpia', 260, 2, 40, 11, { piece: 80 }],
  ['Banana cue', 'bananacue, banana q', 220, 1, 45, 5, { piece: 100 }],
  ['Puto', '', 230, 4, 48, 2, { piece: 40 }],
  ['Halo-halo', 'halo halo, halohalo', 140, 3, 25, 3.5, { cup: 240, glass: 300, serving: 350 }],
  ['Taho', '', 75, 4, 12, 1.5, { cup: 240, serving: 240 }],
  ['Siopao', 'siopao asado, bola bola siopao', 245, 9, 38, 6, { piece: 120 }],
  ['Siomai', 'shumai, dumpling, dumplings', 220, 12, 14, 13, { piece: 25 }],

  // fast food and treats
  ['Hamburger', 'burger, yumburger, hamburgers', 254, 12.4, 28.6, 9.6, { piece: 110, small: 100, large: 220 }],
  ['Cheeseburger', 'cheese burger', 263, 14, 28, 11, { piece: 120, large: 230 }],
  ['Pizza', 'pizza slice, pepperoni pizza, cheese pizza', 266, 11, 33, 10, { slice: 107, piece: 107 }],
  ['Sandwich', 'ham sandwich, chicken sandwich', 240, 11, 28, 9, { piece: 150 }],
  ['Potato chips', 'chips, crisps, piattos, nova, lays', 536, 7, 53, 35, { pack: 28, handful: 15, serving: 28, cup: 20 }],
  ['Chocolate chip cookie', 'cookie, cookies, choco chip cookie', 488, 5, 64, 24, { piece: 16, large: 40 }],
  ['Donut', 'doughnut, donuts, glazed donut', 421, 5, 50, 22, { piece: 60 }],
  ['Chocolate cake', 'cake, slice of cake', 371, 5, 53, 16, { slice: 95, piece: 95 }],
  ['Dark chocolate', 'chocolate, chocolate bar', 546, 4.9, 61, 31, { piece: 10, slice: 10, pack: 43 }],
  ['Protein bar', '', 360, 30, 40, 10, { piece: 60 }],

  // fruit
  ['Banana', 'bananas, saging, lakatan', 89, 1.1, 23, 0.3, { piece: 118, small: 101, medium: 118, large: 136 }],
  ['Saba banana', 'saba, nilagang saging', 122, 1.3, 31, 0.2, { piece: 85 }],
  ['Apple', 'apples, mansanas', 52, 0.3, 14, 0.2, { piece: 182, small: 149, medium: 182, large: 223, slice: 15 }],
  ['Orange', 'oranges, dalandan', 47, 0.9, 12, 0.1, { piece: 131, small: 96, large: 184 }],
  ['Mango', 'mangga, ripe mango, mangoes', 60, 0.8, 15, 0.4, { piece: 200, small: 150, large: 300, cup: 165, slice: 40 }],
  ['Papaya', 'papaya slices', 43, 0.5, 11, 0.3, { cup: 145, slice: 150, piece: 300 }],
  ['Pineapple', 'pinya', 50, 0.5, 13, 0.1, { cup: 165, slice: 84 }],
  ['Watermelon', 'pakwan', 30, 0.6, 7.6, 0.2, { cup: 152, slice: 286 }],
  ['Grapes', 'ubas', 69, 0.7, 18, 0.2, { cup: 151, piece: 5, handful: 75 }],
  ['Strawberries', 'strawberry', 32, 0.7, 7.7, 0.3, { cup: 152, piece: 12, handful: 75 }],
  ['Blueberries', 'blueberry, berries', 57, 0.7, 14.5, 0.3, { cup: 148, handful: 70 }],
  ['Avocado', 'abukado, avocados', 160, 2, 8.5, 14.7, { piece: 150, slice: 25, cup: 150 }],

  // vegetables
  ['Broccoli', '', 34, 2.8, 7, 0.4, { cup: 91, serving: 85 }],
  ['Spinach', 'kangkong, malunggay', 23, 2.9, 3.6, 0.4, { cup: 30 }],
  ['Lettuce', 'salad, green salad, salad greens, garden salad', 15, 1.4, 2.9, 0.2, { cup: 47, bowl: 100, serving: 85 }],
  ['Tomato', 'tomatoes, kamatis', 18, 0.9, 3.9, 0.2, { piece: 123, slice: 20, cup: 180 }],
  ['Cucumber', 'pipino', 15, 0.7, 3.6, 0.1, { piece: 300, slice: 7, cup: 104 }],
  ['Carrot', 'carrots', 41, 0.9, 9.6, 0.2, { piece: 61, cup: 128 }],
  ['Mixed vegetables', 'vegetables, veggies, gulay, mixed veggies', 65, 2.6, 13, 0.2, { cup: 180, serving: 90 }],

  // drinks
  ['Coffee (black)', 'coffee, black coffee, kape, americano, brewed coffee, espresso', 2, 0.3, 0, 0, { cup: 240, mug: 300, glass: 250, serving: 240 }],
  ['3-in-1 coffee', 'threeinone, threeinone coffee, three in one coffee, nescafe original, kopiko', 450, 3, 80, 14, { pack: 20, piece: 20, cup: 20, mug: 20 }],
  ['Latte', 'cafe latte, cappuccino, flat white', 56, 3, 4.5, 2.9, { cup: 240, mug: 300, small: 355, medium: 470, large: 590 }],
  ['Tea (unsweetened)', 'tea, green tea, black tea, tsaa', 1, 0, 0.3, 0, { cup: 240, mug: 300, glass: 250 }],
  ['Milk tea', 'boba, bubble tea, milktea, pearl milk tea', 75, 0.5, 15, 1.5, { cup: 500, glass: 500, small: 400, medium: 500, large: 700, serving: 500 }],
  ['Orange juice', 'juice, oj', 45, 0.7, 10.4, 0.2, { cup: 248, glass: 250 }],
  ['Soda', 'coke, cola, softdrinks, soft drinks, sprite, royal, pepsi, soft drink', 42, 0, 10.6, 0, { can: 330, serving: 330, glass: 250, bottle: 500, cup: 240 }],
  ['Beer', 'san miguel, red horse, pale pilsen', 43, 0.5, 3.6, 0, { can: 330, bottle: 330, glass: 250 }],
  ['Wine', 'red wine, white wine', 85, 0.1, 2.6, 0, { glass: 150 }],
  ['Chocolate malt drink powder', 'milo, ovaltine, chocolate powder', 410, 8.5, 72, 9, { tbsp: 7, pack: 22, serving: 22 }],

  // condiments and add-ons
  ['Sugar', 'white sugar, brown sugar, asukal', 387, 0, 100, 0, { tsp: 4.2, tbsp: 12.5, cup: 200, piece: 4 }],
  ['Honey', 'pulot', 304, 0.3, 82, 0, { tbsp: 21, tsp: 7 }],
  ['Cooking oil', 'oil, olive oil, vegetable oil, mantika', 884, 0, 0, 100, { tbsp: 13.5, tsp: 4.5 }],
  ['Mayonnaise', 'mayo', 680, 1, 0.6, 75, { tbsp: 14, tsp: 5 }],
  ['Ketchup', 'catsup, banana ketchup', 101, 1, 27, 0.1, { tbsp: 17, tsp: 6 }],
  ['Soy sauce', 'toyo', 53, 8, 4.9, 0.6, { tbsp: 16, tsp: 5 }],
  ['Jam', 'jelly, fruit jam', 278, 0.4, 69, 0.1, { tbsp: 20, tsp: 7 }],
  ['Nutella', 'chocolate spread, hazelnut spread', 539, 6.3, 57.5, 31, { tbsp: 18.5, tsp: 6 }],
  ['Almonds', 'almond', 579, 21, 22, 50, { piece: 1.2, handful: 28, cup: 143, serving: 28 }],
  ['Peanuts', 'mani, peanut, roasted peanuts', 567, 26, 16, 49, { handful: 28, cup: 146, tbsp: 9, serving: 28 }],
]

export const FOODS: BuiltinFood[] = [...ROWS, ...MORE_ROWS].map(([name, aliases, kcal, protein, carbs, fat, u, d]) => ({
  name, kcal, protein, carbs, fat, u, d,
  aliases: [name.toLowerCase().replace(/[()]/g, ''), ...aliases.split(',').map((a) => a.trim()).filter(Boolean)],
}))
