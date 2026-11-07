"""Per-category / per-word search + CLIP specification.

For each word we build a Spec:
  queries  : Commons file-search strings (kid-friendly templates)
  prompts  : CLIP positive prompts (averaged into one class embedding)
  neg      : hard-negative prompts (look-alikes) that compete with the target in the softmax
  mode     : how the subject box is found for cropping
               "object" = detector/saliency box, whole subject must fit (animals, things)
               "person" = union of detected people
               "scene"  = whole image is the subject (places, weather, landscapes)
  coco     : COCO class names the YOLO detector may use for this word
  text_ok  : don't penalise visible text (numbers, signs, calendars)
"""
import re

STYLE_NEG = ["a drawing", "a cartoon", "a clip art illustration", "a map", "a diagram", "text on a page",
             "a logo", "a painting", "a 3D render", "a screenshot", "a sketch", "a scanned document"]
PHOTO_POS = ["a real photo", "a photograph"]
QUALITY_POS = "a bright, sharp, colorful photo with one clear subject"
QUALITY_NEG = ["a dark, blurry photo", "a cluttered, busy photo with many things", "a black and white photo",
               "a low quality old photo", "a tiny subject far away"]
UNSAFE = ["blood and gore", "a dead animal", "nudity", "a scary horror image", "a weapon", "a dangerous injury",
          "a sexy photo of a person in underwear"]
SAFE_REF = ["a friendly photo suitable for children", "an ordinary everyday photo"]

COCO = set("""person bicycle car motorcycle airplane bus train truck boat traffic_light fire_hydrant stop_sign parking_meter bench
bird cat dog horse sheep cow elephant bear zebra giraffe backpack umbrella handbag tie suitcase frisbee skis snowboard sports_ball kite
baseball_bat baseball_glove skateboard surfboard tennis_racket bottle wine_glass cup fork knife spoon bowl banana apple sandwich orange
broccoli carrot hot_dog pizza donut cake chair couch potted_plant bed dining_table toilet tv laptop mouse remote keyboard cell_phone
microwave oven toaster sink refrigerator book clock vase scissors teddy_bear hair_drier toothbrush""".split())

# ---------- word -> COCO class (for detection) ----------
COCO_MAP = {
 "animals|CAT": "cat", "animals|KITTEN": "cat", "animals|DOG": "dog", "animals|PUPPY": "dog", "animals|HORSE": "horse",
 "animals|SHEEP": "sheep", "animals|COW": "cow", "animals|BUFFALO": "cow", "animals|BISON": "cow", "animals|ELEPHANT": "elephant",
 "animals|BEAR": "bear", "animals|POLAR BEAR": "bear", "animals|PANDA": "bear", "animals|ZEBRA": "zebra", "animals|GIRAFFE": "giraffe",
 "animals|BIRD": "bird", "animals|DUCK": "bird", "animals|OWL": "bird", "animals|PENGUIN": "bird", "animals|CHICKEN": "bird",
 "animals|PARROT": "bird", "animals|PEACOCK": "bird", "animals|FLAMINGO": "bird", "animals|EAGLE": "bird", "animals|SWAN": "bird",
 "animals|GOOSE": "bird", "animals|TURKEY": "bird", "animals|ROOSTER": "bird", "animals|PIGEON": "bird", "animals|SPARROW": "bird",
 "animals|CROW": "bird", "animals|HUMMINGBIRD": "bird", "animals|OSTRICH": "bird", "animals|GOAT": "sheep", "animals|DONKEY": "horse",
 "animals|LLAMA": "sheep", "animals|DEER": "horse", "animals|REINDEER": "horse", "animals|MOOSE": "horse", "animals|CAMEL": "horse",
 "fruits|APPLE": "apple", "fruits|BANANA": "banana", "fruits|ORANGE": "orange", "food|PIZZA": "pizza", "food|CAKE": "cake",
 "food|DONUT": "donut", "food|SANDWICH": "sandwich", "food|HOTDOG": "hot_dog", "food|BROCCOLI": "broccoli", "food|CARROT": "carrot",
 "food|CUPCAKE": "cake",
 "vehicles|CAR": "car", "vehicles|TAXI": "car", "vehicles|POLICE CAR": "car", "vehicles|RACE CAR": "car", "vehicles|JEEP": "car",
 "vehicles|VAN": "car", "vehicles|BUS": "bus", "vehicles|TRAIN": "train", "vehicles|TRAM": "train", "vehicles|SUBWAY": "train",
 "vehicles|SKYTRAIN": "train", "vehicles|PLANE": "airplane", "vehicles|AIRPLANE": "airplane", "vehicles|JET": "airplane",
 "vehicles|BOAT": "boat", "vehicles|SHIP": "boat", "vehicles|SAILBOAT": "boat", "vehicles|FERRY": "boat", "vehicles|SPEEDBOAT": "boat",
 "vehicles|CANOE": "boat", "vehicles|LONGTAIL BOAT": "boat", "vehicles|BIKE": "bicycle", "vehicles|MOTORCYCLE": "motorcycle",
 "vehicles|SCOOTER": "motorcycle", "vehicles|TRUCK": "truck", "vehicles|PICKUP TRUCK": "truck", "vehicles|GARBAGE TRUCK": "truck",
 "vehicles|FIRETRUCK": "truck", "vehicles|LORRY": "truck", "vehicles|AMBULANCE": "truck", "vehicles|TRAFFIC LIGHT": "traffic_light",
 "home|BED": "bed", "home|CHAIR": "chair", "school|CHAIR": "chair", "home|SOFA": "couch", "home|TV": "tv", "home|CLOCK": "clock",
 "home|TOILET": "toilet", "home|SINK": "sink", "home|FRIDGE": "refrigerator", "home|MICROWAVE": "microwave", "home|OVEN": "oven",
 "home|CUP": "cup", "home|FORK": "fork", "home|SPOON": "spoon", "home|KNIFE": "knife", "home|BOWL": "bowl", "home|BOTTLE": "bottle",
 "home|VASE": "vase", "home|TOOTHBRUSH": "toothbrush", "home|PHONE": "cell_phone", "home|COMPUTER": "laptop", "home|TABLE": "dining_table",
 "school|BOOK": "book", "school|SCISSORS": "scissors", "school|COMPUTER": "laptop", "school|BAG": "backpack",
 "technology|LAPTOP": "laptop", "technology|SMARTPHONE": "cell_phone", "technology|KEYBOARD": "keyboard", "technology|MOUSE": "mouse",
 "technology|REMOTE": "remote", "technology|SCREEN": "tv", "technology|CLOCK": "clock",
 "toys|TEDDY BEAR": "teddy_bear", "toys|KITE": "kite", "toys|BALL": "sports_ball", "toys|SKATEBOARD": "skateboard",
 "sports|SKATEBOARD": "skateboard", "sports|BAT": "baseball_bat", "sports|RACKET": "tennis_racket",
 "clothes|UMBRELLA": "umbrella", "clothes|TIE": "tie",
}

# ---------- category defaults ----------
# q: query templates; p: prompt templates; mode
CAT = {
 "animals":   dict(q=["{w} animal", "{w}"], p=["a photo of a {w}", "a photo of a whole {w} animal"], mode="object"),
 "fruits":    dict(q=["{w} fruit", "{w}"], p=["a close-up photo of {w} fruit", "a photo of a {w}"], mode="object"),
 "vegetables":dict(q=["{w} vegetable", "{w}"], p=["a photo of {w}, a vegetable"], mode="object"),
 "food":      dict(q=["{w} food", "{w}"], p=["a photo of {w}, food", "a photo of {w}"], mode="object"),
 "school":    dict(q=["{w}", "{w} school"], p=["a photo of a {w}"], mode="object"),
 "body":      dict(q=["human {w}", "{w} body part"], p=["a photo of a person's {w}", "a close-up photo of a human {w}"], mode="object"),
 "clothes":   dict(q=["{w} clothing", "{w}"], p=["a photo of a {w}", "a photo of {w}, clothing"], mode="object"),
 "colors":    dict(q=["{w} color objects", "{w} balloons"], p=["a photo of bright {w} colored objects", "the color {w}"], mode="object"),
 "numbers":   dict(q=["number {w}"], p=["a photo of the number {w}"], mode="object", text_ok=True),
 "shapes":    dict(q=["{w} shape", "{w} shaped object"], p=["a photo of a {w} shaped object", "a {w} shape"], mode="object"),
 "feelings":  dict(q=["{w} child", "{w} face", "{w} person"], p=["a photo of a {w} child", "a photo of a person who feels {w}"], mode="person"),
 "opposites": dict(q=["{w}"], p=["a photo of something {w}"], mode="object"),
 "time":      dict(q=["{w}"], p=["a photo representing {w}"], mode="scene", text_ok=True),
 "actions":   dict(q=["child {ing}", "person {ing}", "{ing}"], p=["a photo of a child {ing}", "a photo of a person {ing}"], mode="person"),
 "family":    dict(q=["{w}"], p=["a photo of a {w}"], mode="person"),
 "jobs":      dict(q=["{w} at work", "{w}"], p=["a photo of a {w} at work", "a photo of a {w}"], mode="person"),
 "music":     dict(q=["{w} musical instrument", "{w}"], p=["a photo of a {w}"], mode="object"),
 "nature":    dict(q=["{w}", "{w} nature"], p=["a photo of a {w}"], mode="object"),
 "places":    dict(q=["{w}", "{w} building"], p=["a photo of a {w}"], mode="scene"),
 "sports":    dict(q=["{w} sport", "{w}"], p=["a photo of {w}, a sport", "a photo of people doing {w}"], mode="person"),
 "technology":dict(q=["{w}", "{w} device"], p=["a photo of a {w}"], mode="object"),
 "toys":      dict(q=["{w} toy", "{w}"], p=["a photo of a toy {w}", "a photo of a {w} for children"], mode="object"),
 "vehicles":  dict(q=["{w} vehicle", "{w}"], p=["a photo of a {w}"], mode="object"),
 "weather":   dict(q=["{w} weather", "{w}"], p=["a photo of {w} weather"], mode="scene"),
 "countries": dict(q=["{w} landmark"], p=["a famous landmark of {w}"], mode="scene"),
 "home":      dict(q=["{w}", "{w} home"], p=["a photo of a {w} in a home"], mode="object"),
}

ING_EXC = {"RUN": "running", "SWIM": "swimming", "SIT": "sitting", "CUT": "cutting", "DIG": "digging", "STOP": "stopping",
           "WIN": "winning", "GET UP": "getting up", "WAKE UP": "waking up", "DIE": "dying", "LIE": "lying", "SHOP": "shopping",
           "CLAP": "clapping", "SEE": "seeing", "FLY": "flying", "SAY": "saying", "PLAY": "playing", "BUY": "buying", "PAY": "paying",
           "CARRY": "carrying", "FRY": "frying", "STUDY": "studying", "BEGIN": "beginning", "HUG": "hugging", "PLAN": "planning"}


def ing(w):
    W = w.upper()
    if W in ING_EXC: return ING_EXC[W]
    w = w.lower()
    if w.endswith("ie"): return w[:-2] + "ying"
    if w.endswith("e") and not w.endswith("ee"): return w[:-1] + "ing"
    return w + "ing"


# ---------- per-word overrides ----------
# keys: "cat|WORD" or "*|WORD" (any category). values: dict(q=[...], p=[...], neg=[...], mode=..., text_ok=...)
O = {}


def o(keys, **kw):
    for k in keys.split(";"):
        O[k.strip()] = kw


# --- animals: look-alikes ---
o("animals|DOG", q=["dog", "domestic dog pet", "dog animal"], p=["a photo of a pet dog"], neg=["a photo of a wolf", "a photo of a fox", "a photo of a coyote", "a photo of a jackal", "a photo of a hyena", "a photo of a dingo"])
o("animals|PUPPY", q=["puppy", "puppy dog"], p=["a photo of a cute puppy"], neg=["a photo of an adult dog", "a photo of a wolf", "a photo of a fox cub"])
o("animals|CAT", q=["domestic cat", "cat pet"], p=["a photo of a pet cat"], neg=["a photo of a tiger", "a photo of a lion", "a photo of a lynx", "a photo of a wild cat", "a photo of a kitten"])
o("animals|KITTEN", q=["kitten", "kitten cat"], p=["a photo of a cute kitten"], neg=["a photo of an adult cat", "a photo of a tiger cub", "a photo of a lion cub"])
o("animals|MOUSE", q=["house mouse", "mouse rodent"], p=["a photo of a small mouse, the animal"], neg=["a photo of a rat", "a photo of a hamster", "a photo of a computer mouse", "a photo of a gerbil"])
o("animals|RABBIT", q=["rabbit", "pet rabbit"], neg=["a photo of a hare"])
o("animals|FROG", q=["frog", "green frog"], neg=["a photo of a toad", "a photo of a lizard"])
o("animals|FOX", q=["red fox"], neg=["a photo of a dog", "a photo of a wolf", "a photo of a coyote"])
o("animals|WOLF", q=["gray wolf", "wolf animal"], neg=["a photo of a dog", "a photo of a husky dog", "a photo of a coyote"])
o("animals|TIGER", neg=["a photo of a house cat", "a photo of a leopard"])
o("animals|LION", neg=["a photo of a house cat", "a photo of a tiger"])
o("animals|BUFFALO", q=["water buffalo", "water buffalo Thailand"], p=["a photo of a water buffalo"], neg=["a photo of an American bison", "a photo of a cow"])
o("animals|BISON", q=["American bison"], neg=["a photo of a water buffalo", "a photo of a cow"])
o("animals|BAT", q=["bat animal flying", "fruit bat"], p=["a photo of a bat, the flying animal"], neg=["a photo of a baseball bat", "a photo of a bird"])
o("animals|SEAL", q=["harbor seal", "seal animal"], neg=["a photo of a sea lion", "a photo of a walrus"])
o("animals|DONKEY", neg=["a photo of a horse", "a photo of a mule"])
o("animals|GOAT", neg=["a photo of a sheep", "a photo of an ibex"])
o("animals|LEOPARD", neg=["a photo of a cheetah", "a photo of a jaguar"])
o("animals|CHEETAH", neg=["a photo of a leopard", "a photo of a jaguar"])
o("animals|BEE", q=["honey bee", "bee on flower"], neg=["a photo of a wasp", "a photo of a fly", "a photo of a hornet"])
o("animals|FLY", q=["housefly", "fly insect"], p=["a photo of a housefly insect"], neg=["a photo of a bee", "a photo of a mosquito", "a photo of an airplane"])
o("animals|WORM", q=["earthworm"], p=["a photo of an earthworm"], neg=["a photo of a snake", "a photo of a caterpillar"])
o("animals|DINOSAUR", q=["dinosaur model park", "dinosaur skeleton museum", "dinosaur statue"], p=["a photo of a dinosaur model", "a photo of a dinosaur skeleton"])
o("animals|FISH", q=["goldfish", "fish aquarium", "fish"], p=["a photo of a fish"])
o("animals|BIRD", q=["bird", "songbird perched"], p=["a photo of a bird"])
o("animals|CROCODILE", q=["crocodile", "crocodile Thailand"], neg=["a photo of a lizard"])
o("animals|TURTLE", q=["sea turtle", "turtle"], p=["a photo of a turtle"])
o("animals|TORTOISE", q=["tortoise"], neg=["a photo of a sea turtle"])
o("animals|GORILLA", neg=["a photo of a chimpanzee"])
o("animals|MONKEY", q=["monkey", "macaque"], neg=["a photo of a gorilla", "a photo of a chimpanzee"])
o("animals|LOBSTER", neg=["a photo of a crayfish", "a photo of a shrimp"])
o("animals|SHRIMP", q=["shrimp", "prawn"], neg=["a photo of a lobster"])
o("animals|EEL", q=["moray eel", "eel fish"], neg=["a photo of a snake"])
o("animals|LIZARD", neg=["a photo of a gecko", "a photo of a chameleon", "a photo of a crocodile"])
o("animals|DEER", q=["deer", "deer animal"], neg=["a photo of a reindeer", "a photo of a moose", "a photo of an antelope"])
o("animals|HIPPO", q=["hippopotamus"], p=["a photo of a hippopotamus"])
o("animals|RHINO", q=["rhinoceros"], p=["a photo of a rhinoceros"])
o("animals|CHICKEN", q=["chicken hen", "chicken farm"], p=["a photo of a chicken hen"])
o("animals|ROOSTER", q=["rooster"], neg=["a photo of a hen"])
o("animals|JELLYFISH", q=["jellyfish"])
o("animals|SNAIL", q=["snail", "garden snail"], neg=["a photo of a slug"])
o("animals|LADYBUG", q=["ladybird beetle", "ladybug"])
o("animals|COCKROACH", q=["cockroach"])
o("animals|MOSQUITO", q=["mosquito"])

# --- fruits / veg / food ---
o("fruits|ORANGE", q=["orange fruit", "oranges citrus"], p=["a photo of an orange, the citrus fruit"], neg=["a photo of something orange colored", "a photo of a tangerine peeled"])
o("fruits|CHERRY", q=["cherries fruit", "cherry fruit"], p=["a photo of red cherry fruits"], neg=["a photo of cherry blossom flowers"])
o("fruits|KIWI", q=["kiwifruit", "kiwi fruit"], p=["a photo of kiwifruit"], neg=["a photo of a kiwi bird"])
o("fruits|COCONUT", q=["coconut fruit", "coconut"], p=["a photo of a coconut"])
o("fruits|MELON", q=["melon fruit", "honeydew melon"], p=["a photo of a melon"])
o("fruits|ROSE APPLE", q=["Syzygium samarangense fruit", "rose apple fruit", "wax apple"], p=["a photo of rose apple (wax apple) fruit"])
o("fruits|STAR FRUIT", q=["carambola fruit", "star fruit"], p=["a photo of star fruit (carambola)"])
o("fruits|DRAGON FRUIT", q=["dragon fruit", "pitaya fruit"])
o("fruits|SUGARCANE", q=["sugarcane stalks", "sugarcane"], p=["a photo of sugarcane stalks"])
o("fruits|RAISIN", q=["raisins"], p=["a photo of raisins"])
o("fruits|GRAPE", q=["grapes fruit", "bunch of grapes"], p=["a photo of a bunch of grapes"])
o("fruits|DATE", q=["date fruit"])
o("vegetables|CORN COB", q=["corn on the cob", "maize cob"], p=["a photo of a corn cob"])
o("vegetables|LIME", q=["lime fruit", "limes citrus"], p=["a photo of green limes"], neg=["a photo of lemons"])
o("vegetables|MORNING GLORY", q=["Ipomoea aquatica vegetable", "water spinach", "morning glory vegetable"], p=["a photo of water spinach (morning glory) vegetable"], neg=["a photo of morning glory flowers"])
o("vegetables|BEANS", q=["green beans", "beans vegetable"], p=["a photo of beans"])
o("vegetables|PEAS", q=["green peas pod", "peas"], p=["a photo of green peas"])
o("vegetables|BELL PEPPER", q=["bell pepper", "capsicum"], p=["a photo of a bell pepper"])
o("vegetables|BITTER GOURD", q=["bitter melon", "bitter gourd"], p=["a photo of bitter gourd"])
o("vegetables|WINTER MELON", q=["winter melon", "Benincasa hispida"], p=["a photo of a winter melon"])
o("vegetables|SHIITAKE", q=["shiitake mushrooms"], p=["a photo of shiitake mushrooms"])
o("vegetables|STRAW MUSHROOM", q=["straw mushroom", "Volvariella volvacea"], p=["a photo of straw mushrooms"])
o("vegetables|SEAWEED", q=["seaweed food", "nori seaweed"], p=["a photo of edible seaweed"])
o("vegetables|VEGETABLES", q=["vegetables market", "fresh vegetables"], p=["a photo of many fresh vegetables"])
o("vegetables|SPRING ONION", q=["spring onions", "scallion"], p=["a photo of spring onions"])
o("vegetables|CORIANDER", q=["coriander leaves", "cilantro"], p=["a photo of coriander leaves"])
o("vegetables|BASIL", q=["basil leaves", "Thai basil"], p=["a photo of basil leaves"])
o("vegetables|LEMONGRASS", q=["lemongrass"], p=["a photo of lemongrass stalks"])
o("vegetables|GALANGAL", q=["galangal root", "Alpinia galanga rhizome"], p=["a photo of galangal root"])
o("vegetables|GINGER", q=["ginger root", "ginger rhizome"], p=["a photo of ginger root"])
o("vegetables|TARO", q=["taro root", "taro corms"], p=["a photo of taro root"])
o("vegetables|CASSAVA", q=["cassava root", "cassava tubers"], p=["a photo of cassava roots"])
o("vegetables|BAMBOO SHOOT", q=["bamboo shoots food", "bamboo shoot"], p=["a photo of bamboo shoots"])
o("vegetables|BABY CORN", q=["baby corn"], p=["a photo of baby corn"])
o("vegetables|BEAN SPROUTS", q=["bean sprouts", "mung bean sprouts"], p=["a photo of bean sprouts"])
o("food|PEPPER", q=["black pepper peppercorns", "peppercorns"], p=["a photo of black peppercorns"], neg=["a photo of a bell pepper"])
o("food|CHILI", q=["chili peppers", "red chillies"], p=["a photo of red chili peppers"])
o("food|WATER", q=["glass of water", "drinking water glass"], p=["a photo of a glass of drinking water"])
o("food|OIL", q=["cooking oil bottle", "vegetable oil"], p=["a photo of cooking oil"])
o("food|ICECREAM", q=["ice cream cone", "ice cream"], p=["a photo of ice cream"])
o("food|HOTDOG", q=["hot dog"], p=["a photo of a hot dog sandwich"], neg=["a photo of a dog"])
o("food|CHIPS", q=["potato chips", "crisps snack"], p=["a photo of potato chips"])
o("food|CHICKEN RICE", q=["Hainanese chicken rice", "khao man kai"], p=["a photo of Hainanese chicken rice"])
o("food|TOM YUM", q=["tom yum soup", "tom yum goong"], p=["a photo of tom yum soup"])
o("food|MANGO STICKY RICE", q=["mango sticky rice", "khao niao mamuang"], p=["a photo of mango sticky rice"])
o("food|GRILLED PORK", q=["moo ping grilled pork skewers", "grilled pork skewers"], p=["a photo of grilled pork skewers"])
o("food|FISH BALL", q=["fish balls", "fish ball skewers"], p=["a photo of fish balls"])
o("food|SOM TAM", q=["som tam papaya salad", "green papaya salad"], p=["a photo of green papaya salad"])
o("food|PAD THAI", q=["pad thai"], p=["a photo of pad thai noodles"])
o("food|SPRING ROLL", q=["spring rolls"], p=["a photo of fried spring rolls"])
o("food|BREAKFAST", q=["breakfast table", "breakfast plate"], p=["a photo of a breakfast meal"])
o("food|LUNCH", q=["lunch plate", "lunch meal"], p=["a photo of a lunch meal"])
o("food|DINNER", q=["family dinner table", "dinner plate"], p=["a photo of a dinner meal"])
o("food|SODA", q=["soda can", "soft drink glass"], p=["a photo of a soda soft drink"])
o("food|COCOA", q=["hot cocoa mug", "hot chocolate drink"], p=["a photo of a mug of hot cocoa"])
o("food|SALAD DRESSING", q=["salad dressing"], p=["a photo of salad dressing"])
o("food|BUBBLE TEA", q=["bubble tea"], p=["a photo of bubble tea with tapioca pearls"])
o("food|PIE", q=["pie baked", "apple pie"], p=["a photo of a baked pie"])
o("food|SUGAR", q=["sugar cubes", "white sugar"], p=["a photo of sugar"])
o("food|SALT", q=["salt crystals", "table salt"], p=["a photo of salt"])
o("food|FLOUR", q=["wheat flour", "flour bowl"], p=["a photo of flour"])
o("food|EGG", q=["chicken eggs", "fried egg"], p=["a photo of eggs"])
o("food|RICE", q=["cooked rice bowl", "steamed rice"], p=["a photo of a bowl of cooked rice"])
o("food|MILK", q=["glass of milk"], p=["a photo of a glass of milk"])
o("food|JUICE", q=["orange juice glass", "fruit juice"], p=["a photo of a glass of juice"])
o("food|TEA", q=["cup of tea"], p=["a photo of a cup of tea"])
o("food|COFFEE", q=["cup of coffee"], p=["a photo of a cup of coffee"])
o("food|CANDY", q=["candy sweets", "colorful candy"], p=["a photo of colorful candy"])
o("food|CEREAL", q=["breakfast cereal bowl"], p=["a photo of a bowl of breakfast cereal"])
o("food|JAM", q=["jam jar", "strawberry jam"], p=["a photo of a jar of jam"])
o("food|PEANUT", q=["peanuts"], p=["a photo of peanuts"])
o("food|TOAST", q=["toast bread slice", "toasted bread"], p=["a photo of toast"])
o("food|SOY MILK", q=["soy milk"], p=["a photo of soy milk"])
o("food|SOY SAUCE", q=["soy sauce bottle", "soy sauce"], p=["a photo of soy sauce"])
o("food|FISH SAUCE", q=["fish sauce bottle", "fish sauce"], p=["a photo of a bottle of fish sauce"])
o("food|KETCHUP", q=["ketchup bottle", "ketchup"], p=["a photo of ketchup"])
o("food|SEAWEED", q=["nori seaweed snack", "seaweed food"], p=["a photo of edible seaweed"])

# --- colors: bright everyday objects of that colour ---
for c, qs in {
  "RED": ["red apples", "red balloons", "red color"], "BLUE": ["blue balloons", "blue color", "blue objects"],
  "GREEN": ["green leaves", "green apples", "green color"], "YELLOW": ["yellow balloons", "yellow color", "yellow flowers"],
  "PURPLE": ["purple color", "purple flowers", "purple balloons"], "ORANGE": ["orange color", "orange balloons", "orange objects"],
  "PINK": ["pink color", "pink flowers", "pink balloons"], "BROWN": ["brown color", "brown leaves", "brown objects"],
  "BLACK": ["black color", "black objects", "black stones"], "WHITE": ["white color", "white objects", "white flowers"],
  "GRAY": ["gray color", "grey stones", "gray objects"], "GOLD": ["gold color", "gold coins", "gold bars"],
  "SILVER": ["silver color", "silver coins", "silver spoons"], "LIGHT BLUE": ["light blue color", "light blue sky", "pale blue"],
  "DARK GREEN": ["dark green leaves", "dark green color"], "BEIGE": ["beige color", "beige fabric", "beige"],
  "TURQUOISE": ["turquoise color", "turquoise water", "turquoise stone"], "VIOLET": ["violet flowers", "violet color"],
  "NAVY": ["navy blue color", "navy blue fabric"], "RAINBOW COLORS": ["colored pencils rainbow", "rainbow colors", "crayons colors"],
}.items():
    name = c.lower()
    O[f"colors|{c}"] = dict(q=qs, p=[f"a photo of bright {name} colored objects", f"the color {name}", f"everything in this photo is {name}"])
O["colors|RAINBOW COLORS"]["p"] = ["a photo of many objects in all the colors of the rainbow", "colorful rainbow colored pencils"]
O["colors|GRAY"]["neg"] = ["a black and white photo"]

# --- numbers ---
SMALL_NUM = {"ZERO": (0, "an empty plate", ["empty plate", "number 0 sign", "zero"]),
             "ONE": (1, "one apple", ["one apple", "single apple", "number 1 sign"]),
             "TWO": (2, "two apples", ["two apples", "two eggs", "number 2 sign"]),
             "THREE": (3, "three apples", ["three apples", "three balls", "number 3 sign"]),
             "FOUR": (4, "four apples", ["four apples", "four eggs", "number 4 sign"]),
             "FIVE": (5, "five fingers on a hand", ["five apples", "five fingers hand", "number 5 sign"]),
             "SIX": (6, "six eggs", ["six eggs", "six apples", "number 6 sign"]),
             "SEVEN": (7, "seven objects", ["seven apples", "number 7 sign", "seven"]),
             "EIGHT": (8, "eight objects", ["eight eggs", "number 8 sign", "eight"]),
             "NINE": (9, "nine objects", ["nine balls", "number 9 sign", "nine"]),
             "TEN": (10, "ten fingers", ["ten fingers hands", "number 10 sign", "ten eggs"])}
for wd, (n, thing, qs) in SMALL_NUM.items():
    O[f"numbers|{wd}"] = dict(q=qs, p=[f"a photo of {thing}", f"a photo of exactly {wd.lower()} things", f"the number {n}"], text_ok=True)
O["numbers|ZERO"]["p"] = ["a photo of the number 0", "a photo of an empty plate with nothing on it", "zero, nothing"]
BIG_NUM = {"ELEVEN": 11, "TWELVE": 12, "THIRTEEN": 13, "FOURTEEN": 14, "FIFTEEN": 15, "SIXTEEN": 16, "SEVENTEEN": 17,
           "EIGHTEEN": 18, "NINETEEN": 19, "TWENTY": 20, "THIRTY": 30, "FORTY": 40, "FIFTY": 50, "SIXTY": 60, "SEVENTY": 70,
           "EIGHTY": 80, "NINETY": 90, "HUNDRED": 100, "THOUSAND": 1000, "MILLION": 1000000}
for wd, n in BIG_NUM.items():
    O[f"numbers|{wd}"] = dict(q=[f"number {n} sign", f"house number {n}", f"{n} sign", f"speed limit {n}" if n <= 120 else f"{n} banknote"],
                              p=[f"a photo of a sign showing the number {n}", f"the number {n}", f"{n} written in big digits"], text_ok=True)
O["numbers|THOUSAND"].update(q=["1000 baht banknote", "number 1000", "1000 sign"], p=["a photo of the number 1000", "a 1000 banknote", "1000 written in big digits"])
O["numbers|MILLION"].update(q=["million", "1000000", "pile of banknotes", "lots of coins"], p=["a photo of a huge pile of money", "the number 1,000,000"])
O["numbers|HUNDRED"].update(q=["number 100 sign", "100 baht banknote", "100 sign"])
O["numbers|FIRST"] = dict(q=["first place podium", "gold medal winner", "1st place"], p=["a photo of a winner in first place with a gold medal", "1st place"], text_ok=True)
O["numbers|SECOND"] = dict(q=["silver medal second place", "2nd place podium"], p=["a photo of a second place silver medal", "2nd place"], text_ok=True)
O["numbers|THIRD"] = dict(q=["bronze medal third place", "3rd place podium"], p=["a photo of a third place bronze medal", "3rd place"], text_ok=True)
O["numbers|HALF"] = dict(q=["half apple", "orange cut in half", "apple cut in half"], p=["a photo of a fruit cut in half", "one half of an apple"])

# --- shapes ---
o("shapes|CIRCLE", q=["round circle object", "circle shape", "round plate"], p=["a photo of a round circle shaped object", "a circle"])
o("shapes|SQUARE", q=["square shape", "square tile", "square object"], p=["a photo of a square shaped object", "a square"])
o("shapes|TRIANGLE", q=["triangle road sign", "triangle shape", "triangle object"], p=["a photo of a triangle shaped object", "a triangle"])
o("shapes|STAR", q=["star shaped cookie", "star shaped object", "star shape"], p=["a photo of a star shaped object", "a five-pointed star"], neg=["a photo of stars in the night sky"])
o("shapes|HEART", q=["heart shape", "heart shaped object", "heart shaped cookie"], p=["a photo of a heart shaped object", "a heart shape"], neg=["a photo of an anatomical human heart"])
o("shapes|RECTANGLE", q=["rectangle shape", "rectangular object", "rectangle"], p=["a photo of a rectangle shaped object", "a rectangle"])
o("shapes|OVAL", q=["oval shape", "oval mirror", "oval object"], p=["a photo of an oval shaped object", "an oval"])
o("shapes|DIAMOND", q=["diamond shape sign", "rhombus shape", "diamond shaped object"], p=["a photo of a diamond (rhombus) shaped object", "a rhombus"])
o("shapes|PENTAGON", q=["pentagon shape", "pentagonal object", "pentagon"], p=["a photo of a pentagon shaped object", "a five-sided pentagon"], neg=["a photo of the Pentagon building in Washington"])
o("shapes|HEXAGON", q=["honeycomb hexagon", "hexagon shape", "hexagonal object"], p=["a photo of a hexagon shaped object", "a six-sided hexagon"])
o("shapes|CUBE", q=["cube", "wooden cube", "Rubik's cube"], p=["a photo of a cube", "a cube shaped object"])
o("shapes|CRESCENT", q=["crescent moon", "crescent shape"], p=["a photo of a crescent moon", "a crescent shape"])
o("shapes|OVAL EGG", q=["egg", "chicken egg white background", "egg shape"], p=["a photo of an egg, an oval egg shape"])
o("shapes|LINE", q=["straight line", "road line marking", "line"], p=["a photo of a long straight line"], text_ok=True)
o("shapes|ARROW", q=["arrow sign", "arrow road marking", "arrow"], p=["a photo of an arrow sign", "an arrow shape"], text_ok=True)

# --- feelings ---
FEEL = {"HAPPY": ["happy child", "smiling child", "happy face"], "SAD": ["sad child", "sad face", "sad girl"],
        "ANGRY": ["angry child", "angry face", "angry boy"], "SCARED": ["scared child", "frightened face", "scared"],
        "TIRED": ["tired child", "tired person yawning", "exhausted"], "HUNGRY": ["hungry child eating", "hungry child", "child eating"],
        "THIRSTY": ["child drinking water", "thirsty drinking", "girl drinking water"], "SICK": ["sick child in bed", "sick child thermometer", "ill child"],
        "SURPRISED": ["surprised child", "surprised face", "surprise"], "EXCITED": ["excited child", "excited children cheering", "excited"],
        "BORED": ["bored child", "bored face", "boredom"], "SHY": ["shy child", "shy girl", "shyness"],
        "PROUD": ["proud child trophy", "proud student", "proud"], "NERVOUS": ["nervous child", "nervous person biting nails", "anxious"],
        "SLEEPY": ["sleepy child yawning", "yawning child", "sleepy"], "CALM": ["calm child meditating", "calm relaxed person", "calm"],
        "LONELY": ["lonely child", "alone child sitting", "loneliness"], "BRAVE": ["brave child", "child firefighter costume brave", "courage"],
        "LOVE": ["mother hugging child", "love family hug", "love heart"], "WORRIED": ["worried child", "worried face", "worry"],
        "CONFUSED": ["confused child", "confused face", "puzzled person"], "SILLY": ["silly face child", "funny face child", "silly"],
        "GRUMPY": ["grumpy child", "grumpy face", "frown"], "CURIOUS": ["curious child magnifying glass", "curious child", "curiosity"],
        "THANKFUL": ["thank you child", "grateful person", "thankful"], "SORRY": ["child apologizing", "sorry apology", "apologize"],
        "HURT": ["child with bandage knee", "child hurt crying", "hurt knee"], "FULL": ["full after meal", "child full stomach", "satisfied after eating"],
        "COLD": ["child shivering cold", "child cold winter scarf", "cold person"], "HOT": ["child sweating hot day", "hot summer sweating", "child fan heat"]}
FEEL_P = {"HUNGRY": "a photo of a hungry child", "THIRSTY": "a photo of a thirsty child drinking water", "SICK": "a photo of a sick child",
          "LOVE": "a photo of a loving hug", "HURT": "a photo of a child who got hurt", "FULL": "a photo of a person who is full after eating",
          "COLD": "a photo of a child feeling cold in winter", "HOT": "a photo of a child feeling hot and sweaty", "SORRY": "a photo of a child saying sorry",
          "THANKFUL": "a photo of a thankful person", "BRAVE": "a photo of a brave child"}
for wd, qs in FEEL.items():
    O[f"feelings|{wd}"] = dict(q=qs, p=[FEEL_P.get(wd, f"a photo of a {wd.lower()} child"), f"a person who looks {wd.lower()}"])

# --- opposites: concrete exemplar for each ---
OPP = {
 "BIG": (["big elephant", "large elephant"], "a photo of something very big, a huge elephant"),
 "SMALL": (["small mouse", "tiny kitten", "tiny"], "a photo of something very small and tiny"),
 "TALL": (["tall giraffe", "tall tower"], "a photo of something very tall"),
 "SHORT": (["short pencil", "short and tall"], "a photo of something short"),
 "LONG": (["long train", "long snake", "long bridge"], "a photo of something very long"),
 "FAST": (["race car speed", "cheetah running", "fast"], "a photo of something moving very fast"),
 "SLOW": (["snail", "tortoise walking", "slow"], "a photo of something very slow, a snail"),
 "HOT": (["hot coffee steam", "campfire", "hot"], "a photo of something hot"),
 "COLD": (["ice cubes", "snow cold", "cold"], "a photo of something cold, ice"),
 "NEW": (["new shoes box", "brand new", "new car"], "a photo of something brand new and shiny"),
 "OLD": (["old car rusty", "old house", "old"], "a photo of something old and worn"),
 "YOUNG": (["young child", "baby", "young"], "a photo of a young child"),
 "HAPPY": (["happy child", "smiling child"], "a photo of a happy child"),
 "SAD": (["sad child", "sad face"], "a photo of a sad child"),
 "CLEAN": (["clean room", "clean dishes", "clean"], "a photo of something clean and tidy"),
 "DIRTY": (["dirty hands mud", "muddy child", "dirty"], "a photo of something dirty and muddy"),
 "WET": (["wet dog", "wet", "rain wet"], "a photo of something wet"),
 "DRY": (["dry cracked earth", "dry towel", "dry"], "a photo of something dry"),
 "FULL": (["full glass of water", "full basket", "full"], "a photo of a full glass"),
 "EMPTY": (["empty glass", "empty box", "empty"], "a photo of an empty glass or box"),
 "OPEN": (["open door", "open box", "open"], "a photo of an open door"),
 "CLOSED": (["closed door", "closed sign", "closed"], "a photo of a closed door"),
 "UP": (["stairs going up", "arrow up", "up"], "a photo showing up, going up"),
 "DOWN": (["child slide going down", "stairs down", "down"], "a photo showing down, going down"),
 "IN": (["cat in a box", "in box", "inside"], "a photo of a cat inside a box"),
 "OUT": (["exit sign out", "cat out of box", "out"], "a photo of going out"),
 "LEFT": (["turn left sign", "left arrow sign", "left"], "a sign pointing left"),
 "RIGHT": (["turn right sign", "right arrow sign", "right"], "a sign pointing right"),
 "FRONT": (["front view car", "front of house", "front"], "a photo of the front of something"),
 "BACK": (["back view person", "rear view car", "back"], "a photo of the back of something"),
 "NEAR": (["close up", "near", "nearby"], "a photo of something very near and close"),
 "FAR": (["far away road horizon", "distant mountains", "far"], "a photo of something far away in the distance"),
 "HEAVY": (["heavy weightlifting", "heavy rock", "heavy"], "a photo of something very heavy"),
 "LIGHT": (["feather", "light feather", "light"], "a photo of something very light, a feather"),
 "HARD": (["hard rock stone", "hard hat", "hard"], "a photo of something hard, a rock"),
 "SOFT": (["soft pillow", "soft toy", "soft"], "a photo of something soft and fluffy"),
 "LOUD": (["loudspeaker", "child shouting megaphone", "loud"], "a photo of something loud"),
 "QUIET": (["quiet library", "shh finger on lips", "quiet"], "a photo of being quiet, shh"),
 "EASY": (["easy puzzle child", "easy", "simple"], "a photo of something easy"),
 "DIFFICULT": (["difficult puzzle", "rock climbing difficult", "difficult"], "a photo of something difficult"),
 "RICH": (["gold coins treasure", "money pile", "rich"], "a photo of lots of money and gold"),
 "POOR": (["empty wallet", "empty pockets", "poor"], "a photo of an empty wallet"),
 "STRONG": (["strong man lifting", "weightlifter", "strong"], "a photo of a strong person lifting weights"),
 "WEAK": (["wilted flower", "tired weak", "weak"], "a photo of something weak"),
 "THICK": (["thick book", "thick", "thick rope"], "a photo of a very thick book"),
 "THIN": (["thin book", "thin pencil", "thin"], "a photo of something thin"),
 "SWEET": (["candy sweets", "sweet desserts", "sweet"], "a photo of sweet candy"),
 "SOUR": (["lemon sour face", "sour lemon", "sour"], "a photo of something sour, lemons"),
 "SAME": (["identical eggs", "identical twins", "same"], "a photo of things that are exactly the same"),
 "DIFFERENT": (["different fruits", "assorted", "different"], "a photo of different things"),
}
for wd, (qs, p) in OPP.items():
    O[f"opposites|{wd}"] = dict(q=qs, p=[p], text_ok=wd in ("LEFT", "RIGHT", "UP", "OUT", "CLOSED"))
    if wd in ("HAPPY", "SAD", "YOUNG", "STRONG"): O[f"opposites|{wd}"]["mode"] = "person"

# --- time ---
for d in "MONDAY TUESDAY WEDNESDAY THURSDAY FRIDAY SATURDAY SUNDAY".split():
    O[f"time|{d}"] = dict(q=[f"{d.title()} calendar", f"{d.title()} sign", d.title()], p=[f"the word {d.title()} written on a calendar or sign", f"{d.title()}"], text_ok=True)
MONTH_HINT = {"JANUARY": "New Year fireworks", "FEBRUARY": "Valentine heart", "MARCH": "spring flowers", "APRIL": "Songkran water festival",
              "MAY": "flowers", "JUNE": "rainy season", "JULY": "summer", "AUGUST": "summer", "SEPTEMBER": "back to school",
              "OCTOBER": "Halloween pumpkins", "NOVEMBER": "Loy Krathong", "DECEMBER": "Christmas tree"}
for m, hint in MONTH_HINT.items():
    O[f"time|{m}"] = dict(q=[f"{m.title()} calendar", hint, f"{m.title()} sign"], p=[f"a calendar page for {m.title()}", f"{m.title()}: {hint}"], text_ok=True)
o("time|TODAY", q=["calendar today", "calendar date", "calendar"], p=["a calendar showing today's date"], text_ok=True)
o("time|TOMORROW", q=["calendar next day", "calendar page", "sunrise tomorrow"], p=["a calendar page, tomorrow"], text_ok=True)
o("time|YESTERDAY", q=["old calendar", "calendar torn page", "calendar"], p=["a calendar page, yesterday"], text_ok=True)
o("time|MORNING", q=["morning sunrise", "child waking up morning", "breakfast morning"], p=["a photo of the early morning with sunrise"])
o("time|AFTERNOON", q=["afternoon park sunshine", "afternoon", "afternoon tea"], p=["a photo of a sunny afternoon"])
o("time|EVENING", q=["evening sunset", "sunset city evening", "evening"], p=["a photo of the evening at sunset"])
o("time|NIGHT", q=["night sky moon", "city at night", "night"], p=["a photo of the night with the moon"])
o("time|WEEK", q=["weekly calendar", "week calendar", "planner week"], p=["a weekly calendar with seven days"], text_ok=True)
o("time|MONTH", q=["monthly calendar", "calendar month", "wall calendar"], p=["a monthly wall calendar"], text_ok=True)
o("time|YEAR", q=["year calendar", "new year fireworks", "annual calendar"], p=["a calendar for the whole year", "new year"], text_ok=True)
o("time|HOUR", q=["hourglass", "sand timer", "hour"], p=["a photo of an hourglass"], mode="object")
o("time|MINUTE", q=["stopwatch", "minute timer", "kitchen timer"], p=["a photo of a stopwatch timer"], mode="object")
o("time|O'CLOCK", q=["clock three o'clock", "analog clock face", "wall clock"], p=["a photo of an analog clock showing the hour exactly"], mode="object")
o("time|BIRTHDAY", q=["birthday cake candles", "birthday party children", "birthday"], p=["a photo of a birthday cake with candles"], mode="object")
o("time|HOLIDAY", q=["family vacation beach", "holiday beach", "holiday travel"], p=["a photo of a family on holiday at the beach"])
o("time|WEEKEND", q=["family picnic weekend", "weekend park family", "picnic"], p=["a photo of a family relaxing on the weekend"])

# --- actions ---
ACT = {
 "PLAY": (["children playing", "kids playing playground"], "children playing together"),
 "WASH": (["washing hands", "child washing hands"], "washing hands with soap"),
 "READ": (["child reading book"], "a child reading a book"),
 "WRITE": (["child writing", "writing with pencil"], "a child writing with a pencil"),
 "DRAW": (["child drawing", "drawing with crayons"], "a child drawing a picture"),
 "OPEN": (["opening door", "opening box", "open gift"], "a person opening a door or box"),
 "CLOSE": (["closing door", "closing a book", "close door"], "a person closing a door"),
 "THROW": (["throwing ball", "child throwing ball"], "a child throwing a ball"),
 "CATCH": (["catching ball", "child catching ball"], "a child catching a ball"),
 "KICK": (["kicking ball", "child kicking football"], "a child kicking a ball"),
 "LOOK": (["looking through binoculars", "child looking"], "a child looking at something"),
 "SEE": (["child looking binoculars", "looking at view"], "a child seeing through binoculars"),
 "HEAR": (["child listening hand on ear", "hand behind ear"], "a person cupping their ear to hear"),
 "LISTEN": (["child listening headphones", "listening to music"], "a child listening with headphones"),
 "SMELL": (["smelling flower", "child smelling flower"], "a child smelling a flower"),
 "TOUCH": (["touching", "child touching", "hand touching"], "a hand touching something"),
 "TASTE": (["tasting food", "child tasting", "tasting spoon"], "a person tasting food from a spoon"),
 "SPEAK": (["person speaking microphone", "speaking", "speech"], "a person speaking"),
 "SAY": (["talking", "person talking", "conversation"], "a person saying something"),
 "ASK": (["student raising hand", "raising hand question"], "a student raising a hand to ask a question"),
 "ANSWER": (["student answering", "answer", "raising hand classroom"], "a student answering a question"),
 "HELP": (["helping hand", "helping elderly", "children helping"], "a person helping another person"),
 "GIVE": (["giving gift", "giving present", "giving flowers"], "a person giving a gift"),
 "TAKE": (["taking cookie", "hand taking", "taking"], "a hand taking something"),
 "BUY": (["buying fruit market", "customer buying", "shopping"], "a person buying something at a shop"),
 "SELL": (["market vendor selling", "selling fruit", "street seller"], "a vendor selling things"),
 "PAY": (["paying cash", "paying money", "payment card"], "a person paying with money"),
 "WAIT": (["waiting bus stop", "people waiting queue", "waiting"], "people waiting in line"),
 "START": (["race start line", "starting line runners", "start"], "runners at the start line"),
 "FINISH": (["finish line race", "finish line", "marathon finish"], "a runner crossing the finish line"),
 "WIN": (["winner trophy celebration", "winning team celebrate", "winner"], "a winner holding a trophy"),
 "LOSE": (["losing team sad", "lost game disappointed", "defeat"], "a disappointed losing team"),
 "STOP": (["stop sign", "stop", "stop hand gesture"], "a stop sign"),
 "GO": (["green traffic light", "go sign", "go"], "a green traffic light meaning go"),
 "COME": (["come here gesture", "beckoning", "child running to mother"], "a person waving someone to come here"),
 "FLY": (["bird flying", "airplane flying", "flying"], "something flying in the sky"),
 "DRIVE": (["driving car", "person driving", "driver steering wheel"], "a person driving a car"),
 "RIDE": (["child riding bicycle", "riding bike", "riding horse"], "a child riding a bicycle"),
 "CARRY": (["carrying box", "carrying bag", "child carrying"], "a person carrying a box"),
 "BUILD": (["children building blocks", "building sandcastle", "construction building"], "children building something"),
 "BREAK": (["broken plate", "breaking", "broken glass"], "something broken into pieces"),
 "FIX": (["repairing bicycle", "fixing", "repair tools"], "a person fixing something with tools"),
 "CUT": (["cutting paper scissors", "cutting vegetables", "cutting"], "cutting with scissors or a knife"),
 "PAINT": (["child painting", "painting wall", "painting brush"], "a child painting with a brush"),
 "COLOR": (["child coloring", "coloring book crayons", "coloring"], "a child coloring a picture with crayons"),
 "FOLD": (["folding clothes", "folding paper origami", "folding"], "folding clothes or paper"),
 "CLEAN": (["cleaning", "child cleaning", "cleaning table"], "a person cleaning"),
 "SWEEP": (["sweeping floor broom", "sweeping", "broom sweeping"], "a person sweeping the floor with a broom"),
 "WIPE": (["wiping table", "wiping", "cleaning cloth wiping"], "a person wiping a table with a cloth"),
 "POUR": (["pouring water", "pouring milk", "pouring"], "pouring water into a glass"),
 "MIX": (["mixing bowl", "stirring", "mixing batter"], "mixing in a bowl with a spoon"),
 "BAKE": (["baking cookies", "baking oven", "child baking"], "baking cookies"),
 "FRY": (["frying pan", "frying egg", "deep frying"], "frying food in a pan"),
 "BOIL": (["boiling water pot", "boiling", "boiling pot"], "water boiling in a pot"),
 "FEED": (["feeding animals", "child feeding", "feeding ducks"], "a child feeding animals"),
 "WATER": (["watering plants", "watering can", "child watering garden"], "a child watering plants"),
 "PLANT": (["planting tree", "child planting", "planting seedling"], "a child planting a plant"),
 "PICK": (["picking fruit", "picking apples", "picking flowers"], "picking fruit from a tree"),
 "DIG": (["digging", "child digging sand", "digging shovel"], "digging with a shovel"),
 "WAKE UP": (["waking up", "waking up morning bed", "alarm clock waking"], "a child waking up in the morning"),
 "GET UP": (["getting out of bed", "getting up morning", "stretching in bed"], "a person getting out of bed"),
 "BRUSH": (["brushing teeth", "child brushing teeth", "toothbrush"], "a child brushing teeth"),
 "SHOWER": (["shower", "taking a shower", "shower head water"], "taking a shower"),
 "DRESS": (["child getting dressed", "getting dressed", "dressing"], "a child getting dressed"),
 "COMB": (["combing hair", "comb hair", "hair comb"], "combing hair"),
 "STUDY": (["student studying", "child studying", "studying"], "a student studying"),
 "LEARN": (["children learning", "learning classroom", "learning"], "children learning"),
 "TEACH": (["teacher teaching", "teaching children", "teaching"], "a teacher teaching children"),
 "THINK": (["child thinking", "thinking", "thinking person"], "a child thinking"),
 "KNOW": (["student raising hand", "know", "quiz"], "a child who knows the answer"),
 "REMEMBER": (["looking at photo album", "memories photos", "remembering"], "remembering, looking at old photos"),
 "FORGET": (["forgot", "forgetful", "confused"], "forgetting something"),
 "COUNT": (["counting fingers", "child counting", "counting"], "a child counting on fingers"),
 "SPELL": (["alphabet blocks", "spelling letters", "letter blocks"], "spelling a word with letter blocks"),
 "LOVE": (["heart hands", "hug love", "love"], "showing love with a hug or heart hands"),
 "LIKE": (["thumbs up", "thumbs up child", "like"], "a thumbs up"),
 "WANT": (["child pointing want", "child wanting toy", "wanting"], "a child who wants something"),
 "NEED": (["need help", "needing", "need"], "a person in need of something"),
 "SHARE": (["children sharing", "sharing food", "sharing toys"], "children sharing"),
 "WAVE": (["waving hand", "child waving", "waving goodbye"], "a child waving hello"),
 "HUG": (["hug", "children hugging", "hugging"], "people hugging"),
 "SMILE": (["smiling child", "smile", "smiling"], "a smiling child"),
 "CLAP": (["clapping hands", "applause", "clapping"], "a person clapping hands"),
 "LAUGH": (["laughing child", "laughing", "laughter"], "a laughing child"),
 "CRY": (["crying child", "crying", "tears"], "a crying child"),
 "SLEEP": (["sleeping child", "sleeping", "baby sleeping"], "a child sleeping"),
 "EAT": (["child eating", "eating", "eating food"], "a child eating"),
 "DRINK": (["child drinking", "drinking water", "drinking"], "a child drinking"),
}
for wd, (qs, p) in ACT.items():
    O[f"actions|{wd}"] = dict(q=qs, p=[f"a photo of {p}"])
for wd in ("STOP", "GO"): O[f"actions|{wd}"].update(mode="object", text_ok=True)
O["actions|SPELL"]["text_ok"] = True; O["actions|BREAK"]["mode"] = "object"; O["actions|BOIL"]["mode"] = "object"; O["actions|FLY"]["mode"] = "object"

# --- family ---
FAM = {"MOTHER": (["mother and child", "mother with baby", "mother"], "a mother with her child"),
       "FATHER": (["father and child", "father with son", "father"], "a father with his child"),
       "SISTER": (["sisters", "two sisters", "sister"], "two sisters"), "BROTHER": (["brothers", "two brothers", "brother"], "two brothers"),
       "GRANDMOTHER": (["grandmother", "grandmother with grandchild", "grandma"], "a grandmother, an old woman"),
       "GRANDFATHER": (["grandfather", "grandfather with grandchild", "grandpa"], "a grandfather, an old man"),
       "BABY": (["baby", "smiling baby", "infant"], "a baby"), "FAMILY": (["family portrait", "family", "happy family"], "a family together"),
       "AUNT": (["aunt and niece", "aunt", "woman with niece"], "an aunt with her niece"),
       "UNCLE": (["uncle and nephew", "uncle", "man with nephew"], "an uncle with his nephew"),
       "SON": (["father and son", "mother and son", "son"], "a parent with their son"),
       "DAUGHTER": (["mother and daughter", "father and daughter", "daughter"], "a parent with their daughter"),
       "PARENTS": (["parents with child", "parents", "mother father child"], "parents with their child"),
       "GRANDPARENTS": (["grandparents", "grandparents with grandchildren", "elderly couple"], "grandparents together"),
       "COUSIN": (["cousins children", "cousins", "children together"], "cousins, children of the same family"),
       "TWINS": (["twins", "identical twins children", "twin sisters"], "identical twins"),
       "HUSBAND": (["husband and wife", "married couple", "husband"], "a husband and wife"),
       "WIFE": (["wife and husband", "married couple", "wife"], "a wife and husband"),
       "FRIEND": (["friends children", "friends", "best friends"], "friends together"),
       "NEIGHBOR": (["neighbors talking", "neighbours", "neighbor"], "neighbors talking over a fence"),
       "ME": (["child pointing at himself", "selfie child", "child portrait"], "a child pointing at themself, me"),
       "BOY": (["boy", "young boy portrait", "little boy"], "a boy"), "GIRL": (["girl", "young girl portrait", "little girl"], "a girl"),
       "MAN": (["man portrait", "man", "adult man"], "a man"), "WOMAN": (["woman portrait", "woman", "adult woman"], "a woman")}
for wd, (qs, p) in FAM.items():
    O[f"family|{wd}"] = dict(q=qs, p=[f"a photo of {p}"])

# --- jobs ---
JOB_Q = {"COOK": ["cook kitchen", "cook cooking"], "POLICE": ["police officer", "policeman"], "DRIVER": ["bus driver", "driver"],
         "BUILDER": ["construction worker", "builder"], "VET": ["veterinarian with dog", "veterinarian"],
         "MAIL CARRIER": ["postman delivering mail", "mail carrier"], "FOOTBALL PLAYER": ["football player", "soccer player"],
         "SHOPKEEPER": ["shopkeeper", "shop owner in store"], "MONK": ["Buddhist monk Thailand", "Buddhist monk"],
         "PROGRAMMER": ["programmer computer", "software developer"], "DESIGNER": ["designer working", "fashion designer"],
         "JOURNALIST": ["journalist reporter", "reporter microphone"], "WRITER": ["writer writing", "author writing"],
         "PAINTER": ["painter painting canvas", "artist painting"], "ARTIST": ["artist painting", "artist"],
         "ARCHITECT": ["architect plans", "architect"], "CLEANER": ["cleaner", "janitor cleaning"],
         "SECURITY GUARD": ["security guard"], "CASHIER": ["cashier", "supermarket cashier"],
         "STREET VENDOR": ["street vendor Thailand", "street food vendor"], "TAXI DRIVER": ["taxi driver", "Bangkok taxi"],
         "FLIGHT ATTENDANT": ["flight attendant", "air hostess"], "CAPTAIN": ["ship captain", "captain"],
         "FARMER'S HELPER": ["farm worker", "farm labourer"], "FARMER": ["rice farmer", "farmer"],
         "KING": ["king costume", "king crown throne", "king"], "QUEEN": ["queen costume", "queen crown"],
         "PRINCE": ["prince costume", "prince"], "PRINCESS": ["princess costume", "princess dress girl"],
         "SUPERHERO": ["superhero costume child", "superhero costume"], "PIRATE": ["pirate costume", "pirate"],
         "CLOWN": ["clown", "circus clown"], "MAGICIAN": ["magician performing", "magician"],
         "ACCOUNTANT": ["accountant", "accountant calculator"], "LAWYER": ["lawyer", "lawyer court"],
         "SCIENTIST": ["scientist laboratory", "scientist"], "ENGINEER": ["engineer", "engineer helmet"],
         "ASTRONAUT": ["astronaut", "astronaut spacesuit"], "DENTIST": ["dentist", "dentist patient"],
         "SOLDIER": ["soldier", "soldier uniform"], "HAIRDRESSER": ["hairdresser", "barber cutting hair"],
         "MECHANIC": ["auto mechanic", "mechanic repairing car"], "PHOTOGRAPHER": ["photographer camera", "photographer"]}
for wd, qs in JOB_Q.items():
    O[f"jobs|{wd}"] = dict(q=qs)
O["jobs|COOK"]["p"] = ["a photo of a cook cooking in a kitchen"]
O["jobs|MONK"]["p"] = ["a photo of a Buddhist monk in orange robes"]
O["jobs|KING"]["p"] = ["a photo of a king wearing a crown"]; O["jobs|QUEEN"]["p"] = ["a photo of a queen wearing a crown"]
O["jobs|PRINCE"]["p"] = ["a photo of a prince"]; O["jobs|PRINCESS"]["p"] = ["a photo of a princess in a dress and tiara"]
O["jobs|FARMER'S HELPER"]["p"] = ["a photo of a farm worker helping on a farm"]

# --- body (kid-friendly) ---
BODY = {"HEART": (["human heart model", "anatomical heart model"], "an anatomical model of a human heart"),
        "BRAIN": (["human brain model", "brain model"], "a model of a human brain"),
        "BONE": (["human bone", "skeleton model", "bone"], "a human bone"),
        "BLOOD": (["blood drop finger", "blood test tube", "blood sample"], "a drop of red blood"),
        "SKIN": (["human skin", "skin hand", "skin"], "human skin"),
        "TEETH": (["teeth smile", "child teeth", "teeth"], "a smile showing teeth"),
        "TOOTH": (["human tooth", "tooth", "baby tooth"], "a human tooth"),
        "TONGUE": (["child sticking out tongue", "tongue out"], "a person sticking out their tongue"),
        "BODY": (["child full body", "person standing full body"], "a whole human body standing"),
        "FACE": (["child face", "smiling face portrait"], "a child's face"),
        "HEAD": (["human head", "child head", "head"], "a person's head"),
        "HAIR": (["long hair", "child hair", "hair"], "a person's hair"),
        "BACK": (["person's back", "back of a man", "back"], "the back of a person"),
        "STOMACH": (["belly", "human abdomen", "tummy"], "a person's belly"),
        "THUMB": (["thumb", "thumbs up", "human thumb"], "a thumb"),
        "NAIL": (["fingernails", "fingernail", "nails"], "fingernails"),
        "BEARD": (["man with beard", "beard"], "a man with a beard"),
        "MUSTACHE": (["man with mustache", "moustache"], "a man with a mustache"),
        "EYE": (["human eye", "eye close-up"], "a human eye"), "EAR": (["human ear"], "a human ear"),
        "NOSE": (["human nose", "nose"], "a human nose"), "MOUTH": (["human mouth", "smiling mouth"], "a human mouth"),
        "LIPS": (["lips", "human lips"], "human lips"), "CHIN": (["chin", "human chin"], "a chin"),
        "CHEEK": (["cheek", "child cheek"], "a cheek"), "EYEBROW": (["eyebrow", "eyebrows"], "an eyebrow"),
        "HIP": (["hip", "hands on hips"], "hips"), "CHEST": (["chest", "human chest"], "a person's chest"),
        "WRIST": (["wrist", "human wrist"], "a wrist"), "ANKLE": (["ankle", "human ankle"], "an ankle"),
        "KNEE": (["knee", "human knee"], "a knee"), "ELBOW": (["elbow", "human elbow"], "an elbow"),
        "TOE": (["toes", "human toes"], "toes"), "FINGER": (["finger", "pointing finger"], "a finger"),
        "SHOULDER": (["shoulder", "human shoulder"], "a shoulder"), "NECK": (["neck", "human neck"], "a neck")}
for wd, (qs, p) in BODY.items():
    O[f"body|{wd}"] = dict(q=qs, p=[f"a photo of {p}"])

# --- countries: landmark of each ---
LAND = {"THAILAND": "Wat Arun Bangkok", "JAPAN": "Mount Fuji", "CHINA": "Great Wall of China", "KOREA": "Gyeongbokgung palace Seoul",
        "INDIA": "Taj Mahal", "VIETNAM": "Ha Long Bay", "LAOS": "Pha That Luang Vientiane", "MYANMAR": "Shwedagon Pagoda",
        "CAMBODIA": "Angkor Wat", "MALAYSIA": "Petronas Towers", "SINGAPORE": "Merlion Singapore", "AUSTRALIA": "Sydney Opera House",
        "ENGLAND": "Big Ben London", "AMERICA": "Statue of Liberty", "FRANCE": "Eiffel Tower", "ITALY": "Colosseum Rome",
        "EGYPT": "Pyramids of Giza", "BRAZIL": "Christ the Redeemer Rio"}
for wd, lm in LAND.items():
    O[f"countries|{wd}"] = dict(q=[lm, f"{lm} view"], p=[f"a photo of {lm} in {wd.title()}", f"a famous landmark of {wd.title()}"])
o("countries|WORLD", q=["Earth from space", "globe", "Blue Marble"], p=["a photo of planet Earth from space", "a world globe"], mode="object")
o("countries|FLAG", q=["flags waving", "flag on flagpole", "flags of the world"], p=["a photo of flags waving on flagpoles"], mode="object")

# --- places / nature / home / weather: misc ---
o("places|HOME", q=["house", "family house", "home"], p=["a photo of a family house, a home"])
o("places|GARDEN", q=["flower garden", "garden"], p=["a photo of a flower garden"])
o("places|POST OFFICE", q=["post office", "Thailand Post office"], p=["a photo of a post office"])
o("places|TEMPLE", q=["Thai temple", "Buddhist temple Thailand", "wat"], p=["a photo of a Thai Buddhist temple"])
o("places|MARKET", q=["Thai market", "fresh market", "market stalls"], p=["a photo of a market with stalls"])
o("places|BANK", q=["bank branch", "bank building"], p=["a photo of a bank building"])
o("places|CAFE", q=["cafe", "coffee shop"], p=["a photo of a cafe, a coffee shop"])
o("places|FLOATING MARKET", q=["floating market Thailand", "Damnoen Saduak floating market"], p=["a photo of a floating market with boats"])
o("places|NIGHT MARKET", q=["night market Thailand", "night market"], p=["a photo of a night market"])
o("places|CONVENIENCE STORE", q=["convenience store", "7-Eleven Thailand"], p=["a photo of a convenience store"])
o("places|ZOO", q=["zoo animals visitors", "zoo"], p=["a photo of a zoo with animals"])
o("places|FARM", q=["farm", "farm barn"], p=["a photo of a farm"])
o("places|PLAYGROUND", q=["playground children", "playground"], p=["a photo of a children's playground"])
o("places|TOWER", q=["tower", "tall tower"], p=["a photo of a tall tower"])
o("places|ISLAND", q=["tropical island", "island Thailand"], p=["a photo of a tropical island"])
o("places|JUNGLE", q=["jungle", "tropical rainforest"], p=["a photo of a jungle"])
o("places|PALACE", q=["Grand Palace Bangkok", "palace"], p=["a photo of a palace"])
o("places|HARBOR", q=["harbor boats", "harbour"], p=["a photo of a harbor with boats"])
for w in ["MOUNTAIN", "RIVER", "OCEAN", "GRASS", "LAKE", "FOREST", "DESERT", "ISLAND", "CAVE", "WATERFALL", "VOLCANO", "RAINBOW", "SKY",
          "SAND", "WAVE", "HILL", "FIELD", "POND", "SEA", "STREAM", "SOIL", "MUD", "SPACE", "AIR"]:
    O.setdefault(f"nature|{w}", {})["mode"] = "scene"
O["nature|STAR"] = dict(q=["starry night sky", "stars night sky"], p=["a photo of stars in the night sky"], mode="scene", neg=["a star shaped object"])
O["nature|SUN"] = dict(q=["the sun in the sky", "sun", "sunshine sky"], p=["a photo of the bright sun in the sky"])
O["nature|MOON"] = dict(q=["full moon", "moon"], p=["a photo of the moon"])
O["nature|EARTH"] = dict(q=["Earth from space", "Blue Marble"], p=["a photo of planet Earth from space"])
O["nature|PLANET"] = dict(q=["planet Saturn", "planet Jupiter", "planet"], p=["a photo of a planet in space"])
O["nature|SPACE"] = dict(q=["outer space", "nebula", "galaxy"], p=["a photo of outer space with stars"], mode="scene")
O["nature|AIR"] = dict(q=["blowing bubbles", "fresh air sky", "wind air balloon"], p=["a photo about air, blowing in the wind"], mode="scene")
O["nature|SMOKE"] = dict(q=["smoke", "smoke rising"], p=["a photo of smoke"], mode="scene")
O["nature|FIRE"] = dict(q=["campfire", "fire flames"], p=["a photo of a campfire fire"])
O["nature|WAVE"] = dict(q=["ocean wave", "sea wave"], p=["a photo of an ocean wave"], mode="scene")
O["nature|SOIL"] = dict(q=["soil", "garden soil hands"], p=["a photo of soil"], mode="scene")
O["nature|SEED"] = dict(q=["seeds", "seed sprouting"], p=["a photo of seeds"])
O["nature|SHELL"] = dict(q=["seashell", "seashells beach"], p=["a photo of a seashell"])
O["nature|ROOT"] = dict(q=["tree roots", "plant roots"], p=["a photo of plant roots"])
O["nature|BRANCH"] = dict(q=["tree branch"], p=["a photo of a tree branch"])
O["nature|BUSH"] = dict(q=["bush shrub", "shrub"], p=["a photo of a bush"])
O["nature|LOTUS"] = dict(q=["lotus flower", "Nelumbo nucifera flower"], p=["a photo of a lotus flower"])
O["nature|ORCHID"] = dict(q=["orchid flower"], p=["a photo of an orchid flower"])
O["nature|ROCK"] = dict(q=["rock boulder", "rock"], p=["a photo of a big rock"])
O["nature|STONE"] = dict(q=["stones pebbles", "stone"], p=["a photo of stones"])
O["nature|LEAF"] = dict(q=["green leaf", "leaf"], p=["a photo of a green leaf"])
O["nature|CLOUD"] = dict(q=["cumulus cloud", "white cloud blue sky"], p=["a photo of a white cloud in the blue sky"], mode="scene")
O["nature|TREE"] = dict(q=["tree", "big tree"], p=["a photo of a single tree"])

o("weather|SUN", q=["sun shining sky", "sunny sky"], p=["a photo of the bright sun shining in the sky"])
o("weather|SUNNY", q=["sunny day", "sunny weather beach"], p=["a photo of a bright sunny day"])
o("weather|HOT", q=["hot weather sun", "thermometer hot sun", "heat wave"], p=["a photo of very hot weather"])
o("weather|COLD", q=["cold weather snow", "winter cold", "frost"], p=["a photo of cold snowy weather"])
o("weather|SNOWMAN", q=["snowman"], p=["a photo of a snowman"], mode="object")
o("weather|ICE", q=["ice", "ice cubes", "icicles"], p=["a photo of ice"], mode="object")
o("weather|TEMPERATURE", q=["thermometer", "outdoor thermometer"], p=["a photo of a thermometer"], mode="object", text_ok=True)
o("weather|HUMID", q=["humid weather", "condensation window", "humidity"], p=["a photo of humid, misty weather"])
o("weather|WARM", q=["warm sunny day", "warm weather"], p=["a photo of warm, pleasant weather"])
o("weather|THUNDER", q=["lightning", "lightning storm"], p=["a photo of lightning in a storm"])
o("weather|DRY", q=["drought", "dry cracked earth"], p=["a photo of dry cracked land"])
o("weather|FLOOD", q=["flood", "flooded street"], p=["a photo of a flood"])
o("weather|SPRING", q=["spring blossoms", "cherry blossom spring"], p=["a photo of spring with blossoms"])
o("weather|SUMMER", q=["summer beach", "summer"], p=["a photo of summer at the beach"])
o("weather|AUTUMN", q=["autumn leaves", "autumn trees"], p=["a photo of autumn with orange leaves"])
o("weather|WINTER", q=["winter snow", "winter landscape"], p=["a photo of winter with snow"])
o("weather|WINDY", q=["windy day trees", "windy weather"], p=["a photo of windy weather"])
o("weather|WIND", q=["wind blowing trees", "wind turbine", "windsock"], p=["a photo of wind blowing"])
o("weather|FOG", q=["fog", "mist"], p=["a photo of fog"])
o("weather|DRIZZLE", q=["drizzle", "light rain"], p=["a photo of light drizzle rain"])
o("weather|HAIL", q=["hailstones", "hail"], p=["a photo of hailstones"], mode="object")
o("weather|TYPHOON", q=["typhoon", "typhoon storm"], p=["a photo of a typhoon storm"])
o("weather|TORNADO", q=["tornado"], p=["a photo of a tornado"])
o("weather|RAINBOW", q=["rainbow"], p=["a photo of a rainbow in the sky"])

o("home|PHONE", q=["telephone", "smartphone"], p=["a photo of a phone"])
o("home|PHOTO", q=["photo frame", "framed photograph"], p=["a photo of a framed photograph"])
o("home|LIGHT SWITCH", q=["light switch"], p=["a photo of a light switch on a wall"])
o("home|GLASS", q=["drinking glass", "glass of water"], p=["a photo of a drinking glass"])
o("home|FAN", q=["electric fan"], p=["a photo of an electric fan"])
o("home|AIR CONDITIONER", q=["air conditioner"], p=["a photo of an air conditioner"])
o("home|KEY", q=["house key", "keys"], p=["a photo of a key"])
o("home|POT", q=["cooking pot"], p=["a photo of a cooking pot"])
o("home|PAN", q=["frying pan"], p=["a photo of a frying pan"])
o("home|RICE COOKER", q=["rice cooker"], p=["a photo of an electric rice cooker"])
o("home|BATH", q=["bathtub"], p=["a photo of a bathtub"])
o("home|SHOWER", q=["shower head", "shower"], p=["a photo of a shower"])
o("home|TRASH CAN", q=["trash can", "waste bin"], p=["a photo of a trash can"])
o("home|DRAWER", q=["drawer open", "chest of drawers"], p=["a photo of a drawer"])
o("home|HANGER", q=["clothes hanger"], p=["a photo of a clothes hanger"])
for w in ["LIVING ROOM", "BEDROOM", "BATHROOM", "KITCHEN", "GARAGE", "GARDEN", "BALCONY", "ROOF", "WALL", "FLOOR", "STAIRS", "FENCE"]:
    O.setdefault(f"home|{w}", {})["mode"] = "scene"

o("technology|MOUSE", q=["computer mouse"], p=["a photo of a computer mouse"], neg=["a photo of a mouse animal"])
o("technology|SCREEN", q=["computer monitor", "screen display"], p=["a photo of a computer screen"])
o("technology|SPEAKER", q=["loudspeaker", "bluetooth speaker"], p=["a photo of a loudspeaker"])
o("technology|WIFI", q=["wifi sign", "wifi router", "wi-fi"], p=["a photo of a wifi sign or router"], text_ok=True)
o("technology|INTERNET", q=["internet cafe", "children using computer", "internet"], p=["children using the internet on a computer"])
o("technology|EMAIL", q=["email on smartphone", "email laptop screen", "email"], p=["an email inbox on a screen"], text_ok=True)
o("technology|PASSWORD", q=["password login screen", "password", "login"], p=["a password login screen"], text_ok=True)
o("technology|APP", q=["smartphone apps home screen", "smartphone apps", "mobile app"], p=["a smartphone screen with apps"], text_ok=True)
o("technology|SCREENSHOT", q=["smartphone screen", "taking screenshot phone", "phone screen"], p=["a smartphone showing its screen"], text_ok=True)
o("technology|VIDEO GAME", q=["child playing video game", "video game console", "gamepad"], p=["a child playing a video game"])
o("technology|ROBOT VACUUM", q=["robot vacuum cleaner", "Roomba"], p=["a photo of a robot vacuum cleaner"])
o("technology|REMOTE", q=["remote control", "TV remote"], p=["a photo of a TV remote control"])
o("technology|CLOCK", q=["digital clock", "alarm clock"], p=["a photo of a digital clock"], text_ok=True)
o("technology|CABLE", q=["USB cable", "cable"], p=["a photo of a USB cable"])
o("technology|BATTERY", q=["AA batteries", "battery"], p=["a photo of batteries"])
o("technology|CHARGER", q=["phone charger", "USB charger"], p=["a photo of a phone charger"])
o("technology|DRONE", q=["quadcopter drone", "drone flying"], p=["a photo of a quadcopter drone"])
o("technology|SATELLITE", q=["satellite in orbit", "satellite"], p=["a photo of a satellite"])
o("technology|CAMERA", q=["digital camera", "camera"], p=["a photo of a camera"])
o("technology|TABLET", q=["tablet computer", "iPad"], p=["a photo of a tablet computer"])

o("sports|BAT", q=["baseball bat", "cricket bat"], p=["a photo of a baseball bat"], neg=["a photo of a bat animal"])
o("sports|NET", q=["volleyball net", "tennis net"], p=["a photo of a sports net"], mode="object")
o("sports|GOAL", q=["football goal", "soccer goal net"], p=["a photo of a football goal"], mode="object")
o("sports|TROPHY", q=["trophy cup", "trophy"], p=["a photo of a trophy cup"], mode="object")
o("sports|MEDAL", q=["gold medal", "medal"], p=["a photo of a medal"], mode="object")
o("sports|RACKET", q=["tennis racket", "badminton racket"], p=["a photo of a racket"], mode="object")
o("sports|WHISTLE", q=["whistle", "sports whistle"], p=["a photo of a whistle"], mode="object")
o("sports|RUNNING SHOES", q=["running shoes", "sneakers running"], p=["a photo of running shoes"], mode="object")
o("sports|SKATEBOARD", q=["skateboard", "skateboarding"], p=["a photo of a skateboard"], mode="object")
o("sports|CHESS", q=["chess board", "chess pieces", "children playing chess"], p=["a photo of a chess game"], mode="object")
o("sports|TEAM", q=["sports team photo", "football team", "team"], p=["a photo of a sports team"])
o("sports|COACH", q=["coach with team", "sports coach", "coach"], p=["a photo of a sports coach"])
o("sports|JUMP", q=["long jump", "jumping", "high jump"], p=["a photo of an athlete jumping"])
o("sports|JUMP ROPE", q=["jump rope child", "skipping rope"], p=["a photo of a child jumping rope"])
o("sports|RACE", q=["running race", "race"], p=["a photo of a running race"])
o("sports|MARATHON", q=["marathon runners"], p=["a photo of marathon runners"])
o("sports|STRETCH", q=["stretching exercise"], p=["a photo of a person stretching"])
o("sports|EXERCISE", q=["exercise", "children exercise"], p=["a photo of people exercising"])
o("sports|PUSH-UP", q=["push-up", "push ups"], p=["a photo of a person doing push-ups"])
o("sports|FISHING", q=["fishing", "fishing rod"], p=["a photo of a person fishing with a rod"])

o("music|RANAT", q=["ranat ek", "Thai xylophone ranat"], p=["a photo of a ranat ek, a Thai xylophone"])
o("music|KHIM", q=["khim Thai dulcimer", "khim instrument", "hammered dulcimer"], p=["a photo of a khim, a Thai hammered dulcimer"])
o("music|SONG", q=["children singing", "singing song", "sheet music"], p=["a photo of children singing a song"], mode="person")
o("music|SINGER", q=["singer microphone", "singer"], p=["a photo of a singer singing"], mode="person")
o("music|CONCERT", q=["concert", "concert stage"], p=["a photo of a concert"], mode="scene")
o("music|MICROPHONE", q=["microphone"], p=["a photo of a microphone"])
o("music|RHYTHM", q=["metronome", "drumming rhythm", "clapping rhythm"], p=["a photo of a metronome or drums keeping a rhythm"])
o("music|LOUD", q=["loudspeaker concert", "megaphone", "loud"], p=["a photo of something loud"])
o("music|QUIET", q=["shh finger on lips", "quiet sign", "quiet"], p=["a photo of being quiet, finger on lips"])
o("music|DANCE FLOOR", q=["dance floor", "people dancing dance floor"], p=["a photo of a dance floor"], mode="scene")
o("music|MARACAS", q=["maracas"], p=["a photo of maracas"])

o("school|BAG", q=["school backpack", "backpack"], p=["a photo of a school backpack"])
o("school|MAP", q=["world map wall", "map"], p=["a photo of a printed map"], text_ok=True, nostyle=["a map"])
o("school|GLOBE", q=["globe", "world globe"], p=["a photo of a world globe"], nostyle=["a map"])
o("school|PAINT", q=["paint palette", "paint cans", "watercolor paint"], p=["a photo of paints"])
o("school|TEACHER", q=["teacher classroom", "teacher"], p=["a photo of a teacher in a classroom"], mode="person")
o("school|STUDENT", q=["student", "school student uniform"], p=["a photo of a school student"], mode="person")
o("school|CLASSMATE", q=["classmates", "students classroom"], p=["a photo of classmates in a classroom"], mode="person")
o("school|PRINCIPAL", q=["school principal", "headmaster"], p=["a photo of a school principal"], mode="person")
o("school|HOMEWORK", q=["child doing homework", "homework"], p=["a photo of a child doing homework"], mode="person")
o("school|CLASSROOM", q=["classroom", "classroom children"], p=["a photo of a classroom"], mode="scene")
o("school|CANTEEN", q=["school canteen", "school cafeteria"], p=["a photo of a school canteen"], mode="scene")
o("school|LESSON", q=["lesson classroom", "lesson"], p=["a photo of a lesson in a classroom"], mode="scene")
o("school|TEST", q=["students taking exam", "exam paper"], p=["a photo of students taking a test"], mode="scene", text_ok=True)
o("school|GRADE", q=["graded test paper A+", "report card", "grade"], p=["a photo of a test paper with a good grade"], text_ok=True)
o("school|ENGLISH", q=["English alphabet letters", "English textbook", "ABC letters"], p=["a photo of English alphabet letters"], text_ok=True)
o("school|MATH", q=["math blackboard", "mathematics", "math class"], p=["a photo of math on a blackboard"], text_ok=True)
o("school|SCIENCE", q=["science experiment children", "science class", "science lab"], p=["a photo of a children's science experiment"])
o("school|ART", q=["children painting art class", "art class", "art supplies"], p=["a photo of children making art"])
o("school|MUSIC", q=["music class children", "children playing instruments"], p=["a photo of children playing music"])
o("school|P.E.", q=["physical education class", "school sports day", "children exercise"], p=["a photo of a physical education class"])
o("school|HISTORY", q=["history museum", "ancient ruins", "history book"], p=["a photo of ancient history ruins"])
o("school|LIBRARY CARD", q=["library card"], p=["a photo of a library card"], text_ok=True)
o("school|DICTIONARY", q=["dictionary book", "dictionary"], p=["a photo of a dictionary book"], text_ok=True)
o("school|STICKER", q=["stickers", "sticker sheet"], p=["a photo of colorful stickers"])
o("school|BELL", q=["school bell", "handbell"], p=["a photo of a school bell"])
o("school|FLAG", q=["flag on flagpole", "flag"], p=["a photo of a flag on a flagpole"])
o("school|TAPE", q=["adhesive tape", "sticky tape roll"], p=["a photo of a roll of sticky tape"])
o("school|PAPER", q=["paper sheets", "stack of paper"], p=["a photo of sheets of paper"])
o("school|SCHOOL BUS", q=["school bus"], p=["a photo of a yellow school bus"])
o("school|LUNCH BOX", q=["lunch box", "bento lunch box"], p=["a photo of a lunch box"])
o("school|PENCIL CASE", q=["pencil case"], p=["a photo of a pencil case"])
o("school|COMPUTER", q=["laptop computer", "desktop computer"], p=["a photo of a computer"])

o("toys|SLIDE", q=["playground slide", "children slide"], p=["a photo of a playground slide"])
o("toys|SWING", q=["playground swing", "swing child"], p=["a photo of a playground swing"])
o("toys|SEESAW", q=["seesaw playground", "seesaw"], p=["a photo of a seesaw"])
o("toys|DRUM", q=["drum", "toy drum"], p=["a photo of a drum"])
o("toys|GUITAR", q=["guitar", "acoustic guitar"], p=["a photo of a guitar"])
o("toys|PIANO", q=["piano", "toy piano"], p=["a photo of a piano"])
o("toys|BUBBLES", q=["soap bubbles", "child blowing bubbles"], p=["a photo of soap bubbles"])
o("toys|SANDBOX", q=["sandbox children", "sandpit playground"], p=["a photo of a children's sandbox"])
o("toys|TRAMPOLINE", q=["trampoline"], p=["a photo of a trampoline"])
o("toys|SCOOTER", q=["kick scooter", "child scooter"], p=["a photo of a kick scooter"])
o("toys|ROLLER SKATES", q=["roller skates"], p=["a photo of roller skates"])
o("toys|CRAYONS", q=["crayons"], p=["a photo of crayons"])
o("toys|MAGNET", q=["magnet", "horseshoe magnet"], p=["a photo of a magnet"])
o("toys|PLAYDOUGH", q=["play-doh", "modelling clay children"], p=["a photo of play dough"])
o("toys|DICE", q=["dice"], p=["a photo of dice"])
o("toys|MARBLES", q=["marbles"], p=["a photo of glass marbles"])
o("toys|BLOCKS", q=["toy blocks", "wooden blocks"], p=["a photo of toy building blocks"])
o("toys|LEGO", q=["Lego bricks", "Lego"], p=["a photo of Lego bricks"])
o("toys|TRAIN SET", q=["toy train set", "wooden toy train"], p=["a photo of a toy train set"])
o("toys|SPINNING TOP", q=["spinning top toy"], p=["a photo of a spinning top"])
o("toys|WATER GUN", q=["water gun", "water pistol toy"], p=["a photo of a toy water gun"])
o("toys|BALLOON ANIMAL", q=["balloon animal", "balloon dog"], p=["a photo of a balloon animal"])
o("toys|STICKER BOOK", q=["sticker book", "stickers"], p=["a photo of a sticker book"])
o("toys|BOARD GAME", q=["board game", "children playing board game"], p=["a photo of a board game"])
o("toys|PUPPET", q=["hand puppet", "puppet"], p=["a photo of a puppet"])
o("toys|ROCKING HORSE", q=["rocking horse"], p=["a photo of a rocking horse"])
o("toys|TOY CAR", q=["toy car"], p=["a photo of a toy car"])
o("toys|YO-YO", q=["yo-yo"], p=["a photo of a yo-yo"])
o("toys|ROBOT", q=["toy robot", "robot"], p=["a photo of a toy robot"])
o("toys|DOLL", q=["doll", "toy doll"], p=["a photo of a doll"])
o("toys|KITE", q=["kite flying", "kite"], p=["a photo of a kite"])
o("toys|BALL", q=["ball", "colorful ball"], p=["a photo of a ball"])
o("toys|BALLOON", q=["balloons", "balloon"], p=["a photo of balloons"])
o("toys|TOY", q=["toys", "children toys"], p=["a photo of toys"])

o("vehicles|SCOOTER", q=["motor scooter", "scooter Thailand"], p=["a photo of a motor scooter"])
o("vehicles|TUK-TUK", q=["tuk-tuk Thailand", "tuk tuk Bangkok"], p=["a photo of a Thai tuk-tuk"])
o("vehicles|SKYTRAIN", q=["BTS Skytrain Bangkok", "skytrain"], p=["a photo of the Bangkok skytrain"])
o("vehicles|LONGTAIL BOAT", q=["long-tail boat Thailand", "longtail boat"], p=["a photo of a Thai long-tail boat"])
o("vehicles|WHEEL", q=["car wheel", "wheel tyre"], p=["a photo of a wheel"])
o("vehicles|ENGINE", q=["car engine", "engine"], p=["a photo of a car engine"])
o("vehicles|TRAFFIC LIGHT", q=["traffic light"], p=["a photo of a traffic light"])
o("vehicles|SEAT BELT", q=["seat belt car", "seatbelt"], p=["a photo of a car seat belt"])
o("vehicles|HELMET", q=["motorcycle helmet", "bicycle helmet"], p=["a photo of a helmet"])
o("vehicles|CRANE", q=["construction crane", "mobile crane"], p=["a photo of a construction crane"], neg=["a photo of a crane bird"])
o("vehicles|SPACESHIP", q=["space shuttle", "spacecraft"], p=["a photo of a spaceship"])
o("vehicles|ROCKET", q=["rocket launch", "rocket"], p=["a photo of a rocket"])
o("vehicles|SUBMARINE", q=["submarine"], p=["a photo of a submarine"])
o("vehicles|HOT AIR BALLOON", q=["hot air balloon"], p=["a photo of a hot air balloon"])
o("vehicles|FIRETRUCK", q=["fire engine truck", "fire truck"], p=["a photo of a red fire truck"])
o("vehicles|JET", q=["jet aircraft", "fighter jet"], p=["a photo of a jet plane"])
o("vehicles|STROLLER", q=["baby stroller", "pram"], p=["a photo of a baby stroller"])
o("vehicles|WHEELCHAIR", q=["wheelchair"], p=["a photo of a wheelchair"])
o("vehicles|GARBAGE TRUCK", q=["garbage truck"], p=["a photo of a garbage truck"])
o("vehicles|SUBWAY", q=["subway train", "MRT Bangkok"], p=["a photo of a subway train"])
o("vehicles|BIKE", q=["bicycle"], p=["a photo of a bicycle"])

o("clothes|TIE", q=["necktie"], p=["a photo of a necktie"])
o("clothes|WATCH", q=["wristwatch"], p=["a photo of a wristwatch"])
o("clothes|RING", q=["finger ring jewellery", "gold ring"], p=["a photo of a ring, jewellery"])
o("clothes|MASK", q=["face mask", "surgical mask"], p=["a photo of a face mask"])
o("clothes|BUTTON", q=["clothing buttons", "sewing buttons"], p=["a photo of clothing buttons"])
o("clothes|POCKET", q=["jeans pocket", "pocket"], p=["a photo of a pocket on clothes"])
o("clothes|ZIPPER", q=["zipper", "zip fastener"], p=["a photo of a zipper"])
o("clothes|CAP", q=["baseball cap"], p=["a photo of a baseball cap"])
o("clothes|SUIT", q=["business suit", "suit and tie"], p=["a photo of a man in a business suit"])
o("clothes|UNDERWEAR", q=["underwear clothing product", "boxer shorts", "underpants"], p=["a photo of underwear clothing laid flat"])
o("clothes|BIKINI", q=["bikini swimsuit product", "bikini swimwear"], p=["a photo of a bikini swimsuit laid flat"])
o("clothes|SWIMSUIT", q=["swimsuit", "child swimsuit"], p=["a photo of a swimsuit"])
o("clothes|UNIFORM", q=["school uniform", "uniform"], p=["a photo of a school uniform"])
o("clothes|PAJAMAS", q=["pajamas", "child pajamas"], p=["a photo of pajamas"])
o("clothes|GLASSES", q=["eyeglasses", "glasses"], p=["a photo of eyeglasses"], neg=["a photo of drinking glasses"])
o("clothes|SHOES", q=["shoes", "pair of shoes"], p=["a photo of a pair of shoes"])
o("clothes|DRESS", q=["dress", "girl dress"], p=["a photo of a dress"])
o("clothes|HIGH HEELS", q=["high heels shoes"], p=["a photo of high heel shoes"])
o("clothes|EARRINGS", q=["earrings"], p=["a photo of earrings"])

# ================= v3.20 extra words =================
LAND2 = {"INDONESIA": "Borobudur", "PHILIPPINES": "Chocolate Hills Bohol", "BRUNEI": "Sultan Omar Ali Saifuddien Mosque",
         "MONGOLIA": "Mongolian ger yurt steppe", "NEPAL": "Boudhanath stupa Kathmandu", "BHUTAN": "Paro Taktsang Tiger's Nest",
         "SRI LANKA": "Sigiriya rock", "BANGLADESH": "Ahsan Manzil Dhaka", "PAKISTAN": "Badshahi Mosque Lahore",
         "MALDIVES": "Maldives beach water villas", "RUSSIA": "Saint Basil's Cathedral Moscow", "SAUDI ARABIA": "Kingdom Centre Riyadh",
         "QATAR": "Doha skyline", "GERMANY": "Neuschwanstein Castle", "SPAIN": "Sagrada Familia", "PORTUGAL": "Belem Tower Lisbon",
         "NETHERLANDS": "windmills Kinderdijk tulips", "SWITZERLAND": "Matterhorn", "GREECE": "Santorini Oia",
         "NORWAY": "Geirangerfjord", "SWEDEN": "Stockholm Gamla stan", "FINLAND": "Helsinki Cathedral", "DENMARK": "Nyhavn Copenhagen",
         "IRELAND": "Cliffs of Moher", "SCOTLAND": "Edinburgh Castle", "BELGIUM": "Grand Place Brussels", "AUSTRIA": "Schonbrunn Palace",
         "POLAND": "Krakow Main Square", "CANADA": "Moraine Lake Banff", "MEXICO": "Chichen Itza", "ARGENTINA": "Perito Moreno Glacier",
         "PERU": "Machu Picchu", "COLOMBIA": "Cartagena Colombia old town", "CHILE": "Torres del Paine", "CUBA": "Havana classic car",
         "KENYA": "Maasai Mara giraffe", "SOUTH AFRICA": "Table Mountain Cape Town", "NIGERIA": "Zuma Rock",
         "MOROCCO": "Chefchaouen blue city", "NEW ZEALAND": "Milford Sound", "ICELAND": "Skogafoss waterfall"}
for wd, lm in LAND2.items():
    O[f"countries|{wd}"] = dict(q=[lm, f"{lm} view"], p=[f"a photo of {lm} in {wd.title()}", f"a famous landmark of {wd.title()}"])

COL2 = {"DARK BLUE": "dark blue", "LIGHT GREEN": "light green", "DARK RED": "dark red", "LIGHT PINK": "light pink", "HOT PINK": "hot pink",
        "DARK BROWN": "dark brown", "LIGHT BROWN": "light brown", "LIGHT GRAY": "light gray", "DARK GRAY": "dark gray", "SKY BLUE": "sky blue",
        "LIME GREEN": "lime green", "MAROON": "maroon", "CREAM": "cream", "IVORY": "ivory", "TAN": "tan", "LAVENDER": "lavender",
        "MAGENTA": "magenta", "CYAN": "cyan", "TEAL": "teal", "AQUA": "aqua", "CRIMSON": "crimson", "SCARLET": "scarlet",
        "BRONZE": "bronze", "COPPER": "copper", "KHAKI": "khaki", "EMERALD GREEN": "emerald green", "INDIGO": "indigo", "AMBER": "amber",
        "MUSTARD YELLOW": "mustard yellow", "CHARCOAL": "charcoal gray", "BURGUNDY": "burgundy", "ROYAL BLUE": "royal blue",
        "BABY BLUE": "baby blue", "BABY PINK": "baby pink", "NEON GREEN": "neon green", "DARK PURPLE": "dark purple",
        "LIGHT PURPLE": "light purple", "SALMON PINK": "salmon pink", "SEA GREEN": "sea green"}
COL_Q = {"BRONZE": ["bronze medal", "bronze statue"], "COPPER": ["copper pots", "copper pipes"], "AMBER": ["amber gemstone"],
         "LAVENDER": ["lavender color", "lavender flowers"], "EMERALD GREEN": ["emerald gemstone", "emerald green"],
         "CHARCOAL": ["charcoal gray color", "charcoal"], "CREAM": ["cream color", "cream colored"], "IVORY": ["ivory color", "ivory white"],
         "SEA GREEN": ["sea green water", "sea green color"], "AQUA": ["aqua color water", "aqua color"], "TEAL": ["teal color", "teal"],
         "SALMON PINK": ["salmon pink color", "salmon pink flowers"], "KHAKI": ["khaki fabric", "khaki color"]}
for wd, nm in COL2.items():
    O[f"colors|{wd}"] = dict(q=COL_Q.get(wd, [f"{nm} color", f"{nm} objects"]), p=[f"a photo of bright {nm} colored objects", f"the color {nm}"])
o("colors|PASTEL COLORS", q=["pastel colors", "pastel colored macarons"], p=["a photo of objects in soft pastel colors"])
o("colors|BLACK AND WHITE", q=["black and white zebra", "black and white pattern"], p=["a photo of something black and white, like a zebra"], neg=["a colorful photo"])
o("colors|COLORFUL", q=["colorful", "colorful balloons", "colorful umbrellas"], p=["a photo of very colorful things in many colors"])

SH2 = {"OCTAGON": ["stop sign octagon", "octagon shape"], "HEPTAGON": ["heptagon shape", "heptagonal"], "DECAGON": ["decagon shape", "decagonal"],
       "SPHERE": ["sphere ball", "glass sphere"], "CONE": ["traffic cone", "cone shape"], "CYLINDER": ["cylinder shape", "tin can cylinder"],
       "PYRAMID": ["pyramid", "Pyramids of Giza"], "PRISM": ["glass prism", "triangular prism"], "CUBOID": ["cardboard box", "cuboid"],
       "HEMISPHERE": ["dome hemisphere", "half sphere"], "SEMICIRCLE": ["semicircle shape", "half circle"], "QUARTER CIRCLE": ["quarter circle shape", "quarter of a pizza"],
       "PARALLELOGRAM": ["parallelogram shape"], "TRAPEZOID": ["trapezoid shape", "trapezium shape"], "RHOMBUS": ["rhombus shape", "diamond shape tiles"],
       "ZIGZAG": ["zigzag pattern", "zigzag"], "SPIRAL": ["spiral", "spiral shell"], "CROSS": ["cross shape", "plus sign cross"], "CURVE": ["curve road", "curved line"],
       "DOT": ["dot", "red dot"], "WAVY LINE": ["wavy lines", "wavy pattern"], "DOTTED LINE": ["dotted line"], "DIAGONAL LINE": ["diagonal lines", "diagonal stripes"],
       "CHECKMARK": ["check mark", "tick mark"], "TEARDROP": ["water droplet", "teardrop shape"], "STRIPES": ["stripes pattern", "striped fabric"],
       "POLKA DOTS": ["polka dot fabric", "polka dots"], "CHECKERED": ["checkered pattern", "checkerboard"], "GRID": ["grid pattern", "grid"],
       "ANGLE": ["angle", "right angle"], "CORNER": ["corner of a room", "corner"], "SQUIGGLE": ["squiggle", "squiggly line"], "LOOP": ["loop rope", "roller coaster loop"],
       "TUBE": ["tube", "cardboard tube"], "PATTERN": ["pattern", "colorful pattern"], "OUTLINE": ["outline", "silhouette outline"], "ARCH": ["stone arch", "arch"],
       "WEDGE": ["wedge", "cheese wedge"], "EDGE": ["table edge", "edge"], "MAZE": ["hedge maze", "maze"], "KNOT": ["rope knot", "knot"],
       "HONEYCOMB": ["honeycomb"], "TANGRAM": ["tangram puzzle", "tangram"], "MOSAIC": ["mosaic tiles", "mosaic"], "SHAPE": ["geometric shapes toy", "shapes"],
       "FRAME": ["picture frame", "empty frame"], "SYMMETRY": ["symmetry butterfly", "symmetrical"]}
for wd, qs in SH2.items():
    O[f"shapes|{wd}"] = dict(q=qs, p=[f"a photo of a {wd.lower()} shape", f"a photo of a {wd.lower()}"])
O["shapes|PYRAMID"]["neg"] = []

NUM2 = {"FOURTH": "4th", "FIFTH": "5th", "SIXTH": "6th", "SEVENTH": "7th", "EIGHTH": "8th", "NINTH": "9th", "TENTH": "10th", "ELEVENTH": "11th", "TWELFTH": "12th"}
for wd, t in NUM2.items():
    O[f"numbers|{wd}"] = dict(q=[f"{t} place", f"number {t[:-2]} sign", f"{t} floor"], p=[f"the ordinal {t}", f"a sign showing {t}"], text_ok=True)
for wd, n in {"TWENTY-ONE": 21, "TWENTY-FIVE": 25, "TWO HUNDRED": 200, "FIVE HUNDRED": 500, "TEN THOUSAND": 10000}.items():
    O[f"numbers|{wd}"] = dict(q=[f"number {n} sign", f"house number {n}", f"{n} sign"], p=[f"a sign showing the number {n}", f"the number {n}"], text_ok=True)
o("numbers|BILLION", q=["stars galaxy billion", "Milky Way stars", "crowd of people"], p=["a photo of countless stars in the galaxy"])
o("numbers|QUARTER", q=["quarter of a pizza", "orange quarters", "quarter apple"], p=["a photo of a fruit cut into quarters"])
o("numbers|DOUBLE", q=["double cherries", "double decker", "twin"], p=["a photo of a double, two of the same"])
o("numbers|PAIR", q=["pair of shoes", "pair of socks", "pair"], p=["a photo of a pair of shoes"])
o("numbers|DOZEN", q=["dozen eggs carton", "a dozen donuts", "dozen eggs"], p=["a photo of a dozen eggs in a carton"])
o("numbers|PLUS", q=["plus sign", "addition sign"], p=["a photo of a plus sign +"], text_ok=True)
o("numbers|MINUS", q=["minus sign", "subtraction sign"], p=["a photo of a minus sign -"], text_ok=True)
o("numbers|EQUALS", q=["equals sign", "equal sign"], p=["a photo of an equals sign ="], text_ok=True)
o("numbers|TIMES", q=["multiplication sign", "times table"], p=["a photo of a multiplication sign"], text_ok=True)
o("numbers|NUMBER", q=["numbers colorful", "house numbers", "number blocks"], p=["a photo of colorful numbers"], text_ok=True)
o("numbers|LAST", q=["last in line", "last place finish", "end of queue"], p=["the last person at the end of a line"])

OPP2 = {"ON": (["light switch on", "lamp on", "on"], "a lamp that is switched on"),
        "OFF": (["light switch off", "lamp off", "off"], "a lamp that is switched off"),
        "ABOVE": (["bird above", "flying above", "above"], "something above another thing"),
        "BELOW": (["below", "under the table", "underneath"], "something below another thing"),
        "INSIDE": (["cat inside box", "inside", "inside a house"], "something inside a box"),
        "OUTSIDE": (["children playing outside", "outside", "outdoors"], "children outside"),
        "HIGH": (["high mountain", "high up", "skyscraper high"], "something very high up"),
        "LOW": (["low table", "low bridge", "low"], "something low to the ground"),
        "WIDE": (["wide river", "wide road", "wide"], "something very wide"),
        "NARROW": (["narrow alley", "narrow street", "narrow"], "a very narrow street"),
        "TOP": (["top of mountain", "top", "summit"], "the top of something"),
        "BOTTOM": (["bottom of the stairs", "bottom", "bottom of glass"], "the bottom of something"),
        "DARK": (["dark room", "dark night", "dark"], "a dark place"),
        "ASLEEP": (["sleeping child", "asleep", "baby asleep"], "a child who is asleep"),
        "AWAKE": (["awake child", "child waking up", "awake"], "a child who is awake"),
        "MESSY": (["messy room", "messy desk", "messy"], "a very messy room"),
        "TIDY": (["tidy room", "neat organized", "tidy"], "a tidy room"),
        "SMOOTH": (["smooth stone", "smooth surface", "smooth"], "something smooth"),
        "ROUGH": (["rough bark", "rough stone", "rough"], "something rough"),
        "CHEAP": (["cheap price tag", "sale price", "cheap"], "a cheap price tag"),
        "EXPENSIVE": (["expensive jewelry", "luxury car", "expensive"], "something expensive"),
        "SAFE": (["child seat belt safe", "safe", "helmet safety"], "being safe"),
        "DANGEROUS": (["danger sign", "dangerous", "warning sign"], "a danger warning sign"),
        "CURLY": (["curly hair", "curly", "curls"], "curly hair"),
        "STRAIGHT": (["straight road", "straight line", "straight"], "something straight"),
        "DEEP": (["deep water", "deep sea", "deep"], "deep water"),
        "SHALLOW": (["shallow water", "shallow", "children shallow pool"], "shallow water")}
for wd, (qs, p) in OPP2.items():
    O[f"opposites|{wd}"] = dict(q=qs, p=[f"a photo of {p}"], text_ok=wd in ("CHEAP", "DANGEROUS"))
    if wd in ("ASLEEP", "AWAKE", "CURLY", "OUTSIDE"): O[f"opposites|{wd}"]["mode"] = "person"

T2 = {"NOON": (["noon sun", "midday", "clock noon"], "midday with the sun high"), "MIDNIGHT": (["midnight clock", "midnight", "night sky"], "midnight"),
      "DAY": (["day sky", "daytime", "sunny day"], "the daytime"), "CALENDAR": (["calendar", "wall calendar"], "a calendar"),
      "HOURGLASS": (["hourglass"], "an hourglass"), "STOPWATCH": (["stopwatch"], "a stopwatch"), "TIMER": (["kitchen timer", "timer"], "a timer"),
      "BEDTIME": (["bedtime story", "child going to bed", "bedtime"], "a child at bedtime"), "DAYTIME": (["daytime", "sunny daytime park"], "daytime"),
      "NEW YEAR": (["New Year fireworks", "new year"], "New Year fireworks"), "SONGKRAN": (["Songkran water festival", "Songkran"], "the Songkran water festival"),
      "LOY KRATHONG": (["Loy Krathong", "krathong floating"], "Loy Krathong floating lanterns"), "CHRISTMAS": (["Christmas tree", "christmas"], "a Christmas tree"),
      "CHINESE NEW YEAR": (["Chinese New Year lanterns", "lion dance"], "Chinese New Year"), "HALLOWEEN": (["Halloween pumpkins", "jack-o'-lantern"], "Halloween pumpkins"),
      "MOTHER'S DAY": (["mother's day flowers", "mother and child hug"], "Mother's Day"), "FATHER'S DAY": (["father's day", "father and child"], "Father's Day"),
      "CHILDREN'S DAY": (["children's day Thailand", "children celebration"], "Children's Day"), "TEACHER'S DAY": (["Wai Khru ceremony", "teacher's day"], "Teacher's Day"),
      "VALENTINE'S DAY": (["Valentine's Day hearts", "valentine roses"], "Valentine's Day"), "PARTY": (["birthday party children", "party"], "a party"),
      "EARLY": (["early morning sunrise", "early bird", "early"], "early in the morning"), "LATE": (["late running", "late", "clock late"], "being late"),
      "SEASON": (["four seasons tree", "seasons", "autumn leaves"], "the seasons"), "GRADUATION": (["graduation ceremony", "graduation cap"], "a graduation"),
      "TIMETABLE": (["school timetable", "train timetable"], "a timetable"), "SUNDIAL": (["sundial"], "a sundial")}
for wd, (qs, p) in T2.items():
    O[f"time|{wd}"] = dict(q=qs, p=[f"a photo of {p}"], mode="object" if wd in ("CALENDAR", "HOURGLASS", "STOPWATCH", "TIMER", "SUNDIAL") else "scene", text_ok=True)

B2 = {"SKULL": (["human skull model", "skull"], "a model of a human skull"), "SKELETON": (["human skeleton model", "skeleton model classroom"], "a human skeleton model"),
      "LUNGS": (["lungs anatomical model", "human lungs model"], "an anatomical model of lungs"), "RIBS": (["rib cage model", "ribs skeleton"], "a model of a rib cage"),
      "SPINE": (["spine model", "human spine"], "a model of a human spine"), "MUSCLE": (["muscle arm flex", "biceps"], "an arm flexing a muscle"),
      "BELLY BUTTON": (["belly button", "navel"], "a belly button"), "VEIN": (["veins hand", "vein"], "veins on a hand"),
      "SCAR": (["scar on knee", "scar"], "a small scar on skin"), "BRUISE": (["bruise", "bruise on leg"], "a bruise on skin"),
      "HEADACHE": (["headache", "person with headache"], "a person with a headache"), "TOOTHACHE": (["toothache", "person with toothache"], "a person with a toothache"),
      "STOMACHACHE": (["stomach ache", "stomachache"], "a person with a stomach ache"), "FEVER": (["child fever thermometer", "fever"], "a child with a fever"),
      "COUGH": (["coughing", "cough"], "a person coughing"), "BANDAGE": (["bandage", "plaster bandage finger"], "a bandage"),
      "MEDICINE": (["medicine pills", "medicine bottle"], "medicine"), "SWEAT": (["sweating", "sweat"], "a sweating person"), "TEARS": (["tears crying", "tears"], "tears on a face"),
      "FINGERPRINT": (["fingerprint"], "a fingerprint"), "FOOTPRINT": (["footprint sand", "footprint"], "a footprint in sand"),
      "FIST": (["fist", "clenched fist"], "a fist"), "PALM": (["palm of hand", "open palm"], "the palm of a hand"), "PONYTAIL": (["ponytail"], "a ponytail"),
      "BRAID": (["braided hair", "braid"], "braided hair"), "FRECKLES": (["freckles"], "a face with freckles"), "DIMPLE": (["dimple smile", "dimples"], "a smile with dimples"),
      "ARMPIT": (["armpit", "arms raised"], "an armpit"), "THIGH": (["thigh", "leg thigh"], "a thigh"), "WAIST": (["waist", "measuring waist"], "a waist")}
for wd, (qs, p) in B2.items():
    O[f"body|{wd}"] = dict(q=qs, p=[f"a photo of {p}"])
for k in ("body|SKULL", "body|SKELETON", "body|SCAR", "body|BRUISE", "body|WAIST", "body|THIGH", "body|ARMPIT", "body|BELLY BUTTON", "body|VEIN", "body|RIBS"):
    pass

o("places|SPIRIT HOUSE", q=["spirit house Thailand", "san phra phum"], p=["a photo of a Thai spirit house"], mode="object")
o("places|TEMPLE FAIR", q=["temple fair Thailand", "Thai temple fair"], p=["a photo of a Thai temple fair"])
o("places|ATM", q=["ATM machine", "cash machine"], p=["a photo of an ATM cash machine"], mode="object")
o("places|STATUE", q=["statue", "statue park"], p=["a photo of a statue"], mode="object")
o("places|FOUNTAIN", q=["fountain"], p=["a photo of a fountain"], mode="object")
o("places|LIGHTHOUSE", q=["lighthouse"], p=["a photo of a lighthouse"], mode="object")
o("places|PAGODA", q=["pagoda", "chedi Thailand"], p=["a photo of a pagoda"], mode="object")
o("places|RESTROOM", q=["public restroom sign", "toilet sign"], p=["a photo of a restroom"], text_ok=True)
o("places|HOUSE", q=["house", "family house"], p=["a photo of a house"], mode="object")
o("vehicles|SONGTHAEW", q=["songthaew Thailand", "songthaew"], p=["a photo of a Thai songthaew pickup taxi"])
o("vehicles|MOTORCYCLE TAXI", q=["motorcycle taxi Bangkok", "motorcycle taxi"], p=["a photo of a motorcycle taxi"])
o("vehicles|PASSENGER", q=["train passengers", "bus passengers"], p=["a photo of passengers on a train"], mode="person")
o("vehicles|LICENSE PLATE", q=["license plate", "Thai license plate"], p=["a photo of a car license plate"], text_ok=True)
o("vehicles|CROSSWALK", q=["zebra crossing", "crosswalk"], p=["a photo of a zebra crosswalk"], mode="scene")
o("vehicles|TRAFFIC JAM", q=["traffic jam Bangkok", "traffic jam"], p=["a photo of a traffic jam"], mode="scene")
o("vehicles|TIRE", q=["car tire", "tyre"], p=["a photo of a tire"])
o("vehicles|CABLE CAR", q=["cable car gondola", "aerial tramway"], p=["a photo of a cable car"])
o("vehicles|SLED", q=["sled snow", "sledge children"], p=["a photo of a sled"])
o("clothes|CHUT THAI", q=["chut thai traditional dress", "Thai traditional costume"], p=["a photo of Thai traditional dress"], mode="person")
o("clothes|SARONG", q=["sarong"], p=["a photo of a sarong"])
o("clothes|KIMONO", q=["kimono"], p=["a photo of a kimono"])
o("clothes|DIAPER", q=["diaper", "nappy"], p=["a photo of a diaper"])
o("clothes|CROWN", q=["crown jewels", "crown"], p=["a photo of a crown"])
o("clothes|BACKPACK", q=["backpack"], p=["a photo of a backpack"])
o("sports|MUAY THAI", q=["Muay Thai", "Muay Thai boxing"], p=["a photo of Muay Thai boxing"])
o("sports|TAKRAW", q=["sepak takraw"], p=["a photo of sepak takraw"])
o("sports|PETANQUE", q=["petanque"], p=["a photo of petanque boules"])
o("sports|SHUTTLECOCK", q=["shuttlecock"], p=["a photo of a badminton shuttlecock"], mode="object")
o("sports|DUMBBELL", q=["dumbbell"], p=["a photo of a dumbbell"], mode="object")
o("sports|TREADMILL", q=["treadmill"], p=["a photo of a treadmill"], mode="object")
o("sports|SCOREBOARD", q=["scoreboard"], p=["a photo of a scoreboard"], mode="object", text_ok=True)
o("sports|FINISH LINE", q=["finish line race"], p=["a photo of a race finish line"])
o("sports|OLYMPICS", q=["Olympic rings", "Olympic games"], p=["a photo of the Olympic rings"], mode="object")
o("sports|GYM", q=["gym", "fitness gym"], p=["a photo of a gym"], mode="scene")
o("music|KHAEN", q=["khaen", "khene mouth organ"], p=["a photo of a khaen, a Lao bamboo mouth organ"])
o("music|CHING", q=["ching cymbals Thai", "ching instrument"], p=["a photo of ching, small Thai cymbals"])
o("music|KHONG WONG", q=["khong wong", "khong wong yai"], p=["a photo of a khong wong, Thai gong circle"])
o("music|MUSIC NOTE", q=["music notes sheet", "musical note"], p=["a photo of musical notes"], text_ok=True)
o("music|SHEET MUSIC", q=["sheet music"], p=["a photo of sheet music"], text_ok=True)
for w in ("BAND", "ORCHESTRA", "CHOIR", "CONDUCTOR", "PIANIST", "DRUMMER", "GUITARIST", "VIOLINIST", "AUDIENCE", "KARAOKE"):
    O.setdefault(f"music|{w}", {})["mode"] = "person"
O["music|STAGE"] = dict(mode="scene")
o("technology|ICON", q=["app icons smartphone", "smartphone home screen"], p=["a photo of app icons on a phone screen"], text_ok=True)
o("technology|EMOJI", q=["emoji pillows", "emoji"], p=["a photo of emoji faces"], nostyle=["a cartoon", "a clip art illustration", "a logo"])
o("technology|QR CODE", q=["QR code sign", "QR code"], p=["a photo of a QR code"], text_ok=True, nostyle=["a logo", "a diagram"])
o("technology|BARCODE", q=["barcode on product", "barcode scanner"], p=["a photo of a barcode"], text_ok=True, nostyle=["a logo", "a diagram"])
o("technology|TEXT MESSAGE", q=["text message smartphone", "SMS on phone"], p=["a photo of a phone showing text messages"], text_ok=True)
o("technology|CODING", q=["children coding", "programming code screen"], p=["a photo of children coding on a computer"], text_ok=True)
o("technology|VIDEO CALL", q=["video call laptop", "video call"], p=["a photo of a video call on a laptop"])
o("technology|SELFIE", q=["selfie", "taking a selfie"], p=["a photo of people taking a selfie"], mode="person")
o("technology|POWER BUTTON", q=["power button", "power switch"], p=["a photo of a power button"], text_ok=True)
o("technology|LIGHT BULB", q=["light bulb"], p=["a photo of a light bulb"])
o("technology|MONITOR", q=["computer monitor"], p=["a photo of a computer monitor"])
o("family|PET", q=["child with pet dog", "pets"], p=["a photo of a child with a pet"])
o("family|WEDDING", q=["wedding couple", "wedding ceremony"], p=["a photo of a wedding"])
o("family|FAMILY TREE", q=["family tree", "genealogy tree"], p=["a photo of a family tree chart"], nostyle=["a diagram", "a drawing"])
o("family|PEOPLE", q=["people crowd", "group of people"], p=["a photo of a group of people"])
o("family|NEWBORN", q=["newborn baby"], p=["a photo of a newborn baby"])
o("fruits|PEEL", q=["banana peel", "orange peel"], p=["a photo of fruit peel"])
o("fruits|SLICE", q=["watermelon slice", "orange slice"], p=["a photo of a slice of fruit"])
o("fruits|RIPE", q=["ripe bananas", "ripe mango"], p=["a photo of ripe fruit"])
o("fruits|LONGKONG", q=["longkong fruit", "langsat"], p=["a photo of longkong (langsat) fruit"])
o("fruits|SALAK", q=["salak fruit", "snake fruit"], p=["a photo of salak snake fruit"])
o("fruits|SANTOL", q=["santol fruit"], p=["a photo of santol fruit"])
o("fruits|MARIAN PLUM", q=["Bouea macrophylla fruit", "marian plum", "maprang"], p=["a photo of marian plum fruit"])
o("vegetables|PANDAN", q=["pandan leaves"], p=["a photo of pandan leaves"])
o("vegetables|IVY GOURD", q=["Coccinia grandis fruit", "ivy gourd"], p=["a photo of ivy gourd"])
o("vegetables|WINGED BEAN", q=["winged bean"], p=["a photo of winged beans"])
o("vegetables|LUFFA", q=["luffa vegetable", "sponge gourd"], p=["a photo of luffa gourd"])
o("nature|RICE PADDY", q=["rice paddy Thailand", "rice field"], p=["a photo of a green rice paddy"], mode="scene")
o("nature|GALAXY", q=["galaxy", "Andromeda galaxy"], p=["a photo of a galaxy"], mode="scene")
for w in ("VALLEY", "CLIFF", "GLACIER", "SWAMP", "MEADOW", "MANGROVE"):
    O.setdefault(f"nature|{w}", {})["mode"] = "scene"
for w in ("LIGHTNING", "SNOWY", "FOGGY", "STORMY", "ICY", "FREEZING", "COOL", "BREEZE", "SUNSHINE", "SUNRISE", "SUNSET", "HEAT WAVE",
          "DROUGHT", "MONSOON", "RAINY SEASON", "HOT SEASON", "COOL SEASON", "BLIZZARD", "THUNDERSTORM", "HURRICANE", "MIST", "HAZE", "CLEAR SKY", "HEAVY RAIN"):
    O.setdefault(f"weather|{w}", {})
for w in ("SNOWFLAKE", "RAINDROP", "ICICLE", "THERMOMETER", "SNOWBALL", "FROST", "DEW", "PUDDLE"):
    O.setdefault(f"weather|{w}", {})["mode"] = "object"
o("weather|WEATHER FORECAST", q=["weather forecast TV", "weather map forecast"], p=["a photo of a TV weather forecast"], text_ok=True, nostyle=["a map"])
o("weather|SNOWFLAKE", q=["snowflake macro"], p=["a photo of a snowflake"], mode="object")
o("weather|COOL SEASON", q=["cool season Thailand morning mist", "winter Thailand"], p=["a photo of the cool season"])
o("weather|HOT SEASON", q=["hot season Thailand", "hot sun summer"], p=["a photo of the hot season"])
o("weather|RAINY SEASON", q=["rainy season Thailand", "monsoon rain"], p=["a photo of the rainy season"])
o("jobs|WIZARD", q=["wizard costume", "wizard"], p=["a photo of a person in a wizard costume"])
o("jobs|FAIRY", q=["fairy costume girl", "fairy costume"], p=["a photo of a girl in a fairy costume"])
o("jobs|KNIGHT", q=["knight armour reenactment", "knight armor"], p=["a photo of a knight in armor"])
o("jobs|DJ", q=["DJ turntables", "disc jockey"], p=["a photo of a DJ playing music"])
o("jobs|DELIVERY RIDER", q=["food delivery rider", "delivery motorcycle"], p=["a photo of a food delivery rider"])
o("toys|HIDE-AND-SEEK", q=["children playing hide and seek", "hide and seek"], p=["a photo of children playing hide and seek"], mode="person")
o("toys|HOPSCOTCH", q=["hopscotch"], p=["a photo of children playing hopscotch"], mode="person")
o("toys|SLIME", q=["slime toy", "slime"], p=["a photo of toy slime"])
o("toys|ORIGAMI", q=["origami crane", "origami"], p=["a photo of origami"])
o("school|ASSEMBLY", q=["school assembly", "morning assembly students"], p=["a photo of a school assembly"], mode="scene")
o("school|KINDERGARTEN", q=["kindergarten classroom", "kindergarten children"], p=["a photo of a kindergarten"], mode="scene")
o("school|ALPHABET", q=["alphabet blocks", "alphabet letters"], p=["a photo of alphabet letters"], text_ok=True)
o("school|COMPASS", q=["drawing compass", "geometry compass"], p=["a photo of a drawing compass for geometry"], neg=["a photo of a navigation compass"])

# kid-safety: words where people may appear in swimwear etc. get stronger safety weight
STRICT_SAFE = {"body|ARMPIT", "body|THIGH", "body|WAIST", "body|BELLY BUTTON", "body|SKULL", "body|SKELETON", "body|SCAR", "body|BRUISE",
               "clothes|DIAPER", "clothes|NIGHTGOWN", "clothes|BATHROBE", "clothes|TANK TOP", "clothes|LEGGINGS", "feelings|DISGUSTED", "feelings|TERRIFIED",
               "clothes|UNDERWEAR", "clothes|BIKINI", "clothes|SWIMSUIT", "body|CHEST", "body|BODY", "body|HIP", "body|STOMACH",
               "body|BACK", "body|SKIN", "body|BLOOD", "body|HEART", "body|BRAIN", "body|BONE", "places|BEACH", "sports|SWIMMING",
               "actions|SWIM", "actions|SHOWER", "home|BATH", "home|BATHROOM", "home|SHOWER", "family|HUSBAND", "family|WIFE"}


def spec_for(w):
    cat, word = w["cat"], w["word"]
    k = f"{cat}|{word}"
    base = CAT.get(cat, dict(q=["{w}"], p=["a photo of a {w}"], mode="object"))
    ov = O.get(k) or O.get(f"*|{word}") or {}
    lw = word.lower()
    fmt = lambda s: s.format(w=lw, W=word, ing=ing(word))
    qs = ov.get("q") or [fmt(t) for t in base["q"]]
    ps = ov.get("p") or [fmt(t) for t in base["p"]]
    mode = ov.get("mode") or base.get("mode", "object")
    coco = COCO_MAP.get(k)
    if mode == "person": coco = coco or "person"
    neg = list(ov.get("neg", []))
    if cat in ("colors", "shapes") or (cat == "numbers" and word not in ("FIRST", "SECOND", "THIRD")):
        neg += ["a portrait photo of a person", "a fashion model posing"]
    if cat == "animals":
        neg += ["an extreme close-up of an animal's eye or fur", "a close-up photo of only an animal's head", "only the tail of an animal"]
    if cat in ("fruits", "vegetables"):
        neg += ["a fruit tree in an orchard", "a refrigerator full of food", "a market stall with many kinds of produce"]
    if cat == "colors":
        neg += ["a dark night photo", "an astronomy image of space", "a color swatch chart"]
    return dict(key=k, cat=cat, word=word, queries=qs[:3], prompts=ps, neg=neg, mode=mode, coco=coco,
                text_ok=ov.get("text_ok", base.get("text_ok", False)), nostyle=ov.get("nostyle", []),
                strict=k in STRICT_SAFE)
