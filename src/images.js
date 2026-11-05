// ═══════════════════════════════════════════════════════
// IMAGES — รูปจริงประกอบคำศัพท์ ดึงจากรูปหลักของบทความ Wikipedia (REST summary API, CORS เปิด)
// key = "หมวด|คำ" → ชื่อบทความ Wikipedia ที่สื่อถึงคำนั้นตรงที่สุด · ไม่มีในนี้ = ใช้อีโมจิ
// (สี ตัวเลข ความรู้สึก ครอบครัว รูปทรง ใช้อีโมจิ เพราะสื่อชัดกว่ารูปถ่าย)
// รูปโหลดครั้งแรกจะถูก service worker แคชไว้ → เล่นออฟไลน์ก็ยังเห็น
// ═══════════════════════════════════════════════════════
import manifest from "./imgManifest.json";
const T = {};
const add = (cat, rows) => rows.forEach(([w, title]) => { T[`${cat}|${w}`] = title; });

add("animals", [
  ["CAT","Cat"],["DOG","Dog"],["FISH","Goldfish"],["BIRD","Bird"],["COW","Cattle"],["PIG","Pig"],["FROG","Frog"],["DUCK","Duck"],
  ["LION","Lion"],["BEAR","Brown bear"],["RABBIT","Rabbit"],["HORSE","Horse"],["SHEEP","Sheep"],["MONKEY","Monkey"],["ELEPHANT","Asian elephant"],
  ["TIGER","Tiger"],["PANDA","Giant panda"],["DOLPHIN","Dolphin"],["SHARK","Great white shark"],["WHALE","Humpback whale"],["OCTOPUS","Octopus"],
  ["CRAB","Crab"],["OWL","Owl"],["SNAKE","Snake"],["TURTLE","Green sea turtle"],["BUTTERFLY","Butterfly"],["BEE","Honey bee"],["MOUSE","House mouse"],
  ["PENGUIN","Emperor penguin"],["FOX","Red fox"],["GIRAFFE","Giraffe"],["ZEBRA","Zebra"],["CHICKEN","Chicken"],["GOAT","Goat"],["DEER","Red deer"],
  ["CROCODILE","Crocodile"],["KANGAROO","Kangaroo"],["ANT","Ant"],["SPIDER","Spider"]]);
add("fruits", [
  ["APPLE","Apple"],["BANANA","Banana"],["ORANGE","Orange (fruit)"],["GRAPE","Grape"],["LEMON","Lemon"],["MANGO","Mango"],["CHERRY","Cherry"],
  ["STRAWBERRY","Strawberry"],["WATERMELON","Watermelon"],["PINEAPPLE","Pineapple"],["KIWI","Actinidia deliciosa"],["BLUEBERRY","Blueberry"],
  ["COCONUT","Coconut water"],["PEAR","Pear"],["MELON","Cantaloupe"],["AVOCADO","Avocado"],["GUAVA","Guava"],["DURIAN","Durian"],
  ["LYCHEE","Lychee"],["RAMBUTAN","Rambutan"],["POMELO","Pomelo"],["JACKFRUIT","Jackfruit"]]);
add("food", [
  ["RICE","Cooked rice"],["BREAD","Bread"],["EGG","Fried egg"],["MILK","Milk"],["PIZZA","Pizza"],["CAKE","Birthday cake"],["CARROT","Carrot"],
  ["CORN","Sweet corn"],["NOODLES","Instant noodle"],["SOUP","Chicken soup"],["SALAD","Salad"],["SANDWICH","Sandwich"],["HAMBURGER","Hamburger"],["SUSHI","Sushi"],
  ["ICECREAM","Ice cream"],["COOKIE","Chocolate chip cookie"],["DONUT","Doughnut"],["CHOCOLATE","Chocolate"],["CHEESE","Cheese"],["CANDY","Candy"],
  ["HOTDOG","Hot dog"],["TACO","Taco"],["PASTA","Spaghetti"],["MUSHROOM","Edible mushroom"],["TOMATO","Tomato"],["POTATO","Potato"],
  ["BROCCOLI","Broccoli"],["HONEY","Honey"],["COFFEE","Coffee"],["TEA","Tea"],["JUICE","Orange juice"],["WATER","Drinking water"],
  ["CURRY","Green curry"],["PANCAKE","Pancake"],["RAMEN","Ramen"],["FRIED RICE","Fried rice"],["PAD THAI","Pad thai"],["SOM TAM","Som tam"],
  ["FRENCH FRIES","French fries"],["FRIED CHICKEN","Fried chicken"],["YOGURT","Yogurt"],["BUTTER","Butter"],["SUGAR","Sugar"],["SALT","Salt"],["FISH SAUCE","Fish sauce"]]);
add("school", [
  ["PEN","Ballpoint pen"],["BOOK","Book"],["BAG","Backpack"],["PENCIL","Pencil"],["RULER","Ruler"],["SCISSORS","Scissors"],["NOTEBOOK","Notebook"],
  ["COMPUTER","Laptop"],["CALCULATOR","Calculator"],["GLOBE","Globe"],["CRAYON","Crayon"],["ERASER","Eraser"],["DESK","Desk"],["CHAIR","Chair"],
  ["CLASSROOM","Classroom"],["STUDENT","Student"],["HOMEWORK","Homework"],["MAP","Map"],["PAINT","Paint"]]);
add("body", [
  ["EYE","Human eye"],["EAR","Ear"],["HAND","Hand"],["FOOT","Foot"],["MOUTH","Human mouth"],["TOOTH","Human tooth"],["ARM","Arm"],["TONGUE","Tongue"],["BRAIN","Human brain"],["HEART","Heart"],["BONE","Bone"],
  ["SHOULDER","Shoulder"]]);
add("weather", [
  ["SUN","Sunrise"],["RAIN","Rain"],["SNOW","Snow"],["CLOUD","Cumulus cloud"],["WIND","Wind"],["STORM","Thunderstorm"],["RAINBOW","Rainbow"],["FOG","Mist"],
  ["SNOW","Snow"],["THUNDER","Lightning"],["DRY","Drought"],["COLD","Winter"]]);
add("vehicles", [
  ["CAR","Car"],["BUS","Bus"],["TRAIN","Train"],["PLANE","Airliner"],["BOAT","Boat"],["BIKE","Bicycle"],["TRUCK","Truck"],["TAXI","Taxicab"],
  ["HELICOPTER","Helicopter"],["SHIP","Cruise ship"],["MOTORCYCLE","Motorcycle"],["TRACTOR","Tractor"],["AMBULANCE","Ambulance"],["FIRETRUCK","Fire engine"],
  ["POLICE CAR","Police car"],["ROCKET","Rocket"],["SUBMARINE","Submarine"],["VAN","Van"],["SCOOTER","Motor scooter"],["TUK-TUK","Auto rickshaw"]]);
add("jobs", [
  ["DOCTOR","Pediatrics"],["NURSE","Nursing"],["FARMER","Farmer"],["COOK","Cooking"],["PILOT","Aircraft pilot"],
  ["POLICE","Police officer"],["FIREFIGHTER","Firefighter"],["SINGER","Singing"],
  ["SOLDIER","Soldier"],["WAITER","Waiting staff"],["DRIVER","Bus driver"],["BUILDER","Construction worker"],
  ["DENTIST","Dentist"],["BAKER","Baker"],["CHEF","Chef's uniform"]]);
add("clothes", [
  ["SHIRT","Dress shirt"],["TSHIRT","T-shirt"],["PANTS","Jeans"],["DRESS","Dress"],["SHOES","Sneakers"],["SOCKS","Sock"],["HAT","Sun hat"],
  ["GLASSES","Glasses"],["SCARF","Scarf"],["GLOVES","Glove"],["JACKET","Jacket"],["BOOTS","Boot"],["SANDALS","Sandal"],
  ["UMBRELLA","Umbrella"],["BELT","Belt (clothing)"],["TIE","Necktie"],["UNIFORM","School uniforms in Thailand"]]);
add("home", [
  ["BED","Bedroom"],["CHAIR","Chair"],["TABLE","Dining room"],["WINDOW","Window"],["PHONE","Smartphone"],
  ["CLOCK","Alarm clock"],["LAMP","Lampshade"],["SOFA","Couch"],["MIRROR","Mirror"],["BATH","Bathtub"],["FRIDGE","Refrigerator"],["STOVE","Kitchen stove"],
  ["SINK","Sink"],["TOILET","Flush toilet"],["BOOKSHELF","Bookcase"],["COMPUTER","Personal computer"],["KITCHEN","Kitchen"],
  ["TOOTHBRUSH","Toothbrush"],["TOWEL","Towel"],["SOAP","Soap"],["PILLOW","Pillow"],["BLANKET","Quilt"],["KEY","Key (lock)"],["CUP","Mug"],
  ["PLATE","Tableware"],["SPOON","Spoon"],["FORK","Fork"]]);
add("nature", [
  ["TREE","Tree"],["FLOWER","Flower"],["MOUNTAIN","Mountain"],["RIVER","River"],["OCEAN","Wind wave"],["GRASS","Grass"],["LEAF","Leaf"],["ROCK","Pebble"],
  ["MOON","Moon"],["STAR","Night sky"],["SUN","Sunset"],["CLOUD","Cumulus cloud"],["LAKE","Lake"],["FOREST","Forest"],["DESERT","Desert"],["ISLAND","Phi Phi Islands"],
  ["CAVE","Cave"],["WATERFALL","Waterfall"],["VOLCANO","Volcano"],["RAINBOW","Rainbow"],["FIRE","Fire"]]);
add("sports", [
  ["FOOTBALL","Association football"],["BASKETBALL","Basketball"],["TENNIS","Tennis"],["SWIMMING","Swimming (sport)"],["RUNNING","Running"],
  ["CYCLING","Cycling"],["BOXING","Muay Thai"],["GOLF","Golf"],["VOLLEYBALL","Volleyball"],["BASEBALL","Baseball"],["BADMINTON","Badminton"],
  ["SKATEBOARD","Skateboarding"],["SKIING","Ski"],["SURFING","Surfing"],["YOGA","Yoga as exercise"],["TABLE TENNIS","Table tennis"],["DANCING","Dance"],
  ["TROPHY","Trophy"],["JUMP","Long jump"]]);
add("actions", [
  ["RUN","Running"],["WALK","Pedestrian"],["EAT","Lunch"],["DRINK","Drink"],
  ["SING","Singing"],["DANCE","Dance"],["SWIM","Swimming"],["PLAY","Toy"],["COOK","Cooking"],["WASH","Hand washing"],["DRAW","Colored pencil"],
  ["LAUGH","Laughter"],["CRY","Crying"],["CLIMB","Rock climbing"]]);
add("toys", [
  ["BALL","Ball"],["DOLL","Rag doll"],["KITE","Kite"],["ROBOT","Robot"],["PUZZLE","Jigsaw puzzle"],["BLOCKS","Toy block"],["TEDDY BEAR","Teddy bear"],
  ["BALLOON","Toy balloon"],["DRUM","Snare drum"],["GUITAR","Guitar"],["PIANO","Piano"],["YO-YO","Yo-yo"]]);
add("places", [
  ["SCHOOL","School"],["HOSPITAL","Hospital"],["MARKET","Floating market"],["TEMPLE","Wat"],["PARK","Park"],["ZOO","Zoo"],["BEACH","Beach"],["FARM","Farm"],
  ["RESTAURANT","Restaurant"],["BANK","Bank"],["AIRPORT","Airport terminal"],["LIBRARY","Library"],["SUPERMARKET","Supermarket"],["PLAYGROUND","Playground"]]);

// ── ชุดขยาย v2.1 ──
add("colors", [["GOLD","Gold"],["SILVER","Silver"]]);
add("fruits", [["DRAGON FRUIT","Pitaya"],["TAMARIND","Tamarind"],["PLUM","Plum"],["STAR FRUIT","Carambola"]]);
add("school", [["BLACKBOARD","Blackboard"],["MARKER","Marker pen"],["GLUE","Glue stick"],["PAPER","Notepad"],["PAINTBRUSH","Paintbrush"],["SCHOOL BUS","School bus"],["LUNCH BOX","Lunch box"],["FLAG","Flag of Thailand"],["TAPE","Adhesive tape"]]);
add("body", [["KNEE","Knee"],["ELBOW","Elbow"],["LIPS","Lip"],["EYEBROW","Eyebrow"],["TOE","Toe"],["THUMB","Thumb"],["WRIST","Wrist"]]);
add("weather", [["CLOUDY","Overcast"],["WINDY","Wind"],["RAINY","Rain"],["FLOOD","2011 Thailand floods"],["ICE","Ice"],["SUMMER","Summer"],["WINTER","Winter"],["SPRING","Spring (season)"],["AUTUMN","Autumn"],["SNOWMAN","Snowman"]]);
add("vehicles", [["SPACESHIP","Space Shuttle"],["SAILBOAT","Dinghy sailing"],["FERRY","Ferry"],["PICKUP TRUCK","Pickup truck"],["GARBAGE TRUCK","Garbage truck"],["CRANE","Mobile crane"],["HOT AIR BALLOON","Hot air balloon"],["TRAM","Tram"],["SPEEDBOAT","Motorboat"],["SKYTRAIN","BTS Skytrain"]]);
add("jobs", [["VET","Veterinarian"],["FISHERMAN","Fisherman"],["MECHANIC","Auto mechanic"],["HAIRDRESSER","Hairdresser"],["DANCER","Dancer"],["FOOTBALL PLAYER","Association football"],["SHOPKEEPER","Shopkeeper"],["ASTRONAUT","Astronaut"],["MONK","Bhikkhu"]]);
add("clothes", [["SHORTS","Bermuda shorts"],["SWEATER","Sweater"],["RAINCOAT","Raincoat"],["CAP","Baseball cap"],["SLIPPERS","Slipper"],["APRON","Apron"],["MASK","Surgical mask"],["WATCH","Wristwatch"],["NECKLACE","Necklace"]]);
add("nature", [["SAND","Sand"],["WAVE","Wind wave"],["HILL","Hill"],["FIELD","Paddy field"],["POND","Pond"],["SEED","Seed"],["CACTUS","Saguaro"],["BAMBOO","Bamboo"]]);
add("sports", [["TAEKWONDO","Taekwondo"],["ICE SKATING","Figure skating"],["FISHING","Fishing"],["HIKING","Hiking"],["BOWLING","Ten-pin bowling"],["CHESS","Chess"],["HORSE RIDING","Equestrianism"],["RUGBY","Rugby union"],["JUMP ROPE","Skipping rope"]]);
add("family", []);
add("actions", [["HUG","Hug"],["SMILE","Smile"],["CLAP","Applause"],["THROW","Javelin throw"]]);
add("feelings", [["BRAVE","Firefighter"]]);
add("shapes", []);
add("toys", [["TOY CAR","Model car"],["BUBBLES","Soap bubble"],["SWING","Swing (seat)"],["ROCKING HORSE","Rocking horse"],["PUPPET","Puppet"],["DICE","Dice"],["BOARD GAME","Board game"],["MARBLES","Marble (toy)"]]);
add("places", [["CINEMA","Movie theater"],["POST OFFICE","Post office"],["POLICE STATION","Police station"],["FIRE STATION","Fire station"],["PHARMACY","Pharmacy"],["GAS STATION","Filling station"],["BUS STOP","Bus stop"],["TRAIN STATION","Train station"],["SWIMMING POOL","Swimming pool"],["SHOPPING MALL","Shopping mall"],["CAFE","Coffeehouse"],["BAKERY","Bakery"]]);

// ── รูปปกหมวด (ภาพรวมของหมวด) key = cover|<catId> ──
add("cover", [
  ["animals","Wildlife"],["fruits","Fruit"],["food","Food"],["colors","Color"],["school","Classroom"],["body","Face"],["weather","Weather"],
  ["vehicles","Vehicle"],["clothes","Fashion"],["home","Living room"],["nature","Nature"],["sports","Sport"],
  ["family","Parenting"],["actions","Playground"],["feelings","Smile"],["toys","Toy"],["places","City"]]);

// ── ชุดขยายใหญ่ v2.2 ──
add("animals", [["WOLF","Wolf"],["CAMEL","Dromedary"],["HIPPO","Hippopotamus"],["RHINO","Rhinoceros"],["GORILLA","Gorilla"],["LEOPARD","Leopard"],["CHEETAH","Cheetah"],["BUFFALO","Water buffalo"],["DONKEY","Donkey"],["SQUIRREL","Eastern gray squirrel"],["BAT","Bat"],["HEDGEHOG","Hedgehog"],["KOALA","Koala"],["SLOTH","Sloth"],["RACCOON","Raccoon"],["OTTER","Otter"],["SEAL","Harbor seal"],["WALRUS","Walrus"],["POLAR BEAR","Polar bear"],["REINDEER","Reindeer"],["MOOSE","Moose"],["BISON","American bison"],["LLAMA","Llama"],["PARROT","Parrot"],["PEACOCK","Peafowl"],["FLAMINGO","Flamingo"],["EAGLE","Bald eagle"],["SWAN","Mute swan"],["GOOSE","Goose"],["TURKEY","Turkey (bird)"],["ROOSTER","Rooster"],["PIGEON","Columbidae"],["SPARROW","House sparrow"],["CROW","Crow"],["HUMMINGBIRD","Ruby-throated hummingbird"],["OSTRICH","Common ostrich"],["LIZARD","Lizard"],["GECKO","Tokay gecko"],["CHAMELEON","Chameleon"],["TORTOISE","Tortoise"],["DINOSAUR","Tyrannosaurus"],["JELLYFISH","Jellyfish"],["STARFISH","Starfish"],["SEAHORSE","Seahorse"],["SHRIMP","Shrimp"],["LOBSTER","Lobster"],["SQUID","Squid"],["CLOWNFISH","Ocellaris clownfish"],["EEL","Eel"],["LADYBUG","Coccinellidae"],["DRAGONFLY","Dragonfly"],["GRASSHOPPER","Grasshopper"],["MOSQUITO","Mosquito"],["FLY","Housefly"],["COCKROACH","American cockroach"],["WORM","Earthworm"],["SNAIL","Snail"],["CATERPILLAR","Caterpillar"],["SCORPION","Scorpion"],["PUPPY","Puppy"],["KITTEN","Kitten"]]);
add("food", [["STEAK","Steak"],["CHICKEN RICE","Hainanese chicken rice"],["TOM YUM","Tom yum"],["MANGO STICKY RICE","Mango sticky rice"],["SPRING ROLL","Spring roll"],["DUMPLING","Dumpling"],["PORRIDGE","Congee"],["OMELET","Omelette"],["BOILED EGG","Boiled egg"],["TOAST","Toast (food)"],["JAM","Fruit preserves"],["PEANUT","Peanut butter"],["POPCORN","Popcorn"],["CHIPS","Potato chip"],["PUDDING","Crème caramel"],["CUPCAKE","Cupcake"],["PIE","Apple pie"],["WAFFLE","Waffle"],["BUBBLE TEA","Bubble tea"],["LEMONADE","Lemonade"],["SODA","Soft drink"],["SMOOTHIE","Smoothie"],["COCOA","Hot chocolate"],["SOY MILK","Soy milk"],["SAUSAGE","Sausage"],["BACON","Bacon"],["HAM","Ham"],["MEATBALL","Meatball"],["FISH BALL","Fish ball"],["TOFU","Tofu"],["SEAWEED","Nori"],["SALAD DRESSING","Salad dressing"],["KETCHUP","Ketchup"],["SOY SAUCE","Soy sauce"],["CHILI","Chili pepper"],["ONION","Onion"],["FLOUR","Flour"],["OIL","Cooking oil"],["BREAKFAST","Breakfast"],["LUNCH","Lunch"],["DINNER","Dinner"]]);
add("actions", [["STOP","Stop sign"],["DRIVE","Driving"],["BAKE","Baking"],["FRY","Frying"],["COMB","Comb"]]);
add("jobs", [["LAWYER","Lawyer"],["PROGRAMMER","Computer programming"],["PHOTOGRAPHER","Photographer"],["JOURNALIST","Journalist"],["MUSICIAN","Musician"],["ARCHITECT","Architect"],["PLUMBER","Plumber"],["GARDENER","Gardening"],["CLEANER","Janitor"],["SECURITY GUARD","Security guard"],["CASHIER","Cashier"],["STREET VENDOR","Street food"],["FLIGHT ATTENDANT","Flight attendant"],["CLOWN","Clown"]]);
add("home", [["LIVING ROOM","Living room"],["BEDROOM","Bedroom"],["GARAGE","Garage (residential)"],["GARDEN","Garden"],["BALCONY","Balcony"],["ROOF","Roof"],["WALL","Wall"],["STAIRS","Stairs"],["FENCE","Fence"],["CURTAIN","Curtain"],["CARPET","Carpet"],["FAN","Ceiling fan"],["AIR CONDITIONER","Air conditioning"],["WASHING MACHINE","Washing machine"],["MICROWAVE","Microwave oven"],["OVEN","Toaster oven"],["KETTLE","Kettle"],["RICE COOKER","Rice cooker"],["PAN","Frying pan"],["POT","Cookware and bakeware"],["KNIFE","Kitchen knife"],["BOWL","Bowl"],["GLASS","Glass (drinkware)"],["BOTTLE","Bottle"],["CHOPSTICKS","Chopsticks"],["TRASH CAN","Waste container"],["BROOM","Broom"],["BUCKET","Bucket"],["HANGER","Clothes hanger"],["WARDROBE","Closet"],["DRAWER","Drawer (furniture)"],["SHELF","Bookcase"],["CANDLE","Candle"],["VASE","Vase"],["PHOTO","Photograph"],["DOORBELL","Doorbell"],["LIGHT","Light fixture"],["SWITCH","Light switch"]]);
add("places", [["HOME","House"],["VILLAGE","Village"],["CITY","Bangkok"],["STREET","Street"],["BRIDGE","Bridge"],["GARDEN","Flower garden"],["HOTEL","Hotel"],["MUSEUM","Museum"],["AQUARIUM","Public aquarium"],["AMUSEMENT PARK","Amusement park"],["STADIUM","Stadium"],["CHURCH","Church (building)"],["MOSQUE","Mosque"],["PALACE","Grand Palace"],["CASTLE","Castle"],["TOWER","Tower"],["OFFICE","Office"],["FACTORY","Factory"],["HARBOR","Harbor"],["ISLAND","Phi Phi Islands"],["JUNGLE","Jungle"],["FLOATING MARKET","Floating market"],["NIGHT MARKET","Night market"],["CONVENIENCE STORE","Convenience store"]]);
add("school", [["SCIENCE","Science education"],["ART","Painting"],["MUSIC","Musical instrument"],["P.E.","Calisthenics"],["DICTIONARY","Dictionary"],["WHITEBOARD","Whiteboard"],["PROJECTOR","Video projector"],["PENCIL CASE","Pencil case"],["SHARPENER","Pencil sharpener"],["CANTEEN","Cafeteria"]]);
add("body", [["FACE","Face"],["BEARD","Beard"],["ANKLE","Ankle"],["BLOOD","Blood"]]);
add("nature", [["SEA","Coast"],["STREAM","Stream"],["SOIL","Soil"],["MUD","Mud"],["STONE","Pebble"],["SHELL","Seashell"],["CORAL","Coral reef"],["BRANCH","Branch"],["ROOT","Root"],["BUSH","Shrub"],["PALM TREE","Arecaceae"],["LOTUS","Nelumbo nucifera"],["ROSE","Rose"],["SUNFLOWER","Common sunflower"],["ORCHID","Orchid"],["PLANET","Planet"],["EARTH","Earth"],["SPACE","Outer space"],["AIR","Atmosphere of Earth"],["SMOKE","Smoke"]]);
add("vehicles", [["AIRPLANE","Airplane"],["JET","Jet aircraft"],["SUBWAY","Rapid transit"],["LORRY","Semi-trailer truck"],["RACE CAR","Racing car"],["JEEP","Jeep"],["CANOE","Canoe"],["LONGTAIL BOAT","Long-tail boat"],["WHEELCHAIR","Wheelchair"],["WHEEL","Tire"],["TRAFFIC LIGHT","Traffic light"],["SEAT BELT","Seat belt"],["HELMET","Bicycle helmet"]]);
add("clothes", [["JEANS","Jeans"],["HOODIE","Hoodie"],["VEST","High-visibility clothing"],["SNEAKERS","Sneakers"],["HIGH HEELS","High-heeled shoe"],["RING","Wedding ring"],["BRACELET","Bracelet"],["SUNGLASSES","Sunglasses"],["BUTTON","Button"],["POCKET","Pocket"],["ZIPPER","Zipper"]]);
add("sports", [["GOAL","Goal (sport)"],["RACKET","Racket (sports equipment)"],["WHISTLE","Whistle"],["TEAM","Team sport"],["COACH","Coach (sport)"],["RACE","Sprint (running)"],["MARATHON","Marathon"],["EXERCISE","Exercise"],["DIVING","Scuba diving"],["KAYAKING","Kayaking"]]);
add("toys", [["LEGO","Lego"],["TRAIN SET","Toy train"],["WATER GUN","Water gun"],["SANDBOX","Sandpit"],["TRAMPOLINE","Trampoline"],["ROLLER SKATES","Roller skates"],["CRAYONS","Crayon"],["MAGNET","Refrigerator magnet"],["BALLOON ANIMAL","Balloon modelling"]]);
add("colors", [["RAINBOW COLORS","Rainbow"]]);
add("family", [["BOY","Boy"],["GIRL","Girl"]]);
add("fruits", [["CANTALOUPE","Cantaloupe"],["APRICOT","Apricot"],["RASPBERRY","Raspberry"],["CRANBERRY","Cranberry"],["PASSION FRUIT","Passiflora edulis"],["MANGOSTEEN","Purple mangosteen"],["SAPODILLA","Manilkara zapota"],["SUGARCANE","Sugarcane"],["RAISIN","Raisin"]]);
add("weather", [["TORNADO","Tornado"],["TYPHOON","Typhoon"],["DRIZZLE","Drizzle"],["HAIL","Hail"],["TEMPERATURE","Thermometer"]]);
add("vegetables", [["CABBAGE","Cabbage"],["LETTUCE","Lettuce"],["SPINACH","Spinach"],["KALE","Chinese broccoli"],["MORNING GLORY","Ipomoea aquatica"],["CUCUMBER","Cucumber"],["PUMPKIN","Pumpkin"],["EGGPLANT","Eggplant"],["BELL PEPPER","Bell pepper"],["CORN COB","Corn on the cob"],["PEAS","Pea"],["CAULIFLOWER","Cauliflower"],["CELERY","Celery"],["RADISH","Daikon"],["SWEET POTATO","Sweet potato"],["TARO","Taro"],["LEMONGRASS","Cymbopogon"],["BASIL","Thai basil"],["SPRING ONION","Scallion"],["LIME","Lime (fruit)"],["WINTER MELON","Wax gourd"],["BABY CORN","Baby corn"],["ASPARAGUS","Asparagus officinalis"],["BAMBOO SHOOT","Bamboo shoot"],["SHIITAKE","Shiitake"],["STRAW MUSHROOM","Volvariella volvacea"],["BEETROOT","Beetroot"],["TURNIP","Turnip"],["OKRA","Okra"],["ZUCCHINI","Zucchini"],["ARTICHOKE","Artichoke"],["SEAWEED SALAD","Wakame"],["VEGETABLES","Vegetable"]]);
add("technology", [["SMARTPHONE","Smartphone"],["TABLET","Tablet computer"],["LAPTOP","Laptop"],["KEYBOARD","Computer keyboard"],["MOUSE","Computer mouse"],["SCREEN","Computer monitor"],["HEADPHONES","Headphones"],["SPEAKER","Loudspeaker"],["CAMERA","Camera"],["PRINTER","Printer (computing)"],["BATTERY","Battery (electricity)"],["CABLE","Electrical cable"],["WIFI","Wi-Fi"],["GAME","Gamepad"],["ROBOT VACUUM","Robotic vacuum cleaner"],["REMOTE","Remote control"],["CLOCK APP","Alarm clock"],["DRONE","Unmanned aerial vehicle"],["SATELLITE","Satellite"]]);
add("music", [["VIOLIN","Violin"],["FLUTE","Western concert flute"],["SAXOPHONE","Alto saxophone"],["XYLOPHONE","Xylophone"],["TAMBOURINE","Tambourine"],["UKULELE","Ukulele"],["ACCORDION","Accordion"],["MARACAS","Maraca"],["RANAT","Ranat ek"],["KHIM","Khim"],["SINGER","Singing"],["CONCERT","Concert"],["MICROPHONE","Microphone"]]);
add("time", [,["NOVEMBER","Loy Krathong"],["MORNING","Sunrise"],["EVENING","Sunset"],["NIGHT","Night"],["BIRTHDAY","Birthday cake"]]);
add("countries", [["THAILAND","Wat Arun"],["JAPAN","Mount Fuji"],["CHINA","Great Wall of China"],["KOREA","Gyeongbokgung"],["INDIA","Taj Mahal"],["VIETNAM","Ha Long Bay"],["LAOS","Luang Prabang"],["MYANMAR","Shwedagon Pagoda"],["CAMBODIA","Angkor Wat"],["MALAYSIA","Kuala Lumpur"],["SINGAPORE","Merlion"],["AUSTRALIA","Sydney Opera House"],["ENGLAND","Big Ben"],["AMERICA","Statue of Liberty"],["FRANCE","Louvre"],["ITALY","Colosseum"],["EGYPT","Egyptian pyramids"],["BRAZIL","Christ the Redeemer (statue)"],["WORLD","World map"],["FLAG","National flag"]]);
add("cover", [["vegetables","Vegetable"],["technology","Consumer electronics"],["music","Musical instrument"],["time","Clock"],["countries","World map"]]);

// ── v2.9: เติมรูปให้หมวดที่เคยปล่อยเป็นอีโมจิ (ตรวจคุณภาพด้วย contact-sheet หลัง workflow ดึง) ──
add("fruits", []);
add("food", [["CEREAL","Breakfast cereal"]]);
add("school", [["TEACHER","Primary education"],["CLASSMATE","Primary school"],["PRINCIPAL","Head teacher"],["LESSON","Classroom"],["TEST","Test (assessment)"],["ENGLISH","English alphabet"],["MATH","Arithmetic"],["HISTORY","Ayutthaya Historical Park"],["LIBRARY CARD","Library card"]]);
add("body", [,["SKIN","Human skin"],["BACK","Human back"],["STOMACH","Abdomen"],["TEETH","Human tooth"]]);
add("weather", [,["WARM","Campfire"],["HUMID","Tropical rainforest"]]);
add("vehicles", [["STROLLER","Baby transport"],["ENGINE","V8 engine"]]);
add("jobs", [["TEACHER","Primary education"],["ACTOR","Acting"],["ACCOUNTANT","Calculator"],["PAINTER","House painter and decorator"],["FARMER'S HELPER","Farmer"],["KING","Crown (headgear)"],["QUEEN","Tiara"],["SUPERHERO","Superhero"],["PIRATE","Piracy"],]);
add("clothes", [,]);
add("home", [["DOOR","Front door"],["TV","Television"],["SHOWER","Shower head"],["BATHROOM","Bathtub"],["FLOOR","Floor"]]);
add("nature", [["SKY","Cirrus cloud"]]);
add("sports", [["KARATE","Karate"],["RUNNING SHOES","Sneakers"],["BAT","Baseball bat"],["NET","Fishing net"],["STRETCH","Stretching"]]);
add("toys", [["SEESAW","Seesaw"],["SPINNING TOP","Spinning top"],["STICKER BOOK","Sticker album"],["PLAYDOUGH","Play-Doh"]]);
add("vegetables", [["BEANS","Green bean"],["GALANGAL","Alpinia galanga"]]);
add("technology", [["CHARGER","AC adapter"],["INTERNET","Wireless router"],["VIDEO","Video camera"],["PASSWORD","Padlock"]]);
add("music", [["TRUMPET","Trumpet"],["SONG","Karaoke"],["RHYTHM","Metronome"],["LOUD","Megaphone"],["QUIET","Library"],["DANCE FLOOR","Nightclub"]]);
add("family", [["MOTHER","Mother"],["FATHER","Father"],["BABY","Infant"],["FAMILY","Nuclear family"],["AUNT","Aunt"],["SON","Boy"],["DAUGHTER","Daughter"],["PARENTS","Parent"],["TWINS","Twin"],["FRIEND","Friendship"],["MAN","Man"],["WOMAN","Woman"]]);
add("actions", [["SLEEP","Nap"],["WRITE","Homework"],["SIT","Sitting"],["STAND","Standing"],["LISTEN","Listening"],["PUSH","Shopping cart"],["PULL","Tug of war"],["CATCH","Catcher"],["KICK","Taekwondo"],["JUMP","Jumping"],["GO","Pedestrian crossing"],["COME","Waving"],["LOOK","Binoculars"],["SEE","Human eye"],["HEAR","Ear"],["TOUCH","Hand"],["TASTE","Tongue"],["SPEAK","Conversation"],["SAY","Megaphone"],["ASK","Hand-raising"],["HELP","First aid"],["GIVE","Gift"],["BUY","Shopping"],["SELL","Street food"],["PAY","Cash register"],["START","Starting blocks"],["FINISH","Racing flags"],["FLY","Bird flight"],["RIDE","Cycling"],["CARRY","Backpack"],["BUILD","Construction worker"],["FIX","Auto mechanic"],["CUT","Scissors"],["PAINT","House painter and decorator"],["COLOR","Crayon"],["FOLD","Origami"],["CLEAN","Cleaning"],["SWEEP","Broom"],["WIPE","Window cleaner"],["POUR","Teapot"],["MIX","Whisk"],["BOIL","Boiling"],["FEED","Baby bottle"],["WATER","Watering can"],["PLANT","Seedling"],["DIG","Shovel"],["WAKE UP","Alarm clock"],["GET UP","Sunrise"],["BRUSH","Toothbrushing"],["SHOWER","Shower head"],["DRESS","Dress"],["STUDY","Student"],["LEARN","Primary education"],["TEACH","Classroom"],["THINK","The Thinker"],["KNOW","Light bulb"],["COUNT","Abacus"],["SPELL","Spelling bee"],["LOVE","Heart symbol"],["LIKE","Thumb signal"],["SHARE","Sharing"],["WAVE","Waving"]]);
add("opposites", [["BIG","Asian elephant"],["SMALL","House mouse"],["TALL","Giraffe"],["FAST","Cheetah"],["SLOW","Sloth"],["COLD","Snow"],["NEW","Sneakers"],["OLD","Old age"],["YOUNG","Infant"],["HAPPY","Smile"],["SAD","Crying"],["CLEAN","Hand washing"],["DIRTY","Mud"],["WET","Rain"],["DRY","Desert"],["HEAVY","Dumbbell"],["LIGHT","Toy balloon"],["HARD","Pebble"],["SOFT","Pillow"],["LOUD","Megaphone"],["QUIET","Library"],["RICH","Gold"],["STRONG","Weightlifting"],["SWEET","Candy"],["SOUR","Lemon"],["SAME","Twin"]]);
add("time", [["HOLIDAY","Vacation"],["WEEKEND","Park"]]);

add("actions", [["SPEAK","Public speaking"]]);
add("jobs", [["ACTOR","Theatre"]]);
add("school", [["FLAG","National flag"]]);
add("sports", [["SKIING","Alpine skiing"]]);
add("vegetables", [["ASPARAGUS","Asparagus officinalis"]]);
export const IMAGE_TITLES = T;
export const imageTitleOf = w => (w && T[`${w.cat}|${w.word}`]) || null;

// ── โหลด URL รูปจาก Wikipedia · จำผลไว้ใน localStorage (title → url หรือ "" ถ้าไม่มีรูป) ──
const CK = "smart-vocabplay:imgcache:v1";
let mem = null;
const load = () => { if (mem) return mem; try { mem = JSON.parse(window.localStorage.getItem(CK) || "{}") || {}; } catch (_) { mem = {}; } return mem; };
const save = () => { try { window.localStorage.setItem(CK, JSON.stringify(mem)); } catch (_) {} };
const inflight = {};

// รูปที่บรรจุมากับแอป (public/img จาก scripts/fetch-images.mjs) — ใช้ก่อนเสมอ ไม่ต้องต่อเน็ต
const BASE = (typeof import.meta !== "undefined" && import.meta.env?.BASE_URL) || "/";
export function bundledImageUrl(title) { const f = manifest[title]; return f ? `${BASE}img/${f}` : null; }
export const bundledCount = () => Object.keys(manifest).length;

export function cachedImageUrl(title) { const b = bundledImageUrl(title); if (b) return b; const c = load(); return title in c ? c[title] : undefined; }

export function fetchImageUrl(title) {
  const c = load();
  if (title in c) return Promise.resolve(c[title]);
  if (inflight[title]) return inflight[title];
  const b = bundledImageUrl(title); if (b) return Promise.resolve(b);
  inflight[title] = fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`)
    .then(r => { if (r.status === 404) return { none: true }; if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(j => {
      let url = j?.thumbnail?.source || "";
      if (url) url = url.replace(/\/(\d+)px-/, "/480px-");   // ขอขนาด 480px พอสำหรับมือถือ
      // จำผลเฉพาะเมื่อได้คำตอบจริง (มีรูป หรือบทความไม่มีรูป) · error ชั่วคราวไม่จำ
      if (url || j?.none || j?.title) { c[title] = url; save(); }
      return url;
    })
    .catch(() => "")   // ออฟไลน์/บล็อก → ไม่จำผล ลองใหม่คราวหน้า
    .finally(() => { delete inflight[title]; });
  return inflight[title];
}
export const wikiPageUrl = title => `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
