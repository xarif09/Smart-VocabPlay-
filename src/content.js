// ═══════════════════════════════════════════════════════
// CONTENT — บทสนทนา · นิทานภาพ · โฟนิกส์ (ระดับ A1 ใช้คำจากคลัง 403 คำ)
// รูปอ้างด้วย key "หมวด|คำ" (ใช้รูปจริงของคำนั้น) หรืออีโมจิตรงๆ
// ═══════════════════════════════════════════════════════

// ── บทสนทนา: who = A/B · en/th · blank = คำที่ใช้ในเกมเติมคำ (ต้องอยู่ใน en)
export const DIALOGUES = [
  { id:"greet", emoji:"👋", title:"Hello!", titleTh:"ทักทายเพื่อนใหม่", scene:"places|SCHOOL", a:"Mina", b:"Tom",
    lines:[
      { who:"A", en:"Hello! My name is Mina.", th:"สวัสดี ฉันชื่อมีนา", blank:"name" },
      { who:"B", en:"Hi Mina! I am Tom.", th:"สวัสดีมีนา ฉันชื่อทอม" },
      { who:"A", en:"Nice to meet you, Tom.", th:"ยินดีที่ได้รู้จักนะทอม", blank:"meet" },
      { who:"B", en:"Nice to meet you too. How are you?", th:"ยินดีที่ได้รู้จักเช่นกัน สบายดีไหม" },
      { who:"A", en:"I am happy today! And you?", th:"วันนี้ฉันมีความสุข แล้วเธอล่ะ", blank:"happy" },
      { who:"B", en:"I am fine, thank you.", th:"ฉันสบายดี ขอบคุณ", blank:"thank" },
      { who:"A", en:"Let's play together!", th:"มาเล่นด้วยกันเถอะ" },
      { who:"B", en:"Yes! Let's go!", th:"เยี่ยม ไปกันเลย" },
    ] },
  { id:"market", emoji:"🍎", title:"At the market", titleTh:"ซื้อผลไม้ที่ตลาด", scene:"places|MARKET", a:"Seller", b:"Mina",
    lines:[
      { who:"A", en:"Hello! What do you want?", th:"สวัสดี รับอะไรดี" },
      { who:"B", en:"I want three apples, please.", th:"ขอแอปเปิลสามลูกค่ะ", blank:"apples" },
      { who:"A", en:"Red or green?", th:"สีแดงหรือสีเขียว" },
      { who:"B", en:"Red, please. And one mango.", th:"สีแดงค่ะ แล้วก็มะม่วงหนึ่งลูก", blank:"mango" },
      { who:"A", en:"Here you are. Fifty baht.", th:"นี่ค่ะ ห้าสิบบาท", blank:"Fifty" },
      { who:"B", en:"Here is the money. Thank you!", th:"นี่เงินค่ะ ขอบคุณ" },
      { who:"A", en:"You're welcome. Goodbye!", th:"ยินดีค่ะ ลาก่อน", blank:"Goodbye" },
    ] },
  { id:"restaurant", emoji:"🍽️", title:"At the restaurant", titleTh:"สั่งอาหารที่ร้าน", scene:"places|RESTAURANT", a:"Waiter", b:"Tom",
    lines:[
      { who:"A", en:"Good evening! Are you hungry?", th:"สวัสดีตอนเย็น หิวไหมครับ", blank:"hungry" },
      { who:"B", en:"Yes, very hungry!", th:"หิวมากเลย" },
      { who:"A", en:"What would you like to eat?", th:"อยากทานอะไรดีครับ", blank:"eat" },
      { who:"B", en:"Fried rice with egg, please.", th:"ข้าวผัดไข่ครับ", blank:"egg" },
      { who:"A", en:"And to drink?", th:"แล้วเครื่องดื่มล่ะครับ" },
      { who:"B", en:"Orange juice, please. No ice.", th:"น้ำส้มครับ ไม่ใส่น้ำแข็ง", blank:"juice" },
      { who:"A", en:"OK. Please wait a moment.", th:"ได้ครับ รอสักครู่นะครับ", blank:"wait" },
      { who:"B", en:"Thank you very much.", th:"ขอบคุณมากครับ" },
    ] },
  { id:"school", emoji:"🎒", title:"In the classroom", titleTh:"ในห้องเรียน", scene:"school|CLASSROOM", a:"Teacher", b:"Mina",
    lines:[
      { who:"A", en:"Good morning, class!", th:"อรุณสวัสดิ์นักเรียน", blank:"morning" },
      { who:"B", en:"Good morning, teacher!", th:"อรุณสวัสดิ์ค่ะคุณครู" },
      { who:"A", en:"Please open your book to page ten.", th:"เปิดหนังสือไปหน้าสิบนะ", blank:"book" },
      { who:"B", en:"Teacher, I don't have a pencil.", th:"คุณครูคะ หนูไม่มีดินสอ", blank:"pencil" },
      { who:"A", en:"Here is a pencil for you.", th:"นี่ดินสอให้หนู" },
      { who:"B", en:"Thank you! Can I go to the toilet?", th:"ขอบคุณค่ะ หนูขอไปห้องน้ำได้ไหมคะ", blank:"toilet" },
      { who:"A", en:"Yes, you can. Come back quickly.", th:"ได้ รีบกลับมานะ" },
    ] },
  { id:"family", emoji:"👨‍👩‍👧", title:"My family", titleTh:"ครอบครัวของฉัน", scene:"family|FAMILY", a:"Tom", b:"Mina",
    lines:[
      { who:"A", en:"Who is this?", th:"นี่ใครเหรอ" },
      { who:"B", en:"This is my mother. She is a nurse.", th:"นี่แม่ของฉัน แม่เป็นพยาบาล", blank:"mother" },
      { who:"A", en:"And who is he?", th:"แล้วเขาล่ะ" },
      { who:"B", en:"He is my father. He is a driver.", th:"เขาคือพ่อของฉัน พ่อเป็นคนขับรถ", blank:"father" },
      { who:"A", en:"Do you have a brother?", th:"มีพี่ชายหรือน้องชายไหม", blank:"brother" },
      { who:"B", en:"No, but I have a little sister.", th:"ไม่มี แต่มีน้องสาวคนหนึ่ง", blank:"sister" },
      { who:"A", en:"How old is she?", th:"เธออายุเท่าไหร่" },
      { who:"B", en:"She is five years old.", th:"เธออายุห้าขวบ", blank:"five" },
    ] },
  { id:"weather", emoji:"🌦️", title:"What's the weather?", titleTh:"อากาศวันนี้", scene:"weather|RAIN", a:"Mina", b:"Mom",
    lines:[
      { who:"A", en:"Mom, is it hot today?", th:"แม่คะ วันนี้ร้อนไหม", blank:"hot" },
      { who:"B", en:"No, it is raining. Look outside!", th:"ไม่จ้ะ ฝนกำลังตก ดูข้างนอกสิ" },
      { who:"A", en:"Oh no! I want to play in the park.", th:"แย่จัง หนูอยากไปเล่นที่สวน", blank:"park" },
      { who:"B", en:"Take an umbrella and wear your boots.", th:"เอาร่มไปแล้วใส่บูทด้วยนะ", blank:"umbrella" },
      { who:"A", en:"OK! Is it cold?", th:"ได้ค่ะ หนาวไหมคะ", blank:"cold" },
      { who:"B", en:"A little. Wear your jacket too.", th:"นิดหน่อย ใส่แจ็กเก็ตด้วย", blank:"jacket" },
      { who:"A", en:"Look, Mom! A rainbow!", th:"ดูสิแม่ รุ้งกินน้ำ!", blank:"rainbow" },
    ] },
  { id:"zoo", emoji:"🦁", title:"At the zoo", titleTh:"ไปสวนสัตว์", scene:"places|ZOO", a:"Dad", b:"Tom",
    lines:[
      { who:"A", en:"Tom, what animal do you want to see?", th:"ทอม อยากดูสัตว์อะไร", blank:"animal" },
      { who:"B", en:"I want to see the elephant!", th:"ผมอยากดูช้าง", blank:"elephant" },
      { who:"A", en:"Look! The elephant is very big.", th:"ดูสิ ช้างตัวใหญ่มาก", blank:"big" },
      { who:"B", en:"Wow! And what is that?", th:"ว้าว แล้วนั่นตัวอะไร" },
      { who:"A", en:"That is a giraffe. It has a long neck.", th:"นั่นยีราฟ คอยาว", blank:"giraffe" },
      { who:"B", en:"Can we see the monkeys?", th:"ไปดูลิงได้ไหมครับ", blank:"monkeys" },
      { who:"A", en:"Yes! The monkeys are eating bananas.", th:"ได้ ลิงกำลังกินกล้วย", blank:"bananas" },
    ] },
  { id:"birthday", emoji:"🎂", title:"Happy birthday!", titleTh:"งานวันเกิด", scene:"food|CAKE", a:"Mina", b:"Tom",
    lines:[
      { who:"A", en:"Happy birthday, Tom!", th:"สุขสันต์วันเกิดนะทอม", blank:"birthday" },
      { who:"B", en:"Thank you, Mina!", th:"ขอบคุณนะมีนา" },
      { who:"A", en:"This is a present for you.", th:"นี่ของขวัญให้เธอ", blank:"present" },
      { who:"B", en:"Wow, a robot! I love it!", th:"ว้าว หุ่นยนต์ ชอบมากเลย", blank:"robot" },
      { who:"A", en:"How old are you today?", th:"วันนี้อายุเท่าไหร่แล้ว", blank:"old" },
      { who:"B", en:"I am eight years old.", th:"ฉันอายุแปดขวบ", blank:"eight" },
      { who:"A", en:"Let's eat the cake!", th:"กินเค้กกันเถอะ", blank:"cake" },
      { who:"B", en:"Yes! I like chocolate cake.", th:"เยี่ยม ฉันชอบเค้กช็อกโกแลต" },
    ] },
  { id:"doctor", emoji:"🩺", title:"At the doctor", titleTh:"ไปหาหมอ", scene:"places|HOSPITAL", a:"Doctor", b:"Mina",
    lines:[
      { who:"A", en:"Hello Mina. What's wrong?", th:"สวัสดีมีนา เป็นอะไรมา" },
      { who:"B", en:"I am sick. My stomach hurts.", th:"หนูป่วยค่ะ ปวดท้อง", blank:"sick" },
      { who:"A", en:"Open your mouth, please.", th:"อ้าปากหน่อยนะ", blank:"mouth" },
      { who:"B", en:"Ahh...", th:"อ้า..." },
      { who:"A", en:"Do you have a headache?", th:"ปวดหัวไหม" },
      { who:"B", en:"No, but I am very tired.", th:"ไม่ค่ะ แต่เหนื่อยมาก", blank:"tired" },
      { who:"A", en:"Drink water and sleep well. You will be fine.", th:"ดื่มน้ำแล้วนอนเยอะๆ นะ เดี๋ยวก็หาย", blank:"water" },
      { who:"B", en:"Thank you, doctor.", th:"ขอบคุณค่ะคุณหมอ", blank:"doctor" },
    ] },
  { id:"clothes", emoji:"👕", title:"Getting dressed", titleTh:"แต่งตัวไปโรงเรียน", scene:"clothes|UNIFORM", a:"Mom", b:"Tom",
    lines:[
      { who:"A", en:"Tom, wake up! Time for school.", th:"ทอม ตื่นได้แล้ว ถึงเวลาไปโรงเรียน", blank:"school" },
      { who:"B", en:"Where is my shirt?", th:"เสื้อของผมอยู่ไหน", blank:"shirt" },
      { who:"A", en:"It is on the chair.", th:"อยู่บนเก้าอี้", blank:"chair" },
      { who:"B", en:"And my shoes?", th:"แล้วรองเท้าล่ะ", blank:"shoes" },
      { who:"A", en:"Under the bed. Hurry up!", th:"ใต้เตียง รีบหน่อย", blank:"bed" },
      { who:"B", en:"I can't find my socks!", th:"หาถุงเท้าไม่เจอ", blank:"socks" },
      { who:"A", en:"Here they are. Now brush your teeth.", th:"นี่ไง ทีนี้ไปแปรงฟัน", blank:"teeth" },
    ] },
  { id:"help", emoji:"🆘", title:"Can you help me?", titleTh:"ขอความช่วยเหลือ", scene:"places|SUPERMARKET", a:"Mina", b:"Man",
    lines:[
      { who:"A", en:"Excuse me. Can you help me?", th:"ขอโทษค่ะ ช่วยหน่อยได้ไหมคะ", blank:"help" },
      { who:"B", en:"Yes, of course.", th:"ได้สิครับ" },
      { who:"A", en:"I can't find my mother.", th:"หนูหาแม่ไม่เจอ", blank:"find" },
      { who:"B", en:"Don't cry. What is her name?", th:"ไม่ต้องร้องไห้นะ แม่ชื่ออะไร", blank:"cry" },
      { who:"A", en:"Her name is Som. She has a red bag.", th:"ชื่อส้มค่ะ ถือกระเป๋าสีแดง", blank:"red" },
      { who:"B", en:"Look! Is that your mother?", th:"ดูสิ นั่นแม่ของหนูใช่ไหม" },
      { who:"A", en:"Yes! Mom! Thank you so much!", th:"ใช่ค่ะ แม่! ขอบคุณมากค่ะ" },
    ] },
  { id:"feelings", emoji:"😊", title:"How do you feel?", titleTh:"รู้สึกยังไงบ้าง", scene:"feelings|HAPPY", a:"Teacher", b:"Tom",
    lines:[
      { who:"A", en:"Tom, you look sad. What happened?", th:"ทอม ดูเศร้านะ เกิดอะไรขึ้น", blank:"sad" },
      { who:"B", en:"I lost my ball.", th:"ผมทำลูกบอลหาย", blank:"ball" },
      { who:"A", en:"Don't worry. We can look for it.", th:"ไม่ต้องกังวล เราช่วยกันหาได้" },
      { who:"B", en:"Really? Thank you!", th:"จริงเหรอครับ ขอบคุณครับ" },
      { who:"A", en:"Look, it is under the table!", th:"ดูสิ อยู่ใต้โต๊ะ", blank:"table" },
      { who:"B", en:"My ball! Now I am happy!", th:"ลูกบอลของผม ตอนนี้ผมดีใจแล้ว", blank:"happy" },
      { who:"A", en:"Good! Are you ready to play?", th:"ดี พร้อมเล่นหรือยัง", blank:"play" },
    ] },
];

// ── นิทานภาพ: pages = { en, th, pic } · quiz = คำถามท้ายเรื่อง 3 ข้อ (options ภาษาอังกฤษ)
export const STORIES = [
  { id:"cat", emoji:"🐱", title:"The Little Cat", titleTh:"แมวน้อยหาบ้าน", level:"A1",
    pages:[
      { en:"This is a little cat. Her name is Mimi.", th:"นี่คือแมวตัวน้อย ชื่อมีมี่", pic:"animals|CAT" },
      { en:"Mimi is hungry. She wants fish.", th:"มีมี่หิว อยากกินปลา", pic:"animals|FISH" },
      { en:"She walks to the market.", th:"เธอเดินไปที่ตลาด", pic:"places|MARKET" },
      { en:"She sees a big dog. She is scared!", th:"เธอเห็นหมาตัวใหญ่ เธอกลัว!", pic:"animals|DOG" },
      { en:"The dog says, \"Don't be scared. I am your friend.\"", th:"หมาบอกว่า \"ไม่ต้องกลัว ฉันเป็นเพื่อนนะ\"", pic:"feelings|HAPPY" },
      { en:"The dog gives Mimi a fish.", th:"หมาให้ปลากับมีมี่", pic:"animals|FISH" },
      { en:"Now Mimi is not hungry. She is happy.", th:"ตอนนี้มีมี่ไม่หิวแล้ว เธอมีความสุข", pic:"animals|CAT" },
      { en:"Mimi and the dog play in the park every day.", th:"มีมี่กับหมาเล่นด้วยกันที่สวนทุกวัน", pic:"places|PARK" },
    ],
    quiz:[
      { q:"What is the cat's name?", qTh:"แมวชื่ออะไร", options:["Mimi","Tom","Mina"], answer:"Mimi" },
      { q:"What does Mimi want to eat?", qTh:"มีมี่อยากกินอะไร", options:["Rice","Fish","Cake"], answer:"Fish" },
      { q:"Who gives Mimi a fish?", qTh:"ใครให้ปลากับมีมี่", options:["The dog","The bird","The teacher"], answer:"The dog" },
    ] },
  { id:"rain", emoji:"🌧️", title:"A Rainy Day", titleTh:"วันฝนตก", level:"A1",
    pages:[
      { en:"Today it is raining. Tom looks out of the window.", th:"วันนี้ฝนตก ทอมมองออกไปนอกหน้าต่าง", pic:"weather|RAIN" },
      { en:"\"I want to play football,\" says Tom.", th:"\"ผมอยากเล่นฟุตบอล\" ทอมพูด", pic:"sports|FOOTBALL" },
      { en:"Mom says, \"Let's cook pancakes!\"", th:"แม่บอกว่า \"มาทำแพนเค้กกันเถอะ\"", pic:"food|PANCAKE" },
      { en:"Tom gets eggs, milk and butter.", th:"ทอมหยิบไข่ นม และเนย", pic:"food|EGG" },
      { en:"They cook together. It smells good!", th:"ทั้งสองทำอาหารด้วยกัน หอมมาก!", pic:"actions|COOK" },
      { en:"Tom eats three pancakes with honey.", th:"ทอมกินแพนเค้กสามชิ้นกับน้ำผึ้ง", pic:"food|HONEY" },
      { en:"The rain stops. Look! A rainbow!", th:"ฝนหยุดแล้ว ดูสิ รุ้งกินน้ำ!", pic:"weather|RAINBOW" },
      { en:"\"Now I can play football!\" Tom is happy.", th:"\"ตอนนี้ผมเล่นฟุตบอลได้แล้ว!\" ทอมดีใจ", pic:"feelings|HAPPY" },
    ],
    quiz:[
      { q:"What is the weather at the start?", qTh:"ตอนแรกอากาศเป็นอย่างไร", options:["Sunny","Raining","Snowing"], answer:"Raining" },
      { q:"What do they cook?", qTh:"พวกเขาทำอะไรกิน", options:["Pizza","Pancakes","Soup"], answer:"Pancakes" },
      { q:"How many pancakes does Tom eat?", qTh:"ทอมกินแพนเค้กกี่ชิ้น", options:["Two","Three","Five"], answer:"Three" },
    ] },
  { id:"zoo", emoji:"🦒", title:"A Day at the Zoo", titleTh:"หนึ่งวันที่สวนสัตว์", level:"A1",
    pages:[
      { en:"Mina goes to the zoo with her family.", th:"มีนาไปสวนสัตว์กับครอบครัว", pic:"places|ZOO" },
      { en:"First, she sees a lion. It is sleeping.", th:"ก่อนอื่นเธอเห็นสิงโต มันกำลังหลับ", pic:"animals|LION" },
      { en:"Then she sees a giraffe. It eats leaves from a tall tree.", th:"แล้วเธอเห็นยีราฟ กินใบไม้จากต้นไม้สูง", pic:"animals|GIRAFFE" },
      { en:"The monkeys are funny. They jump and jump!", th:"ลิงตลกมาก กระโดดไปกระโดดมา", pic:"animals|MONKEY" },
      { en:"A penguin swims fast in the cold water.", th:"เพนกวินว่ายน้ำเร็วในน้ำเย็น", pic:"animals|PENGUIN" },
      { en:"Mina's favorite animal is the elephant. It is big and gray.", th:"สัตว์ที่มีนาชอบที่สุดคือช้าง ตัวใหญ่สีเทา", pic:"animals|ELEPHANT" },
      { en:"The elephant sprays water. Mina laughs!", th:"ช้างพ่นน้ำ มีนาหัวเราะ", pic:"actions|LAUGH" },
      { en:"\"I love the zoo!\" says Mina.", th:"\"หนูรักสวนสัตว์!\" มีนาพูด", pic:"family|FAMILY" },
    ],
    quiz:[
      { q:"What is the lion doing?", qTh:"สิงโตกำลังทำอะไร", options:["Eating","Sleeping","Running"], answer:"Sleeping" },
      { q:"What does the giraffe eat?", qTh:"ยีราฟกินอะไร", options:["Leaves","Fish","Bananas"], answer:"Leaves" },
      { q:"What is Mina's favorite animal?", qTh:"สัตว์ที่มีนาชอบที่สุดคืออะไร", options:["The penguin","The monkey","The elephant"], answer:"The elephant" },
    ] },
  { id:"lost", emoji:"🧸", title:"Where Is Teddy?", titleTh:"ตุ๊กตาหมีหายไปไหน", level:"A1",
    pages:[
      { en:"Tom has a teddy bear. He loves it very much.", th:"ทอมมีตุ๊กตาหมี เขารักมันมาก", pic:"toys|TEDDY BEAR" },
      { en:"One morning, Teddy is not in the bed!", th:"เช้าวันหนึ่ง เท็ดดี้ไม่อยู่บนเตียง!", pic:"home|BED" },
      { en:"Tom looks under the table. No Teddy.", th:"ทอมหาใต้โต๊ะ ไม่มีเท็ดดี้", pic:"home|TABLE" },
      { en:"He looks in the kitchen. No Teddy.", th:"เขาหาในห้องครัว ไม่มีเท็ดดี้", pic:"home|KITCHEN" },
      { en:"He looks in the bathroom. No Teddy.", th:"เขาหาในห้องน้ำ ไม่มีเท็ดดี้", pic:"home|BATH" },
      { en:"Tom is sad. He sits on the sofa.", th:"ทอมเศร้า เขานั่งบนโซฟา", pic:"home|SOFA" },
      { en:"Wait! Something is under the pillow.", th:"เดี๋ยวก่อน! มีอะไรอยู่ใต้หมอน", pic:"home|PILLOW" },
      { en:"It is Teddy! Tom hugs him. \"I found you!\"", th:"เท็ดดี้นี่เอง! ทอมกอดมัน \"เจอแล้ว!\"", pic:"feelings|HAPPY" },
    ],
    quiz:[
      { q:"What is Tom looking for?", qTh:"ทอมหาอะไร", options:["A ball","A teddy bear","A book"], answer:"A teddy bear" },
      { q:"Where does Tom sit when he is sad?", qTh:"ทอมนั่งที่ไหนตอนเศร้า", options:["On the sofa","On the bed","On the chair"], answer:"On the sofa" },
      { q:"Where is Teddy?", qTh:"เท็ดดี้อยู่ไหน", options:["In the kitchen","Under the table","Under the pillow"], answer:"Under the pillow" },
    ] },
  { id:"beach", emoji:"🏖️", title:"At the Beach", titleTh:"ไปทะเล", level:"A1+",
    pages:[
      { en:"It is a sunny day. The family goes to the beach.", th:"วันนี้แดดดี ครอบครัวไปชายหาด", pic:"places|BEACH" },
      { en:"Mina wears her hat and her sandals.", th:"มีนาใส่หมวกและรองเท้าแตะ", pic:"clothes|HAT" },
      { en:"Dad swims in the sea. The water is blue.", th:"พ่อว่ายน้ำในทะเล น้ำสีฟ้า", pic:"actions|SWIM" },
      { en:"Mina finds a small crab on the sand.", th:"มีนาเจอปูตัวเล็กบนหาดทราย", pic:"animals|CRAB" },
      { en:"\"Hello, crab!\" The crab walks sideways.", th:"\"สวัสดีเจ้าปู!\" ปูเดินข้างๆ", pic:"animals|CRAB" },
      { en:"Mom buys coconut water. It is cold and sweet.", th:"แม่ซื้อน้ำมะพร้าว เย็นและหวาน", pic:"fruits|COCONUT" },
      { en:"In the evening, the sun goes down. The sky is orange.", th:"ตอนเย็น พระอาทิตย์ตก ท้องฟ้าสีส้ม", pic:"nature|SUN" },
      { en:"\"What a beautiful day!\" says Mina.", th:"\"วันนี้สวยงามจัง!\" มีนาพูด", pic:"family|FAMILY" },
    ],
    quiz:[
      { q:"What does Mina wear?", qTh:"มีนาใส่อะไร", options:["A hat and sandals","Boots and gloves","A coat"], answer:"A hat and sandals" },
      { q:"What does Mina find on the sand?", qTh:"มีนาเจออะไรบนหาดทราย", options:["A shell","A crab","A fish"], answer:"A crab" },
      { q:"What does Mom buy?", qTh:"แม่ซื้ออะไร", options:["Ice cream","Coconut water","Orange juice"], answer:"Coconut water" },
    ] },
  { id:"school", emoji:"🏫", title:"My First Day", titleTh:"วันแรกที่โรงเรียน", level:"A1+",
    pages:[
      { en:"Today is Tom's first day at a new school.", th:"วันนี้เป็นวันแรกของทอมที่โรงเรียนใหม่", pic:"places|SCHOOL" },
      { en:"He is a little scared. He does not know anyone.", th:"เขากลัวนิดหน่อย ไม่รู้จักใครเลย", pic:"feelings|SCARED" },
      { en:"The teacher smiles. \"Welcome, Tom! Please sit here.\"", th:"คุณครูยิ้ม \"ยินดีต้อนรับทอม นั่งตรงนี้นะ\"", pic:"school|CLASSROOM" },
      { en:"A girl says, \"Hi! I am Mina. Do you like to draw?\"", th:"เด็กผู้หญิงพูดว่า \"สวัสดี ฉันมีนา ชอบวาดรูปไหม\"", pic:"actions|DRAW" },
      { en:"\"Yes!\" says Tom. They draw a big yellow sun.", th:"\"ชอบ!\" ทอมตอบ ทั้งคู่วาดดวงอาทิตย์สีเหลืองดวงใหญ่", pic:"school|CRAYON" },
      { en:"At lunch, they eat fried rice together.", th:"ตอนกลางวัน พวกเขากินข้าวผัดด้วยกัน", pic:"food|FRIED RICE" },
      { en:"After school, they play on the playground.", th:"หลังเลิกเรียน พวกเขาเล่นที่สนามเด็กเล่น", pic:"places|PLAYGROUND" },
      { en:"Tom is not scared now. He has a new friend!", th:"ตอนนี้ทอมไม่กลัวแล้ว เขามีเพื่อนใหม่!", pic:"feelings|HAPPY" },
    ],
    quiz:[
      { q:"How does Tom feel at first?", qTh:"ตอนแรกทอมรู้สึกอย่างไร", options:["Scared","Angry","Tired"], answer:"Scared" },
      { q:"What do Tom and Mina draw?", qTh:"ทอมกับมีนาวาดอะไร", options:["A cat","A sun","A house"], answer:"A sun" },
      { q:"What do they eat at lunch?", qTh:"พวกเขากินอะไรตอนกลางวัน", options:["Noodles","Pizza","Fried rice"], answer:"Fried rice" },
    ] },
];

// ── โฟนิกส์: ตัวอักษร · ชื่อ · เสียง (คำอธิบายไทย) · คำตัวอย่าง (key คำในคลัง)
export const PHONICS = [
  { L:"A", name:"เอ", sound:"แอะ", words:["fruits|APPLE","animals|ANT","body|ARM"] },
  { L:"B", name:"บี", sound:"เบอะ", words:["animals|BEAR","toys|BALL","fruits|BANANA"] },
  { L:"C", name:"ซี", sound:"เคอะ", words:["animals|CAT","vehicles|CAR","food|CAKE"] },
  { L:"D", name:"ดี", sound:"เดอะ", words:["animals|DOG","animals|DUCK","toys|DOLL"] },
  { L:"E", name:"อี", sound:"เอะ", words:["food|EGG","animals|ELEPHANT","body|EAR"] },
  { L:"F", name:"เอฟ", sound:"เฟอะ", words:["animals|FISH","animals|FROG","animals|FOX"] },
  { L:"G", name:"จี", sound:"เกอะ", words:["animals|GOAT","fruits|GRAPE","toys|GUITAR"] },
  { L:"H", name:"เอช", sound:"เฮอะ", words:["clothes|HAT","body|HAND","animals|HORSE"] },
  { L:"I", name:"ไอ", sound:"อิ", words:["food|ICECREAM","nature|ISLAND"] },
  { L:"J", name:"เจ", sound:"เจอะ", words:["food|JUICE","clothes|JACKET","sports|JUMP"] },
  { L:"K", name:"เค", sound:"เคอะ", words:["toys|KITE","home|KEY","animals|KANGAROO"] },
  { L:"L", name:"แอล", sound:"เลอะ", words:["animals|LION","fruits|LEMON","nature|LEAF"] },
  { L:"M", name:"เอ็ม", sound:"เมอะ", words:["animals|MONKEY","food|MILK","nature|MOON"] },
  { L:"N", name:"เอ็น", sound:"เนอะ", words:["body|NOSE","food|NOODLES","school|NOTEBOOK"] },
  { L:"O", name:"โอ", sound:"เอาะ", words:["animals|OCTOPUS","animals|OWL","fruits|ORANGE"] },
  { L:"P", name:"พี", sound:"เพอะ", words:["animals|PIG","food|PIZZA","school|PEN"] },
  { L:"Q", name:"คิว", sound:"ควอะ", words:["QUEEN|ราชินี|👸","QUESTION|คำถาม|❓"] },
  { L:"R", name:"อาร์", sound:"เรอะ", words:["animals|RABBIT","weather|RAIN","toys|ROBOT"] },
  { L:"S", name:"เอส", sound:"ซึ", words:["animals|SNAKE","nature|SUN","clothes|SOCKS"] },
  { L:"T", name:"ที", sound:"เทอะ", words:["animals|TIGER","nature|TREE","vehicles|TRAIN"] },
  { L:"U", name:"ยู", sound:"อะ", words:["clothes|UMBRELLA","family|UNCLE"] },
  { L:"V", name:"วี", sound:"เวอะ", words:["vehicles|VAN","nature|VOLCANO","sports|VOLLEYBALL"] },
  { L:"W", name:"ดับเบิลยู", sound:"เวอะ", words:["animals|WHALE","food|WATER","nature|WATERFALL"] },
  { L:"X", name:"เอ็กซ์", sound:"คส์", words:["X-RAY|เอกซเรย์|🩻","XYLOPHONE|ระนาดฝรั่ง|🎵"] },
  { L:"Y", name:"วาย", sound:"เยอะ", words:["food|YOGURT","toys|YO-YO","sports|YOGA"] },
  { L:"Z", name:"แซด", sound:"เซอะ", words:["animals|ZEBRA","places|ZOO"] },
];

// ═══════════════════════════════════════════════════════
// บทสนทนาเพิ่มเติม (ชุดที่ 2)
// ═══════════════════════════════════════════════════════
DIALOGUES.push(
  { id:"shop", emoji:"👟", title:"Buying shoes", titleTh:"ซื้อรองเท้า", scene:"clothes|SHOES", a:"Seller", b:"Mom",
    lines:[
      { who:"A", en:"Hello! Can I help you?", th:"สวัสดีค่ะ ให้ช่วยอะไรไหมคะ", blank:"help" },
      { who:"B", en:"Yes. I need shoes for my son.", th:"ค่ะ อยากได้รองเท้าให้ลูกชาย", blank:"shoes" },
      { who:"A", en:"What size?", th:"ไซส์อะไรคะ" },
      { who:"B", en:"Size thirty. Do you have blue?", th:"ไซส์สามสิบ มีสีน้ำเงินไหม", blank:"blue" },
      { who:"A", en:"Yes! Here are the blue shoes.", th:"มีค่ะ นี่รองเท้าสีน้ำเงิน" },
      { who:"B", en:"How much are they?", th:"ราคาเท่าไหร่", blank:"much" },
      { who:"A", en:"Five hundred baht.", th:"ห้าร้อยบาทค่ะ", blank:"hundred" },
      { who:"B", en:"OK, I'll take them. Thank you.", th:"ตกลง เอาคู่นี้ค่ะ ขอบคุณ" },
    ] },
  { id:"phone", emoji:"📞", title:"On the phone", titleTh:"คุยโทรศัพท์", scene:"home|PHONE", a:"Tom", b:"Grandma",
    lines:[
      { who:"A", en:"Hello, Grandma! It's Tom.", th:"สวัสดีครับคุณยาย ทอมเองครับ" },
      { who:"B", en:"Hello, Tom! How are you?", th:"สวัสดีจ้ะทอม สบายดีไหม" },
      { who:"A", en:"I am fine. What are you doing?", th:"สบายดีครับ ยายกำลังทำอะไรอยู่", blank:"doing" },
      { who:"B", en:"I am cooking soup. Are you coming on Sunday?", th:"ยายกำลังต้มซุป วันอาทิตย์จะมาไหม", blank:"Sunday" },
      { who:"A", en:"Yes! Can I bring my friend Mina?", th:"มาครับ พาเพื่อนชื่อมีนามาด้วยได้ไหม", blank:"friend" },
      { who:"B", en:"Of course! I will make a cake.", th:"ได้สิจ๊ะ ยายจะทำเค้กให้", blank:"cake" },
      { who:"A", en:"Yay! See you on Sunday, Grandma!", th:"เย้ เจอกันวันอาทิตย์นะครับ" },
    ] },
  { id:"lost_way", emoji:"🗺️", title:"Where is the library?", titleTh:"ถามทาง", scene:"places|LIBRARY", a:"Mina", b:"Police",
    lines:[
      { who:"A", en:"Excuse me, where is the library?", th:"ขอโทษค่ะ ห้องสมุดอยู่ที่ไหนคะ", blank:"library" },
      { who:"B", en:"Go straight and turn left at the bank.", th:"ตรงไปแล้วเลี้ยวซ้ายที่ธนาคาร", blank:"left" },
      { who:"A", en:"Is it far?", th:"ไกลไหมคะ", blank:"far" },
      { who:"B", en:"No, it is near. About five minutes.", th:"ไม่ไกล ใกล้ๆ ประมาณห้านาที", blank:"near" },
      { who:"A", en:"Is it next to the park?", th:"อยู่ข้างสวนสาธารณะใช่ไหมคะ", blank:"park" },
      { who:"B", en:"Yes, next to the park. You can't miss it.", th:"ใช่ ข้างสวนเลย หาไม่ยาก" },
      { who:"A", en:"Thank you very much!", th:"ขอบคุณมากค่ะ" },
    ] },
  { id:"sports", emoji:"⚽", title:"Let's play!", titleTh:"ชวนเล่นกีฬา", scene:"sports|FOOTBALL", a:"Tom", b:"Mina",
    lines:[
      { who:"A", en:"Mina, do you like football?", th:"มีนา ชอบฟุตบอลไหม", blank:"football" },
      { who:"B", en:"Yes, but I like swimming more.", th:"ชอบ แต่ชอบว่ายน้ำมากกว่า", blank:"swimming" },
      { who:"A", en:"Can you swim fast?", th:"ว่ายน้ำเร็วไหม", blank:"fast" },
      { who:"B", en:"Yes, I can! Can you?", th:"เร็วสิ แล้วเธอล่ะ" },
      { who:"A", en:"No, I can't swim. But I can run fast.", th:"ไม่ ฉันว่ายน้ำไม่ได้ แต่วิ่งเร็ว", blank:"run" },
      { who:"B", en:"Let's play basketball together!", th:"งั้นมาเล่นบาสด้วยกัน", blank:"basketball" },
      { who:"A", en:"Great idea! I have a ball.", th:"ดีเลย ฉันมีลูกบอล", blank:"ball" },
    ] },
  { id:"breakfast", emoji:"🍳", title:"Breakfast time", titleTh:"มื้อเช้า", scene:"food|EGG", a:"Dad", b:"Mina",
    lines:[
      { who:"A", en:"Good morning! Breakfast is ready.", th:"อรุณสวัสดิ์ อาหารเช้าพร้อมแล้ว", blank:"ready" },
      { who:"B", en:"What is it?", th:"มีอะไรคะ" },
      { who:"A", en:"Eggs, bread and milk.", th:"ไข่ ขนมปัง แล้วก็นม", blank:"bread" },
      { who:"B", en:"Can I have some honey, please?", th:"ขอน้ำผึ้งหน่อยได้ไหมคะ", blank:"honey" },
      { who:"A", en:"Here you are. Don't forget your water.", th:"นี่จ้ะ อย่าลืมดื่มน้ำนะ", blank:"water" },
      { who:"B", en:"Thank you, Dad. It's delicious!", th:"ขอบคุณค่ะพ่อ อร่อยมาก" },
      { who:"A", en:"Finish your milk. Then brush your teeth.", th:"ดื่มนมให้หมด แล้วไปแปรงฟัน", blank:"milk" },
    ] },
  { id:"pet", emoji:"🐶", title:"My new puppy", titleTh:"ลูกหมาตัวใหม่", scene:"animals|DOG", a:"Mina", b:"Tom",
    lines:[
      { who:"A", en:"Tom, look! I have a new puppy.", th:"ทอม ดูสิ ฉันมีลูกหมาตัวใหม่", blank:"puppy" },
      { who:"B", en:"Wow! What is his name?", th:"ว้าว ชื่ออะไร", blank:"name" },
      { who:"A", en:"His name is Max. He is three months old.", th:"ชื่อแม็กซ์ อายุสามเดือน", blank:"three" },
      { who:"B", en:"He is so small! What does he eat?", th:"ตัวเล็กจัง กินอะไร", blank:"small" },
      { who:"A", en:"He eats dog food and drinks milk.", th:"กินอาหารหมาแล้วก็ดื่มนม", blank:"milk" },
      { who:"B", en:"Can I play with him?", th:"ขอเล่นด้วยได้ไหม", blank:"play" },
      { who:"A", en:"Sure! He likes to run and jump.", th:"ได้สิ มันชอบวิ่งแล้วก็กระโดด", blank:"jump" },
    ] },
);

// ═══════════════════════════════════════════════════════
// นิทานเพิ่มเติม (ชุดที่ 2)
// ═══════════════════════════════════════════════════════
STORIES.push(
  { id:"ant", emoji:"🐜", title:"The Ant and the Bird", titleTh:"มดกับนก", level:"A1+",
    pages:[
      { en:"A little ant is thirsty. She walks to the river.", th:"มดตัวน้อยกระหายน้ำ เธอเดินไปที่แม่น้ำ", pic:"animals|ANT" },
      { en:"Oh no! The ant falls into the water!", th:"แย่แล้ว! มดตกลงไปในน้ำ!", pic:"nature|RIVER" },
      { en:"A bird sees the ant. She drops a leaf.", th:"นกเห็นมด จึงปล่อยใบไม้ลงมา", pic:"animals|BIRD" },
      { en:"The ant climbs on the leaf. She is safe!", th:"มดปีนขึ้นบนใบไม้ ปลอดภัยแล้ว!", pic:"nature|LEAF" },
      { en:"\"Thank you, bird!\" says the ant.", th:"\"ขอบคุณนะเจ้านก!\" มดพูด", pic:"feelings|HAPPY" },
      { en:"One day, a man wants to catch the bird.", th:"วันหนึ่ง มีผู้ชายอยากจับนก", pic:"nature|TREE" },
      { en:"The ant bites the man's foot. \"Ouch!\" The bird flies away.", th:"มดกัดเท้าผู้ชาย \"โอ๊ย!\" นกบินหนีไปได้", pic:"body|FOOT" },
      { en:"Small friends can help too!", th:"เพื่อนตัวเล็กก็ช่วยได้เหมือนกัน!", pic:"animals|ANT" },
    ],
    quiz:[
      { q:"Why does the ant go to the river?", qTh:"ทำไมมดไปที่แม่น้ำ", options:["She is thirsty","She is tired","She is sad"], answer:"She is thirsty" },
      { q:"What does the bird drop?", qTh:"นกปล่อยอะไรลงมา", options:["A rock","A leaf","A flower"], answer:"A leaf" },
      { q:"How does the ant help the bird?", qTh:"มดช่วยนกอย่างไร", options:["She sings","She bites the man","She flies"], answer:"She bites the man" },
    ] },
  { id:"market", emoji:"🛒", title:"Shopping with Mom", titleTh:"ไปตลาดกับแม่", level:"A1",
    pages:[
      { en:"Mina goes to the market with Mom on Saturday.", th:"วันเสาร์ มีนาไปตลาดกับแม่", pic:"places|MARKET" },
      { en:"Mom buys rice, eggs and fish.", th:"แม่ซื้อข้าว ไข่ และปลา", pic:"food|RICE" },
      { en:"Mina sees mangoes. \"Can we buy mangoes?\"", th:"มีนาเห็นมะม่วง \"ซื้อมะม่วงได้ไหมคะ\"", pic:"fruits|MANGO" },
      { en:"\"Yes, two mangoes,\" says Mom.", th:"\"ได้จ้ะ สองลูก\" แม่ตอบ", pic:"numbers|TWO" },
      { en:"The seller gives Mina a small banana for free.", th:"แม่ค้าให้กล้วยลูกเล็กมีนาฟรีหนึ่งลูก", pic:"fruits|BANANA" },
      { en:"\"Thank you!\" Mina is happy.", th:"\"ขอบคุณค่ะ!\" มีนาดีใจ", pic:"feelings|HAPPY" },
      { en:"At home, Mom cooks fried rice. Yummy!", th:"ที่บ้าน แม่ทำข้าวผัด อร่อย!", pic:"food|FRIED RICE" },
      { en:"Mina eats a mango for dessert.", th:"มีนากินมะม่วงเป็นของหวาน", pic:"fruits|MANGO" },
    ],
    quiz:[
      { q:"When do they go to the market?", qTh:"พวกเขาไปตลาดวันไหน", options:["On Monday","On Saturday","On Sunday"], answer:"On Saturday" },
      { q:"How many mangoes do they buy?", qTh:"ซื้อมะม่วงกี่ลูก", options:["One","Two","Three"], answer:"Two" },
      { q:"What does Mom cook?", qTh:"แม่ทำอะไร", options:["Soup","Pizza","Fried rice"], answer:"Fried rice" },
    ] },
  { id:"sick", emoji:"🤒", title:"Tom Is Sick", titleTh:"ทอมไม่สบาย", level:"A1+",
    pages:[
      { en:"Tom wakes up. His head hurts and he is hot.", th:"ทอมตื่นขึ้นมา ปวดหัวและตัวร้อน", pic:"feelings|SICK" },
      { en:"\"Mom, I don't feel well,\" he says.", th:"\"แม่ครับ ผมไม่สบาย\" เขาพูด", pic:"family|MOTHER" },
      { en:"Mom takes Tom to the hospital.", th:"แม่พาทอมไปโรงพยาบาล", pic:"places|HOSPITAL" },
      { en:"The doctor looks at his mouth and ears.", th:"หมอตรวจปากและหูของเขา", pic:"jobs|DOCTOR" },
      { en:"\"Drink water and rest,\" says the doctor.", th:"\"ดื่มน้ำแล้วพักผ่อนนะ\" หมอบอก", pic:"food|WATER" },
      { en:"Tom sleeps all day. Mom makes chicken soup.", th:"ทอมนอนทั้งวัน แม่ทำซุปไก่ให้", pic:"food|SOUP" },
      { en:"The next day, Tom feels better!", th:"วันต่อมา ทอมรู้สึกดีขึ้น!", pic:"feelings|HAPPY" },
      { en:"\"Thank you, Mom. Thank you, doctor!\"", th:"\"ขอบคุณครับแม่ ขอบคุณครับคุณหมอ!\"", pic:"family|FAMILY" },
    ],
    quiz:[
      { q:"What hurts?", qTh:"ทอมเจ็บตรงไหน", options:["His head","His leg","His hand"], answer:"His head" },
      { q:"Where does Mom take Tom?", qTh:"แม่พาทอมไปไหน", options:["To school","To the hospital","To the zoo"], answer:"To the hospital" },
      { q:"What does Mom make?", qTh:"แม่ทำอะไรให้", options:["Pizza","Chicken soup","Cake"], answer:"Chicken soup" },
    ] },
  { id:"kite", emoji:"🪁", title:"The Big Kite", titleTh:"ว่าวตัวใหญ่", level:"A2",
    pages:[
      { en:"It is a windy day. Tom and Mina make a kite.", th:"วันนี้ลมแรง ทอมกับมีนาทำว่าว", pic:"weather|WIND" },
      { en:"The kite is red and yellow. It is very big.", th:"ว่าวสีแดงและเหลือง ตัวใหญ่มาก", pic:"toys|KITE" },
      { en:"They run to the park. The kite flies high!", th:"พวกเขาวิ่งไปที่สวน ว่าวลอยสูง!", pic:"places|PARK" },
      { en:"Suddenly, the wind stops. The kite falls into a tree.", th:"ทันใดนั้นลมหยุด ว่าวตกลงไปติดต้นไม้", pic:"nature|TREE" },
      { en:"\"How can we get it?\" asks Mina.", th:"\"เราจะเอาลงมายังไง\" มีนาถาม", pic:"feelings|SAD" },
      { en:"A tall man with a ladder helps them.", th:"ชายร่างสูงกับบันไดมาช่วย", pic:"jobs|BUILDER" },
      { en:"He climbs up and gets the kite. Hooray!", th:"เขาปีนขึ้นไปเอาว่าวลงมา เย้!", pic:"actions|CLIMB" },
      { en:"The wind comes back. The kite flies again!", th:"ลมกลับมาแล้ว ว่าวลอยอีกครั้ง!", pic:"toys|KITE" },
    ],
    quiz:[
      { q:"What colors is the kite?", qTh:"ว่าวสีอะไร", options:["Blue and green","Red and yellow","Black and white"], answer:"Red and yellow" },
      { q:"Where does the kite fall?", qTh:"ว่าวตกไปที่ไหน", options:["Into a tree","Into the river","On the road"], answer:"Into a tree" },
      { q:"Who helps them?", qTh:"ใครมาช่วย", options:["A teacher","A tall man with a ladder","A police officer"], answer:"A tall man with a ladder" },
    ] },
);

// ═══════════════════════════════════════════════════════
// ไวยากรณ์เด็ก — บทเรียนสั้น: กฎ (ไทย) + ตัวอย่าง + แบบฝึก (เลือกคำเติม)
// pic = key คำในคลัง เพื่อโชว์รูปประกอบตัวอย่าง
// ═══════════════════════════════════════════════════════
export const GRAMMAR = [
  { id:"a_an", emoji:"🍎", title:"a / an", titleTh:"a กับ an ใช้ต่างกันยังไง",
    rules:[
      { th:"ใช้ a หน้าคำที่ขึ้นต้นด้วยเสียงพยัญชนะ", en:"a cat · a dog · a book", pic:"animals|CAT" },
      { th:"ใช้ an หน้าคำที่ขึ้นต้นด้วยเสียงสระ a e i o u", en:"an apple · an egg · an elephant", pic:"fruits|APPLE" },
      { th:"a / an แปลว่า \"หนึ่ง\" ใช้กับของที่นับได้ 1 ชิ้นเท่านั้น", en:"I have a banana. I eat an orange.", pic:"fruits|ORANGE" },
    ],
    practice:[
      { q:"I see ___ elephant.", options:["a","an"], answer:"an", th:"ฉันเห็นช้างหนึ่งตัว" },
      { q:"She has ___ dog.", options:["a","an"], answer:"a", th:"เธอมีหมาหนึ่งตัว" },
      { q:"This is ___ umbrella.", options:["a","an"], answer:"an", th:"นี่คือร่ม" },
      { q:"He eats ___ egg.", options:["a","an"], answer:"an", th:"เขากินไข่หนึ่งฟอง" },
      { q:"I want ___ pizza.", options:["a","an"], answer:"a", th:"ฉันอยากได้พิซซ่า" },
      { q:"Look! ___ owl!", options:["A","An"], answer:"An", th:"ดูสิ นกฮูก!" },
      { q:"It is ___ red car.", options:["a","an"], answer:"a", th:"มันคือรถสีแดง" },
      { q:"I have ___ idea!", options:["a","an"], answer:"an", th:"ฉันมีไอเดีย!" },
    ] },
  { id:"plural", emoji:"🐱", title:"one cat, two cats", titleTh:"หลายอันเติม s / es",
    rules:[
      { th:"ของมากกว่า 1 ชิ้น เติม s ท้ายคำ", en:"one cat → two cats · one book → three books", pic:"animals|CAT" },
      { th:"คำที่ลงท้ายด้วย s, x, ch, sh เติม es", en:"one bus → two buses · one box → two boxes", pic:"vehicles|BUS" },
      { th:"บางคำเปลี่ยนรูปพิเศษ ต้องจำ", en:"one man → two men · one child → two children · one fish → two fish · one foot → two feet", pic:"body|FOOT" },
    ],
    practice:[
      { q:"I have two ___.", options:["dog","dogs"], answer:"dogs", th:"ฉันมีหมาสองตัว" },
      { q:"There are three ___.", options:["buses","buss"], answer:"buses", th:"มีรถบัสสามคัน" },
      { q:"I see five ___.", options:["bird","birds"], answer:"birds", th:"ฉันเห็นนกห้าตัว" },
      { q:"She has ten ___.", options:["fingers","finger"], answer:"fingers", th:"เธอมีสิบนิ้ว" },
      { q:"Two ___ are swimming.", options:["fishes","fish"], answer:"fish", th:"ปลาสองตัวกำลังว่ายน้ำ" },
      { q:"I wash my two ___.", options:["foots","feet"], answer:"feet", th:"ฉันล้างเท้าสองข้าง" },
      { q:"Four ___ are in the class.", options:["children","childs"], answer:"children", th:"เด็กสี่คนอยู่ในห้อง" },
      { q:"I eat six ___.", options:["cookies","cookie"], answer:"cookies", th:"ฉันกินคุกกี้หกชิ้น" },
    ] },
  { id:"be", emoji:"🧒", title:"am / is / are", titleTh:"ฉันคือ เธอคือ เขาคือ",
    rules:[
      { th:"I ใช้ am", en:"I am a student. I am happy.", pic:"school|STUDENT" },
      { th:"You / We / They ใช้ are", en:"You are my friend. They are teachers.", pic:"family|FAMILY" },
      { th:"He / She / It (คนเดียว สัตว์ตัวเดียว ของชิ้นเดียว) ใช้ is", en:"He is tall. She is a nurse. It is a cat.", pic:"jobs|NURSE" },
    ],
    practice:[
      { q:"I ___ seven years old.", options:["am","is","are"], answer:"am", th:"ฉันอายุเจ็ดขวบ" },
      { q:"She ___ my sister.", options:["am","is","are"], answer:"is", th:"เธอเป็นพี่สาวของฉัน" },
      { q:"They ___ at school.", options:["am","is","are"], answer:"are", th:"พวกเขาอยู่ที่โรงเรียน" },
      { q:"It ___ a big elephant.", options:["am","is","are"], answer:"is", th:"มันคือช้างตัวใหญ่" },
      { q:"You ___ very kind.", options:["am","is","are"], answer:"are", th:"เธอใจดีมาก" },
      { q:"We ___ hungry.", options:["am","is","are"], answer:"are", th:"พวกเราหิว" },
      { q:"He ___ a doctor.", options:["am","is","are"], answer:"is", th:"เขาเป็นหมอ" },
      { q:"The cats ___ sleeping.", options:["am","is","are"], answer:"are", th:"แมวกำลังนอน" },
    ] },
  { id:"this_that", emoji:"👉", title:"this / that / these / those", titleTh:"นี่ นั่น เหล่านี้ เหล่านั้น",
    rules:[
      { th:"this = นี่ (ใกล้ 1 ชิ้น) · that = นั่น (ไกล 1 ชิ้น)", en:"This is my bag. That is your bag.", pic:"school|BAG" },
      { th:"these = เหล่านี้ (ใกล้ หลายชิ้น) · those = เหล่านั้น (ไกล หลายชิ้น)", en:"These are apples. Those are oranges.", pic:"fruits|APPLE" },
      { th:"ถามว่า \"นี่อะไร\" ใช้ What is this? ตอบ It is a ...", en:"What is this? — It is a pencil.", pic:"school|PENCIL" },
    ],
    practice:[
      { q:"___ is my pen. (ใกล้ 1 ด้าม)", options:["This","These"], answer:"This", th:"นี่คือปากกาของฉัน" },
      { q:"___ are my shoes. (ใกล้ หลายข้าง)", options:["This","These"], answer:"These", th:"นี่คือรองเท้าของฉัน" },
      { q:"___ is a bird in the tree. (ไกล)", options:["That","Those"], answer:"That", th:"นั่นคือนกบนต้นไม้" },
      { q:"___ are clouds in the sky. (ไกล)", options:["That","Those"], answer:"Those", th:"นั่นคือเมฆบนฟ้า" },
      { q:"What is ___? — It is a cat.", options:["this","these"], answer:"this", th:"นี่อะไร — แมว" },
      { q:"___ bananas are yellow. (ใกล้)", options:["These","This"], answer:"These", th:"กล้วยพวกนี้สีเหลือง" },
    ] },
  { id:"can", emoji:"💪", title:"can / can't", titleTh:"ทำได้ / ทำไม่ได้",
    rules:[
      { th:"can = ทำได้ ตามด้วยกริยาไม่เติมอะไร", en:"I can swim. A bird can fly.", pic:"actions|SWIM" },
      { th:"can't (cannot) = ทำไม่ได้", en:"A fish can't walk. I can't fly.", pic:"animals|FISH" },
      { th:"ถาม Can you ...? ตอบ Yes, I can. / No, I can't.", en:"Can you dance? — Yes, I can!", pic:"actions|DANCE" },
    ],
    practice:[
      { q:"A bird ___ fly.", options:["can","can't"], answer:"can", th:"นกบินได้" },
      { q:"A fish ___ walk.", options:["can","can't"], answer:"can't", th:"ปลาเดินไม่ได้" },
      { q:"I ___ swim. I love the pool!", options:["can","can't"], answer:"can", th:"ฉันว่ายน้ำได้ ฉันรักสระน้ำ" },
      { q:"A baby ___ drive a car.", options:["can","can't"], answer:"can't", th:"เด็กทารกขับรถไม่ได้" },
      { q:"___ you sing? — Yes, I can.", options:["Can","Is"], answer:"Can", th:"ร้องเพลงได้ไหม — ได้" },
      { q:"A monkey ___ climb trees.", options:["can","can't"], answer:"can", th:"ลิงปีนต้นไม้ได้" },
      { q:"An elephant ___ jump.", options:["can","can't"], answer:"can't", th:"ช้างกระโดดไม่ได้" },
      { q:"I ___ read English now!", options:["can","can't"], answer:"can", th:"ตอนนี้ฉันอ่านอังกฤษได้แล้ว!" },
    ] },
  { id:"have", emoji:"🎒", title:"have / has", titleTh:"มี",
    rules:[
      { th:"I / You / We / They ใช้ have", en:"I have a bag. They have two dogs.", pic:"school|BAG" },
      { th:"He / She / It ใช้ has", en:"She has long hair. The dog has four legs.", pic:"animals|DOG" },
      { th:"ถามว่ามีไหม Do you have ...? ตอบ Yes, I do. / No, I don't.", en:"Do you have a pencil? — Yes, I do.", pic:"school|PENCIL" },
    ],
    practice:[
      { q:"I ___ a red bike.", options:["have","has"], answer:"have", th:"ฉันมีจักรยานสีแดง" },
      { q:"She ___ a cat.", options:["have","has"], answer:"has", th:"เธอมีแมว" },
      { q:"They ___ three children.", options:["have","has"], answer:"have", th:"พวกเขามีลูกสามคน" },
      { q:"The cow ___ four legs.", options:["have","has"], answer:"has", th:"วัวมีสี่ขา" },
      { q:"We ___ English on Monday.", options:["have","has"], answer:"have", th:"เรามีเรียนอังกฤษวันจันทร์" },
      { q:"My father ___ a big car.", options:["have","has"], answer:"has", th:"พ่อของฉันมีรถคันใหญ่" },
      { q:"___ you have a sister?", options:["Do","Does"], answer:"Do", th:"เธอมีพี่สาวไหม" },
      { q:"It ___ a long tail.", options:["have","has"], answer:"has", th:"มันมีหางยาว" },
    ] },
  { id:"prep", emoji:"📦", title:"in / on / under", titleTh:"ใน บน ใต้",
    rules:[
      { th:"in = ใน", en:"The milk is in the fridge.", pic:"home|FRIDGE" },
      { th:"on = บน", en:"The book is on the table.", pic:"home|TABLE" },
      { th:"under = ใต้ · next to = ข้างๆ", en:"The cat is under the bed. The lamp is next to the sofa.", pic:"home|BED" },
    ],
    practice:[
      { q:"The ball is ___ the box. (ในกล่อง)", options:["in","on","under"], answer:"in", th:"ลูกบอลอยู่ในกล่อง" },
      { q:"The cup is ___ the table. (บนโต๊ะ)", options:["in","on","under"], answer:"on", th:"แก้วอยู่บนโต๊ะ" },
      { q:"The dog sleeps ___ the bed. (ใต้เตียง)", options:["in","on","under"], answer:"under", th:"หมานอนใต้เตียง" },
      { q:"Fish live ___ the water.", options:["in","on","under"], answer:"in", th:"ปลาอาศัยในน้ำ" },
      { q:"Put your hat ___ your head.", options:["in","on","under"], answer:"on", th:"ใส่หมวกบนหัว" },
      { q:"The shoes are ___ the chair. (ใต้)", options:["in","on","under"], answer:"under", th:"รองเท้าอยู่ใต้เก้าอี้" },
    ] },
  { id:"question", emoji:"❓", title:"What / Where / Who / How many", titleTh:"คำถาม อะไร ที่ไหน ใคร กี่",
    rules:[
      { th:"What = อะไร · Where = ที่ไหน", en:"What is this? Where is my bag?", pic:"school|BAG" },
      { th:"Who = ใคร · How many = กี่ (จำนวน)", en:"Who is she? How many apples?", pic:"fruits|APPLE" },
      { th:"How old = อายุเท่าไหร่ · What color = สีอะไร", en:"How old are you? What color is it?", pic:"colors|RED" },
    ],
    practice:[
      { q:"___ is your name? — My name is Tom.", options:["What","Where","Who"], answer:"What", th:"ชื่ออะไร" },
      { q:"___ is the cat? — Under the table.", options:["What","Where","Who"], answer:"Where", th:"แมวอยู่ไหน" },
      { q:"___ is that man? — He is my uncle.", options:["What","Where","Who"], answer:"Who", th:"ผู้ชายคนนั้นคือใคร" },
      { q:"___ many eggs? — Six.", options:["How","What","Who"], answer:"How", th:"ไข่กี่ฟอง" },
      { q:"___ old are you? — I am eight.", options:["How","What","Where"], answer:"How", th:"อายุเท่าไหร่" },
      { q:"___ color is the sky? — Blue.", options:["What","Where","Who"], answer:"What", th:"ท้องฟ้าสีอะไร" },
    ] },
];

// ═══════════════════════════════════════════════════════
// ชีวิตประจำวัน — วัน/เดือน (ใช้ในเกมปฏิทิน) · ตัวเลขเป็นคำ
// ═══════════════════════════════════════════════════════
export const DAYS = [
  ["Monday","วันจันทร์","มัน-เดย์","💛"],["Tuesday","วันอังคาร","ทิวส์-เดย์","💗"],["Wednesday","วันพุธ","เวนส์-เดย์","💚"],
  ["Thursday","วันพฤหัสบดี","เธิร์ส-เดย์","🧡"],["Friday","วันศุกร์","ฟราย-เดย์","💙"],["Saturday","วันเสาร์","แซท-เทอร์-เดย์","💜"],["Sunday","วันอาทิตย์","ซัน-เดย์","❤️"],
];
export const MONTHS = [
  ["January","มกราคม","แจน-ยู-อะ-รี่"],["February","กุมภาพันธ์","เฟบ-รู-อะ-รี่"],["March","มีนาคม","มาร์ช"],["April","เมษายน","เอ-พริล"],
  ["May","พฤษภาคม","เมย์"],["June","มิถุนายน","จูน"],["July","กรกฎาคม","จู-ลาย"],["August","สิงหาคม","ออ-กัสท์"],
  ["September","กันยายน","เซ็พ-เทม-เบอร์"],["October","ตุลาคม","อ็อก-โท-เบอร์"],["November","พฤศจิกายน","โน-เวม-เบอร์"],["December","ธันวาคม","ดี-เซม-เบอร์"],
];
const ONES = ["zero","one","two","three","four","five","six","seven","eight","nine","ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen"];
const TENS = ["","","twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety"];
export function numberWord(n) {
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? "-" + ONES[n % 10] : "");
  if (n < 1000) return ONES[Math.floor(n / 100)] + " hundred" + (n % 100 ? " " + numberWord(n % 100) : "");
  return "one thousand";
}
const TH_ONES = ["ศูนย์","หนึ่ง","สอง","สาม","สี่","ห้า","หก","เจ็ด","แปด","เก้า"];
export function numberThai(n) {
  if (n === 0) return "ศูนย์";
  if (n >= 1000) return "หนึ่งพัน";
  let s = "";
  const h = Math.floor(n / 100), t = Math.floor((n % 100) / 10), o = n % 10;
  if (h) s += TH_ONES[h] + "ร้อย";
  if (t === 1) s += "สิบ"; else if (t === 2) s += "ยี่สิบ"; else if (t) s += TH_ONES[t] + "สิบ";
  if (o === 1 && t) s += "เอ็ด"; else if (o) s += TH_ONES[o];
  return s;
}
// อ่านเวลาแบบง่ายสำหรับเด็ก: o'clock / half past / H:MM
export function timeWord(h, m) {
  const hw = numberWord(h);
  if (m === 0) return `${hw} o'clock`;
  if (m === 30) return `half past ${hw}`;
  if (m === 15) return `quarter past ${hw}`;
  if (m === 45) return `quarter to ${numberWord(h % 12 + 1)}`;
  return `${hw} ${m < 10 ? "oh " : ""}${numberWord(m)}`;
}
export function timeThai(h, m) {
  const base = `${h} นาฬิกา`;
  return m === 0 ? `${base}ตรง` : m === 30 ? `${base}ครึ่ง` : `${base} ${m} นาที`;
}
export const MONEY = [
  { v:1, emoji:"🪙", name:"เหรียญ 1 บาท" }, { v:2, emoji:"🪙", name:"เหรียญ 2 บาท" }, { v:5, emoji:"🪙", name:"เหรียญ 5 บาท" }, { v:10, emoji:"🪙", name:"เหรียญ 10 บาท" },
  { v:20, emoji:"💵", name:"แบงก์ 20" }, { v:50, emoji:"💵", name:"แบงก์ 50" }, { v:100, emoji:"💵", name:"แบงก์ 100" },
];

// ═══════════════════════════════════════════════════════
// ระดับจากคะแนนสอบวัดระดับ 20 ข้อ
// ═══════════════════════════════════════════════════════
export const LEVELS_TEST = [
  { min:18, level:"A2", th:"เก่งแล้ว",   emoji:"🏆", desc:"รู้คำศัพท์ ประโยค และไวยากรณ์พื้นฐานครบ พร้อมไปต่อระดับถัดไป" },
  { min:14, level:"A1+", th:"ต่อยอด",   emoji:"🥈", desc:"ใช้คำศัพท์และประโยคง่ายๆ ได้ดี ฝึกไวยากรณ์กับการฟังอีกนิด" },
  { min:8,  level:"A1", th:"เริ่มต้น",   emoji:"🥉", desc:"รู้คำศัพท์พื้นฐานหลายหมวดแล้ว ฝึกประโยคและการฟังต่อ" },
  { min:0,  level:"Starter", th:"ก้าวแรก", emoji:"🌱", desc:"เริ่มจากเส้นทางบทเรียนบทที่ 1 และการ์ดคำศัพท์ทีละหมวด" },
];

// ═══════════════════════════════════════════════════════
// บทสนทนาเพิ่มเติม (ชุดที่ 3 · v2.8)
// ═══════════════════════════════════════════════════════
DIALOGUES.push(
  { id:"bus", emoji:"🚌", title:"Taking the bus", titleTh:"ขึ้นรถเมล์", scene:"places|BUS STOP", a:"Mina", b:"Driver",
    lines:[
      { who:"A", en:"Excuse me, does this bus go to the zoo?", th:"ขอโทษค่ะ รถคันนี้ไปสวนสัตว์ไหมคะ", blank:"zoo" },
      { who:"B", en:"Yes, it does. Get on, please.", th:"ไปครับ ขึ้นมาเลย" },
      { who:"A", en:"How much is the ticket?", th:"ตั๋วราคาเท่าไหร่คะ", blank:"ticket" },
      { who:"B", en:"Ten baht. Please sit down.", th:"สิบบาทครับ นั่งลงด้วยนะ", blank:"Ten" },
      { who:"A", en:"How many stops to the zoo?", th:"อีกกี่ป้ายถึงสวนสัตว์คะ", blank:"stops" },
      { who:"B", en:"Five stops. I will tell you.", th:"ห้าป้าย เดี๋ยวบอกนะครับ", blank:"Five" },
      { who:"A", en:"Thank you. You are very kind.", th:"ขอบคุณค่ะ คุณใจดีมาก", blank:"kind" },
    ] },
  { id:"park", emoji:"🌳", title:"In the park", titleTh:"ที่สวนสาธารณะ", scene:"places|PARK", a:"Tom", b:"Mina",
    lines:[
      { who:"A", en:"What a sunny day! Let's go to the park.", th:"วันนี้แดดดีจัง ไปสวนกันเถอะ", blank:"sunny" },
      { who:"B", en:"Good idea! I will bring my kite.", th:"ดีเลย ฉันจะเอาว่าวไปด้วย", blank:"kite" },
      { who:"A", en:"Look at the ducks in the pond!", th:"ดูเป็ดในสระสิ", blank:"ducks" },
      { who:"B", en:"They are so cute. Can we feed them?", th:"น่ารักจัง ให้อาหารพวกมันได้ไหม", blank:"feed" },
      { who:"A", en:"Yes, I have some bread.", th:"ได้ ฉันมีขนมปังอยู่", blank:"bread" },
      { who:"B", en:"After that, let's fly the kite on the hill.", th:"หลังจากนั้น ไปเล่นว่าวบนเนินกัน", blank:"hill" },
      { who:"A", en:"And then ice cream!", th:"แล้วก็กินไอศกรีม!" },
    ] },
  { id:"lostdog", emoji:"🐕", title:"A lost dog", titleTh:"หมาหลงทาง", scene:"places|STREET", a:"Mina", b:"Police",
    lines:[
      { who:"A", en:"Excuse me, I found a dog. He is lost.", th:"ขอโทษค่ะ หนูเจอหมาตัวหนึ่ง มันหลงทาง", blank:"lost" },
      { who:"B", en:"Let me see. Does he have a collar?", th:"ขอดูหน่อย มีปลอกคอไหม" },
      { who:"A", en:"Yes. His name is Lucky. There is a phone number.", th:"มีค่ะ ชื่อลัคกี้ มีเบอร์โทรด้วย", blank:"number" },
      { who:"B", en:"Great! I will call the owner.", th:"เยี่ยม เดี๋ยวโทรหาเจ้าของนะ", blank:"call" },
      { who:"A", en:"Is he hungry? Can I give him some water?", th:"มันหิวไหมคะ ให้น้ำมันได้ไหม", blank:"water" },
      { who:"B", en:"Yes, please. You are a good girl.", th:"ได้เลย หนูเป็นเด็กดีนะ", blank:"good" },
      { who:"A", en:"Thank you. I hope he goes home soon.", th:"ขอบคุณค่ะ หวังว่ามันจะได้กลับบ้านเร็วๆ", blank:"home" },
    ] },
  { id:"library", emoji:"📚", title:"At the library", titleTh:"ที่ห้องสมุด", scene:"places|LIBRARY", a:"Librarian", b:"Tom",
    lines:[
      { who:"A", en:"Good afternoon. Can I help you?", th:"สวัสดีตอนบ่าย มีอะไรให้ช่วยไหมคะ", blank:"help" },
      { who:"B", en:"Yes. I want a book about dinosaurs.", th:"ครับ ผมอยากได้หนังสือเกี่ยวกับไดโนเสาร์", blank:"book" },
      { who:"A", en:"Dinosaur books are on the second shelf.", th:"หนังสือไดโนเสาร์อยู่ชั้นที่สองค่ะ", blank:"second" },
      { who:"B", en:"Can I borrow two books?", th:"ขอยืมสองเล่มได้ไหมครับ", blank:"borrow" },
      { who:"A", en:"Yes. Please show me your library card.", th:"ได้ค่ะ ขอดูบัตรห้องสมุดหน่อย", blank:"card" },
      { who:"B", en:"Here it is. When do I bring them back?", th:"นี่ครับ ต้องคืนเมื่อไหร่", blank:"back" },
      { who:"A", en:"In two weeks. Please be quiet inside.", th:"สองสัปดาห์ค่ะ อยู่ข้างในเงียบๆ นะ", blank:"quiet" },
    ] },
  { id:"cooking", emoji:"🍳", title:"Cooking with Dad", titleTh:"ทำอาหารกับพ่อ", scene:"home|KITCHEN", a:"Dad", b:"Mina",
    lines:[
      { who:"A", en:"Mina, do you want to help me cook?", th:"มีนา อยากช่วยพ่อทำอาหารไหม", blank:"cook" },
      { who:"B", en:"Yes! What are we making?", th:"อยากค่ะ เราจะทำอะไรกัน" },
      { who:"A", en:"Fried rice. First, wash your hands.", th:"ข้าวผัด ล้างมือก่อนนะ", blank:"hands" },
      { who:"B", en:"Done. What's next?", th:"เสร็จแล้วค่ะ ต่อไปทำอะไร" },
      { who:"A", en:"Cut the carrot and the onion. Be careful!", th:"หั่นแครอทกับหัวหอม ระวังด้วยนะ", blank:"carrot" },
      { who:"B", en:"Now I put the egg in the pan.", th:"ตอนนี้หนูใส่ไข่ลงกระทะ", blank:"egg" },
      { who:"A", en:"Add the rice and mix it. Smells good!", th:"ใส่ข้าวแล้วผัดให้เข้ากัน หอมจัง", blank:"mix" },
      { who:"B", en:"I love cooking with you, Dad!", th:"หนูชอบทำอาหารกับพ่อจัง", blank:"love" },
    ] },
);

// ═══════════════════════════════════════════════════════
// นิทานเพิ่มเติม (ชุดที่ 3 · v2.8)
// ═══════════════════════════════════════════════════════
STORIES.push(
  { id:"turtle", emoji:"🐢", title:"The Turtle and the Rabbit", titleTh:"เต่ากับกระต่าย", level:"A1",
    pages:[
      { en:"A rabbit is very fast. A turtle is very slow.", th:"กระต่ายวิ่งเร็วมาก เต่าเดินช้ามาก", pic:"animals|RABBIT" },
      { en:"\"Let's have a race!\" says the rabbit.", th:"\"มาแข่งวิ่งกันเถอะ!\" กระต่ายพูด", pic:"sports|RACE" },
      { en:"The rabbit runs fast. The turtle walks slowly.", th:"กระต่ายวิ่งเร็ว เต่าเดินช้าๆ", pic:"animals|TURTLE" },
      { en:"The rabbit stops under a tree. \"I will sleep a little.\"", th:"กระต่ายหยุดใต้ต้นไม้ \"ขอนอนสักหน่อย\"", pic:"nature|TREE" },
      { en:"The turtle does not stop. Walk, walk, walk.", th:"เต่าไม่หยุด เดิน เดิน เดิน", pic:"actions|WALK" },
      { en:"The rabbit wakes up. \"Oh no! Where is the turtle?\"", th:"กระต่ายตื่น \"แย่แล้ว เต่าอยู่ไหน\"", pic:"actions|WAKE UP" },
      { en:"The turtle is at the finish line. The turtle wins!", th:"เต่าอยู่ที่เส้นชัยแล้ว เต่าชนะ!", pic:"sports|TROPHY" },
      { en:"Slow and steady wins the race.", th:"ช้าแต่มั่นคง ก็ชนะได้", pic:"feelings|PROUD" },
    ],
    quiz:[
      { q:"Who is fast?", qTh:"ใครวิ่งเร็ว", options:["The turtle","The rabbit","The bird"], answer:"The rabbit" },
      { q:"What does the rabbit do under the tree?", qTh:"กระต่ายทำอะไรใต้ต้นไม้", options:["Sleep","Eat","Sing"], answer:"Sleep" },
      { q:"Who wins the race?", qTh:"ใครชนะ", options:["The rabbit","The turtle","Nobody"], answer:"The turtle" },
    ] },
  { id:"seed", emoji:"🌻", title:"The Little Seed", titleTh:"เมล็ดน้อย", level:"A1",
    pages:[
      { en:"Mina has a little seed. She puts it in the soil.", th:"มีนามีเมล็ดเล็กๆ เธอใส่มันลงในดิน", pic:"nature|SEED" },
      { en:"Every morning she gives it water.", th:"ทุกเช้าเธอรดน้ำให้มัน", pic:"actions|WATER" },
      { en:"The sun is warm. The rain is soft.", th:"แดดอุ่น ฝนโปรยเบาๆ", pic:"weather|SUN" },
      { en:"One day, a small green leaf comes out!", th:"วันหนึ่ง ใบเล็กๆ สีเขียวโผล่ออกมา", pic:"nature|LEAF" },
      { en:"The plant grows tall. Taller than Mina!", th:"ต้นไม้โตสูง สูงกว่ามีนาอีก", pic:"opposites|TALL" },
      { en:"Then a big yellow flower opens.", th:"แล้วดอกไม้สีเหลืองดอกใหญ่ก็บาน", pic:"nature|SUNFLOWER" },
      { en:"A bee comes to visit the flower.", th:"ผึ้งบินมาเยี่ยมดอกไม้", pic:"animals|BEE" },
      { en:"Mina smiles. \"My little seed is a big sunflower now!\"", th:"มีนายิ้ม \"เมล็ดน้อยของฉันเป็นทานตะวันต้นใหญ่แล้ว\"", pic:"feelings|HAPPY" },
    ],
    quiz:[
      { q:"Where does Mina put the seed?", qTh:"มีนาใส่เมล็ดไว้ที่ไหน", options:["In the soil","In the water","In a box"], answer:"In the soil" },
      { q:"What color is the flower?", qTh:"ดอกไม้สีอะไร", options:["Red","Yellow","Blue"], answer:"Yellow" },
      { q:"Who visits the flower?", qTh:"ใครมาเยี่ยมดอกไม้", options:["A bee","A cat","A frog"], answer:"A bee" },
    ] },
  { id:"moon", emoji:"🌙", title:"Good Night, Moon", titleTh:"ราตรีสวัสดิ์ พระจันทร์", level:"A1",
    pages:[
      { en:"It is night. The sky is dark.", th:"ตอนนี้กลางคืนแล้ว ท้องฟ้ามืด", pic:"time|NIGHT" },
      { en:"Tom looks out of the window. He sees the moon.", th:"ทอมมองออกไปนอกหน้าต่าง เขาเห็นพระจันทร์", pic:"nature|MOON" },
      { en:"\"Hello, Moon! Are you lonely up there?\"", th:"\"สวัสดีพระจันทร์ อยู่บนนั้นเหงาไหม\"", pic:"feelings|LONELY" },
      { en:"Many stars come out. One, two, three... so many!", th:"ดาวออกมามากมาย หนึ่ง สอง สาม… เยอะจัง", pic:"nature|STAR" },
      { en:"\"The moon is not lonely. The stars are its friends.\"", th:"\"พระจันทร์ไม่เหงาหรอก ดาวเป็นเพื่อนของมัน\"", pic:"family|FRIEND" },
      { en:"An owl says, \"Hoo, hoo!\" in the tree.", th:"นกฮูกร้อง \"ฮู ฮู\" อยู่บนต้นไม้", pic:"animals|OWL" },
      { en:"Tom gets into his bed. He is sleepy.", th:"ทอมขึ้นเตียง เขาง่วงแล้ว", pic:"home|BED" },
      { en:"\"Good night, Moon. Good night, stars.\"", th:"\"ราตรีสวัสดิ์พระจันทร์ ราตรีสวัสดิ์ดวงดาว\"", pic:"actions|SLEEP" },
    ],
    quiz:[
      { q:"What does Tom see in the sky?", qTh:"ทอมเห็นอะไรบนฟ้า", options:["The sun","The moon","A plane"], answer:"The moon" },
      { q:"Who are the moon's friends?", qTh:"ใครเป็นเพื่อนของพระจันทร์", options:["The stars","The clouds","The fish"], answer:"The stars" },
      { q:"What animal says \"Hoo, hoo\"?", qTh:"สัตว์อะไรร้อง \"ฮู ฮู\"", options:["A dog","A cow","An owl"], answer:"An owl" },
    ] },
  { id:"birthday", emoji:"🎂", title:"Grandma's Birthday", titleTh:"วันเกิดคุณยาย", level:"A1+",
    pages:[
      { en:"Today is Grandma's birthday. She is seventy years old.", th:"วันนี้วันเกิดคุณยาย คุณยายอายุเจ็ดสิบปี", pic:"family|GRANDMOTHER" },
      { en:"Mina and Tom want to make a cake.", th:"มีนากับทอมอยากทำเค้ก", pic:"food|CAKE" },
      { en:"They need flour, sugar, eggs and butter.", th:"ต้องใช้แป้ง น้ำตาล ไข่ และเนย", pic:"food|FLOUR" },
      { en:"Mom helps them bake it in the oven.", th:"แม่ช่วยอบในเตาอบ", pic:"home|OVEN" },
      { en:"Tom draws a card. Mina picks flowers from the garden.", th:"ทอมวาดการ์ด มีนาเก็บดอกไม้จากสวน", pic:"nature|FLOWER" },
      { en:"Surprise! Everybody sings \"Happy Birthday!\"", th:"เซอร์ไพรส์! ทุกคนร้องเพลง \"แฮปปี้เบิร์ธเดย์\"", pic:"actions|SING" },
      { en:"Grandma blows out the candles and makes a wish.", th:"คุณยายเป่าเทียนแล้วอธิษฐาน", pic:"home|CANDLE" },
      { en:"\"Thank you, my dears. This is the best birthday!\"", th:"\"ขอบใจนะหลานๆ นี่คือวันเกิดที่ดีที่สุด\"", pic:"feelings|THANKFUL" },
    ],
    quiz:[
      { q:"How old is Grandma?", qTh:"คุณยายอายุเท่าไหร่", options:["Seventeen","Seventy","Seven"], answer:"Seventy" },
      { q:"What do the children make?", qTh:"เด็กๆ ทำอะไร", options:["A cake","Soup","Pizza"], answer:"A cake" },
      { q:"What does Mina pick from the garden?", qTh:"มีนาเก็บอะไรจากสวน", options:["Apples","Flowers","Eggs"], answer:"Flowers" },
    ] },
  { id:"rainbowfish", emoji:"🐠", title:"The Rainbow Fish", titleTh:"ปลาสีรุ้ง", level:"A1+",
    pages:[
      { en:"In the blue sea lives a fish with rainbow colors.", th:"ในทะเลสีฟ้ามีปลาตัวหนึ่งสีรุ้งสวยงาม", pic:"animals|FISH" },
      { en:"The other fish say, \"Please give us one shiny scale.\"", th:"ปลาตัวอื่นพูดว่า \"ขอเกล็ดแวววาวหนึ่งอันได้ไหม\"", pic:"animals|CLOWNFISH" },
      { en:"\"No!\" says the rainbow fish. \"They are mine.\"", th:"\"ไม่ให้!\" ปลาสีรุ้งพูด \"มันเป็นของฉัน\"", pic:"feelings|GRUMPY" },
      { en:"Now nobody plays with the rainbow fish. He is lonely.", th:"ตอนนี้ไม่มีใครเล่นกับปลาสีรุ้ง เขาเหงา", pic:"feelings|LONELY" },
      { en:"A wise old octopus says, \"Share, and you will be happy.\"", th:"ปลาหมึกเฒ่าผู้ฉลาดบอกว่า \"แบ่งปันแล้วเธอจะมีความสุข\"", pic:"animals|OCTOPUS" },
      { en:"The rainbow fish gives one scale to a small fish.", th:"ปลาสีรุ้งให้เกล็ดหนึ่งอันกับปลาตัวเล็ก", pic:"actions|GIVE" },
      { en:"He gives more and more. Now every fish shines!", th:"เขาให้อีกเรื่อยๆ ตอนนี้ปลาทุกตัวแวววาว", pic:"actions|SHARE" },
      { en:"The rainbow fish has many friends. He is very happy.", th:"ปลาสีรุ้งมีเพื่อนมากมาย เขามีความสุขมาก", pic:"feelings|HAPPY" },
    ],
    quiz:[
      { q:"Where does the rainbow fish live?", qTh:"ปลาสีรุ้งอาศัยอยู่ที่ไหน", options:["In the sea","In a river","In a pond"], answer:"In the sea" },
      { q:"Who gives advice?", qTh:"ใครให้คำแนะนำ", options:["A shark","An octopus","A crab"], answer:"An octopus" },
      { q:"What does the rainbow fish learn?", qTh:"ปลาสีรุ้งเรียนรู้อะไร", options:["To share","To hide","To swim fast"], answer:"To share" },
    ] },
);

// ═══════════════════════════════════════════════════════
// บทสนทนาสถานการณ์ไทย (ชุดที่ 4 · v3.2) — เด็กไทยอธิบายเมืองไทยเป็นอังกฤษ
// ═══════════════════════════════════════════════════════
DIALOGUES.push(
  { id:"temple", emoji:"🛕", title:"At the temple", titleTh:"พาเพื่อนต่างชาติไปวัด", scene:"places|TEMPLE", a:"Mina", b:"Emma",
    lines:[
      { who:"A", en:"Welcome to the temple, Emma!", th:"ยินดีต้อนรับสู่วัดนะเอ็มมา", blank:"temple" },
      { who:"B", en:"Wow, it is so beautiful! Can I go inside?", th:"ว้าว สวยมาก ฉันเข้าไปข้างในได้ไหม" },
      { who:"A", en:"Yes, but please take off your shoes first.", th:"ได้ แต่ถอดรองเท้าก่อนนะ", blank:"shoes" },
      { who:"B", en:"OK. What is that golden building?", th:"โอเค ตึกสีทองนั่นคืออะไร", blank:"golden" },
      { who:"A", en:"That is a pagoda. People pray there.", th:"นั่นคือเจดีย์ คนมาสวดมนต์ที่นั่น", blank:"pray" },
      { who:"B", en:"Who are the men in orange?", th:"ผู้ชายในชุดสีส้มคือใคร", blank:"orange" },
      { who:"A", en:"They are monks. We must be quiet near them.", th:"พวกเขาคือพระ เราต้องเงียบๆ เมื่ออยู่ใกล้", blank:"quiet" },
      { who:"B", en:"Thank you for teaching me, Mina.", th:"ขอบคุณที่สอนฉันนะมีนา" },
    ] },
  { id:"floating", emoji:"🛶", title:"At the floating market", titleTh:"ตลาดน้ำ", scene:"places|FLOATING MARKET", a:"Seller", b:"Tom",
    lines:[
      { who:"A", en:"Hello! Fresh mangoes from my boat!", th:"สวัสดีค่ะ มะม่วงสดจากเรือป้า", blank:"boat" },
      { who:"B", en:"How much for one kilo?", th:"กิโลละเท่าไหร่ครับ", blank:"kilo" },
      { who:"A", en:"Sixty baht. Very sweet!", th:"หกสิบบาท หวานมาก", blank:"Sixty" },
      { who:"B", en:"Can I try one first?", th:"ขอชิมก่อนได้ไหมครับ", blank:"try" },
      { who:"A", en:"Of course. Here you are.", th:"ได้สิ นี่จ้ะ" },
      { who:"B", en:"Mmm, delicious! I will take two kilos.", th:"อืม อร่อย ขอสองกิโลครับ", blank:"delicious" },
      { who:"A", en:"Thank you! Be careful, the boat is moving.", th:"ขอบใจจ้ะ ระวังนะ เรือกำลังขยับ", blank:"careful" },
    ] },
  { id:"songkran", emoji:"💦", title:"Songkran Day", titleTh:"วันสงกรานต์", scene:"time|APRIL", a:"Tom", b:"Emma",
    lines:[
      { who:"A", en:"Happy Songkran, Emma! It is Thai New Year.", th:"สุขสันต์วันสงกรานต์เอ็มมา วันนี้ปีใหม่ไทย", blank:"New" },
      { who:"B", en:"Why is everyone playing with water?", th:"ทำไมทุกคนเล่นน้ำกัน", blank:"water" },
      { who:"A", en:"Water means good luck. It washes away bad things.", th:"น้ำหมายถึงโชคดี ล้างสิ่งไม่ดีออกไป", blank:"luck" },
      { who:"B", en:"Can I splash you?", th:"ฉันสาดเธอได้ไหม", blank:"splash" },
      { who:"A", en:"Yes! But not on the old people. We pour water on their hands gently.", th:"ได้ แต่ไม่สาดผู้ใหญ่นะ เรารดน้ำที่มือท่านเบาๆ", blank:"hands" },
      { who:"B", en:"I see. It is hot today, so this is fun!", th:"เข้าใจแล้ว วันนี้ร้อนด้วย สนุกจัง", blank:"hot" },
      { who:"A", en:"Let's go to the street. Bring your water gun!", th:"ไปที่ถนนกัน เอาปืนฉีดน้ำมาด้วย", blank:"gun" },
    ] },
  { id:"tuktuk", emoji:"🛺", title:"Taking a tuk-tuk", titleTh:"นั่งตุ๊กตุ๊ก", scene:"vehicles|TUK-TUK", a:"Driver", b:"Emma",
    lines:[
      { who:"A", en:"Hello! Where do you want to go?", th:"สวัสดีครับ จะไปไหนครับ", blank:"go" },
      { who:"B", en:"To the night market, please. How much?", th:"ไปตลาดกลางคืนค่ะ เท่าไหร่คะ", blank:"night" },
      { who:"A", en:"One hundred baht.", th:"ร้อยบาทครับ", blank:"hundred" },
      { who:"B", en:"That is too much. Eighty baht?", th:"แพงไป แปดสิบได้ไหม", blank:"Eighty" },
      { who:"A", en:"OK, eighty. Hold on tight!", th:"ได้ แปดสิบ จับให้แน่นนะ", blank:"tight" },
      { who:"B", en:"It is so fast and loud! I love it!", th:"เร็วและเสียงดังมาก ชอบจัง", blank:"loud" },
      { who:"A", en:"We are here. Enjoy the market!", th:"ถึงแล้วครับ ขอให้สนุกกับตลาด" },
    ] },
);

STORIES.push(
  { id:"loykrathong", emoji:"🪷", title:"The Little Krathong", titleTh:"กระทงน้อย", level:"A1+",
    pages:[
      { en:"Tonight is Loy Krathong. The moon is full and bright.", th:"คืนนี้วันลอยกระทง พระจันทร์เต็มดวงสว่างไสว", pic:"time|NOVEMBER" },
      { en:"Mina makes a krathong from a banana leaf and flowers.", th:"มีนาทำกระทงจากใบตองและดอกไม้", pic:"nature|LOTUS" },
      { en:"She puts a candle and three incense sticks on it.", th:"เธอปักเทียนและธูปสามดอก", pic:"home|CANDLE" },
      { en:"The family walks to the river together.", th:"ครอบครัวเดินไปที่แม่น้ำด้วยกัน", pic:"nature|RIVER" },
      { en:"\"Make a wish,\" says Grandma. Mina closes her eyes.", th:"\"อธิษฐานสิ\" คุณยายบอก มีนาหลับตา", pic:"family|GRANDMOTHER" },
      { en:"She puts the krathong on the water. It floats away slowly.", th:"เธอวางกระทงลงน้ำ มันค่อยๆ ลอยไป", pic:"actions|GIVE" },
      { en:"Hundreds of little lights shine on the river.", th:"แสงไฟเล็กๆ นับร้อยส่องแสงบนแม่น้ำ", pic:"nature|STAR" },
      { en:"\"Thank you, river,\" Mina whispers. \"Good night.\"", th:"\"ขอบคุณนะแม่น้ำ\" มีนากระซิบ \"ราตรีสวัสดิ์\"", pic:"feelings|THANKFUL" },
    ],
    quiz:[
      { q:"What does Mina make?", qTh:"มีนาทำอะไร", options:["A kite","A krathong","A cake"], answer:"A krathong" },
      { q:"Where do they go?", qTh:"พวกเขาไปที่ไหน", options:["To the river","To the zoo","To school"], answer:"To the river" },
      { q:"How many incense sticks?", qTh:"ธูปกี่ดอก", options:["One","Two","Three"], answer:"Three" },
    ] },
  { id:"elephant", emoji:"🐘", title:"The Elephant Who Loved Bananas", titleTh:"ช้างน้อยรักกล้วย", level:"A1",
    pages:[
      { en:"Boon is a baby elephant. He lives in the forest.", th:"บุญเป็นลูกช้าง อาศัยอยู่ในป่า", pic:"animals|ELEPHANT" },
      { en:"Boon loves bananas more than anything.", th:"บุญรักกล้วยมากกว่าอะไรทั้งหมด", pic:"fruits|BANANA" },
      { en:"One day, he sees a banana tree across the river.", th:"วันหนึ่งเขาเห็นต้นกล้วยอยู่อีกฝั่งแม่น้ำ", pic:"nature|RIVER" },
      { en:"\"The water is deep. I am scared,\" says Boon.", th:"\"น้ำลึก ฉันกลัว\" บุญพูด", pic:"feelings|SCARED" },
      { en:"A turtle says, \"Elephants can swim! Use your trunk like a snorkel.\"", th:"เต่าบอกว่า \"ช้างว่ายน้ำได้นะ ใช้งวงเหมือนท่อหายใจสิ\"", pic:"animals|TURTLE" },
      { en:"Boon tries. Splash! He swims across the river.", th:"บุญลอง ตูม! เขาว่ายข้ามแม่น้ำได้", pic:"actions|SWIM" },
      { en:"He eats ten bananas. His tummy is very full.", th:"เขากินกล้วยสิบลูก ท้องอิ่มมาก", pic:"numbers|TEN" },
      { en:"\"Being brave is sweet,\" Boon says with a big smile.", th:"\"ความกล้าหาญนั้นหวานจริงๆ\" บุญพูดพร้อมยิ้มกว้าง", pic:"feelings|BRAVE" },
    ],
    quiz:[
      { q:"What does Boon love?", qTh:"บุญรักอะไร", options:["Apples","Bananas","Fish"], answer:"Bananas" },
      { q:"Who helps Boon?", qTh:"ใครช่วยบุญ", options:["A turtle","A monkey","A bird"], answer:"A turtle" },
      { q:"How many bananas does he eat?", qTh:"เขากินกล้วยกี่ลูก", options:["Five","Ten","Two"], answer:"Ten" },
    ] },
);

// ── ปกนิทาน (รูปที่สื่อถึงเรื่อง ไม่ใช่หน้าแรกเสมอไป) key = "หมวด|คำ" ──
const STORY_COVERS = { cat:"animals|CAT", rain:"weather|RAINBOW", zoo:"animals|GIRAFFE", lost:"toys|TEDDY BEAR", beach:"places|BEACH", school:"school|CLASSROOM",
  ant:"animals|ANT", market:"fruits|MANGO", sick:"jobs|DOCTOR", kite:"toys|KITE", turtle:"animals|TURTLE", seed:"nature|SUNFLOWER", moon:"nature|MOON",
  birthday:"food|CAKE", rainbowfish:"animals|CLOWNFISH", loykrathong:"nature|LOTUS", elephant:"animals|ELEPHANT" };
STORIES.forEach(s => { if (STORY_COVERS[s.id]) s.cover = STORY_COVERS[s.id]; });
