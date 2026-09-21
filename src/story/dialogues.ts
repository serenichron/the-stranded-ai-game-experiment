// Every conversation in the level. Voice rules from the parent CLAUDE.md apply:
// plain words, short sentences, British spelling, no em dashes, one concrete thing per sentence.
// Invented names and facts are listed in LORE-INVENTIONS.md.
// Voices (want, tic, dodge) are written up in comms/p2-text-voices.md.

import type { Ctx, Dialogue } from './types';

const isk = (c: Ctx) => c.race === 'iskari';
const seh = (c: Ctx) => c.race === 'sehari';
const min = (c: Ctx) => c.race === 'minaa';

/** A moderate or severe wound: bad enough for people to notice. */
const badlyHurt = (c: Ctx) => c.s.wounds.moderate || c.s.wounds.severe;
const anyHurt = (c: Ctx) => c.s.wounds.light || c.s.wounds.moderate || c.s.wounds.severe;
/** Past the ded-waka, one way or another. */
const pastTel = (c: Ctx) => c.flag('telAsleep') || c.flag('telDead') || c.flag('crackClimbed');

// ------------------------------------------------------------------ the apprentice
// Want: his master, or at least her last words. Tic: corrects himself ("Or I try to.").
// Dodge: turns a hard question back into the work.

export const apprentice: Dialogue = {
  start: {
    text: (c) =>
      c.flag('metApprentice')
        ? 'The apprentice looks up from his tablet of wax. His stone fingers stop mid-line.'
        : 'An Iskari sits on a crate by a patched tent. His skin is grey stone, worn smooth at the knuckles. He does not move until you are close.',
    next: (c) => (c.flag('metApprentice') ? 'hub' : 'hello'),
  },
  hello: {
    speaker: 'apprentice',
    text: (c) =>
      isk(c)
        ? 'Serving line. Like me. I can see it in your hands. Sit, if you like. The crate is the only chair I have.'
        : seh(c)
          ? 'A Sehari, in a salvage camp. The crew will stare. Let them. Sit, if you like. The crate is the only chair I have.'
          : "You came. Good. Mi'naa hands, too. You will know old salvage when you see it. Sit, if you like. The crate is the only chair I have.",
    do: (c) => c.set('metApprentice'),
    next: 'hub',
  },
  hub: {
    speaker: 'apprentice',
    text: (c) => {
      if (badlyHurt(c)) return 'You are hurt. Mother Tarn has aloe. Please do not die on my errand. I would have to write it down.';
      if (!c.flag('gotJob')) return 'Ask, then. I have marked my place in the wax.';
      if (pastTel(c)) return 'You got past the ded-waka? Then the ruin is open to you. Why are you here, and not north?';
      if (anyHurt(c)) return 'You are scraped. It is only a scrape. Or it is the start of something worse. Mind it.';
      return 'The ruin is north, past the ridge. You are here, on my side of the sand. Is something wrong?';
    },
    again: [
      'Yes? I am still here. So is the wax.',
      'Ask. I will write it down after.',
      'The ruin has not moved, you know.',
      'Something else?',
    ],
    choices: [
      { text: 'Who are you, when you are not waiting on a crate?', next: 'who', once: true },
      { text: 'You asked for me by name. What is the job?', next: 'job', if: (c) => !c.flag('gotJob') },
      { text: 'The crew keep saying ded-waka. What is it?', next: 'dedwaka', if: (c) => c.flag('gotJob'), once: true },
      { text: 'Is there another way past the ridge?', next: 'crack', if: (c) => c.flag('gotJob'), once: true },
      { text: 'What will I find in that ruin?', next: 'ruin', if: (c) => c.flag('gotJob'), once: true },
      {
        text: 'Look at him closely.',
        once: true,
        check: {
          stat: 'presence',
          specs: ['insight'],
          label: 'Read the apprentice',
          win: 'Learn what he is not saying',
          risk: 'He catches you staring',
          full: 'readFull',
          partial: 'readPartial',
          miss: 'readMiss',
        },
        if: (c) => c.flag('gotJob'),
      },
      { text: 'I found your plate.', next: 'plateBack', if: (c) => c.has('archive') },
      { text: (c) => (c.flag('gotJob') ? 'I will be back with your plate.' : 'Let me think about it.'), next: 'bye' },
    ],
  },
  who: {
    speaker: 'apprentice',
    text: 'I keep records. Or I try to. Long ago I was apprenticed to a Keeper.',
    next: 'who2',
  },
  who2: {
    speaker: 'apprentice',
    text: 'The Keepers were Iskari who wrote things down. A ripple can wipe a mind. It cannot wipe a wax tablet. Hardly anyone says the name now.',
    next: 'who3',
  },
  who3: {
    speaker: 'apprentice',
    text: 'My master went north to look at something. Then the last ripple came. I shut down, as we do. When I woke, she was gone.',
    choices: [
      { text: 'When was that?', next: 'who4' },
      { text: 'I am sorry.', next: 'who5' },
      { text: 'Gone where? Did you look for her?', next: 'who6', once: true },
    ],
  },
  who4: {
    speaker: 'apprentice',
    text: "About two hundred years ago, by the Mi'naa count. I never finished my training. I have done the work alone since.",
    next: 'hub',
  },
  who5: {
    speaker: 'apprentice',
    text: 'Thank you. It was two hundred years ago. Or it was yesterday. For stone, it is hard to tell.',
    next: 'hub',
  },
  who6: {
    speaker: 'apprentice',
    text: 'I looked in her tent. I looked in her notes. Then I sat down on this crate to wait. I am still waiting. That is the whole story.',
    next: 'hub',
  },
  job: {
    speaker: 'apprentice',
    text: "North, past the ridge, there is an Aza'los ruin. Half of it is under the sand. My master hid archive plates in places like that.",
    next: 'job2',
  },
  job2: {
    speaker: 'apprentice',
    text: 'I think one plate is still inside. Here. This is her mark, three rings with one broken. Look for it.',
    do: (c) => {
      c.give('rubbing');
      c.toast("Received: the apprentice's rubbing", 'quest');
    },
    next: 'job3',
  },
  job3: {
    speaker: 'apprentice',
    text: (c) =>
      isk(c)
        ? 'I tried the door once. It did not know me. I am a poor reader of the old marks. You may read them better. Some of us do.'
        : 'I tried the door once. It did not know me. I read the old marks badly. My master read them the way you read a face.',
    next: 'job4',
  },
  job4: {
    speaker: 'apprentice',
    text: "And now there is the ded-waka. Hadda's crew cut into the old wreck two days ago. Something inside woke up.",
    choices: [
      { text: 'I will find your plate.', next: 'accept' },
      { text: 'What do I get out of it?', next: 'pay' },
      { text: 'And if the plate says something you do not want to hear?', next: 'warn', once: true },
    ],
  },
  warn: {
    speaker: 'apprentice',
    text: 'Then I will write it down anyway. That is the work. Or it was her work, and now it is mine.',
    next: 'job4',
  },
  pay: {
    speaker: 'apprentice',
    text: 'Water. A leaf of dust-aloe. And whatever the plate says, you hear it first. I have nothing else to give.',
    next: 'accept',
  },
  accept: {
    speaker: 'apprentice',
    text: (c) =>
      isk(c)
        ? 'Good. Keep your focus close. The ded-waka know us, somehow. I have never learned why.'
        : seh(c)
          ? 'Good. You feel the ground here, I think. There is old crystal under that ruin. More than anyone has dug.'
          : 'Good. Your people keep memories in things, in tags and implants. That plate is my master\'s memory. Carry it like one of yours.',
    do: (c) => {
      c.set('gotJob');
      c.give('water');
      c.give('aloe');
      c.toast('Received: water, dust-aloe leaf', 'good');
      c.quest('errand', "The Keeper's errand", 'An Iskari with a wax tablet wants a plate from the ruin north of the ridge. His master\'s mark is on it: three rings, one broken.');
      c.quest('dedwaka', 'The ded-waka', "The crew call it ded-waka. It woke in the wreck to the east, and it sits right by the gap in the ridge.");
      c.objective('Get past the ridge to the ruin in the north.');
    },
    next: 'hub',
  },
  dedwaka: {
    speaker: 'apprentice',
    text: "The crew call it ded-waka. Dead-walker. Its true name is Tel'sharin. A starving one feeds on metal, and on the dead.",
    next: 'dedwaka2',
  },
  dedwaka2: {
    speaker: 'apprentice',
    text: 'My master wrote this down once. Take its food away and it sleeps again, sometimes for centuries. There are four heaps of plating around it.',
    do: (c) =>
      c.quest('dedwaka', 'The ded-waka', "Ded-waka is the crew's word for a Tel'sharin. Take its four heaps of plating away and it goes back to sleep."),
    next: 'hub',
  },
  crack: {
    speaker: 'apprentice',
    text: 'There is a crack in the west ridge. It is narrow and the rock is loose. Two of the crew fell there last season. One walked again.',
    do: (c) => c.quest('dedwaka', 'The ded-waka', 'There is a narrow crack in the west ridge. Two climbers fell there. One walked again.'),
    next: 'hub',
  },
  ruin: {
    speaker: 'apprentice',
    text: 'Pale stone, curved halls, teal light in the seams. The door is marked. Past the door, I do not know. Something moved in there when I tried.',
    next: 'hub',
  },
  readFull: {
    text: 'He is afraid, and the ded-waka has nothing to do with it. He keeps glancing at the empty north road. He lets you see it.',
    do: (c) => c.set('apprenticeAfraid'),
    next: 'hub',
  },
  readPartial: {
    text: 'He is tired in a way stone should not be. Twice he starts a sentence about the north road. Twice he stops.',
    next: 'hub',
  },
  readMiss: {
    speaker: 'apprentice',
    text: 'You are staring. Iskari faces do not move much. I could tell you what I am thinking. I would rather tell you about the ruin.',
    next: 'hub',
  },
  plateBack: {
    speaker: 'apprentice',
    text: 'You found it. Sit down. Tell me everything, slowly. I will write as you talk.',
    next: 'hub',
  },
  bye: {
    speaker: 'apprentice',
    text: (c) => (c.flag('gotJob') ? 'Come back soon. I would like to read it with you.' : 'I will be here. I am usually here.'),
    end: true,
  },
};

// ------------------------------------------------------------------ Hadda, crew boss
// Want: the scrap her crew paid for in blood. Tic: Brenn, and counting costs.
// Dodge: gives an order instead of an answer.

export const foreman: Dialogue = {
  start: {
    text: (c) =>
      c.flag('metHadda')
        ? 'Hadda wipes grease off her hands onto grease on her trousers.'
        : "A broad Mi'naa woman in a patched leather apron. Half her left hand is metal.",
    next: (c) => (c.flag('metHadda') ? 'hub' : 'hello'),
  },
  hello: {
    speaker: 'foreman',
    text: (c) =>
      isk(c)
        ? "Gud dey. Another stone one. The apprentice hired you, did he? Don't mind me. I call him stone man to his face."
        : seh(c)
          ? "Gud dey. A Sehari, in my camp. Keep your hands off the crystal crates and we'll get on fine."
          : "Gud dey. You're the one the stone man hired. Which crew are you from? Never mind. While you're here, you're mine.",
    do: (c) => c.set('metHadda'),
    next: 'hub',
  },
  hub: {
    speaker: 'foreman',
    again: ['Well? Say it.', 'Back again. Talk while I work.', 'Make it quick.', 'Go on, then.'],
    text: (c) => {
      const scrap = c.s.flags.scrapTo;
      if (c.s.wounds.severe) return "You're bleeding on my sand. Tarn has aloe and a needle. Talk fast, then go to her.";
      if (scrap === 'camp') return "The plating's back in the gully, and it's ours again. Brenn nearly smiled. Nearly.";
      if (scrap === 'contested' && c.flag('bandBeaten')) return 'Heard about the fight in the gully. You kept my plating. I pay my debts.';
      if (scrap === 'pell') return "Someone took the plating out of the gully. When I find out who, they carry it back on their teeth.";
      if (c.flag('pellReported')) return "Pell's gone. Good hands, too. Shame about the rest of them.";
      if (c.flag('toldHaddaDead') || c.flag('toldHaddaSleep')) return "East is quiet. I don't trust quiet. I'll take it, though.";
      if (badlyHurt(c)) return "You're limping. Don't limp near the crew. It makes them nervous.";
      return "Talk. I've got scrap to count and Brenn to shout at.";
    },
    choices: [
      { text: 'Your crew look spooked. What happened at the wreck?', next: 'wreck', once: true },
      { text: 'Who is the quiet one, sorting bolts?', next: 'pell', once: true },
      {
        text: 'Pell has band marks under those sleeves. You have a scavenger in camp.',
        if: (c) => c.flag('sawMarks') && !c.flag('pellReported') && !c.flag('pellGone'),
        next: 'report',
      },
      { text: 'Your ded-waka is asleep. I starved it.', if: (c) => c.flag('telAsleep') && !c.flag('toldHaddaSleep'), next: 'asleep' },
      { text: 'The ded-waka is dead. Brenn can stop looking over his shoulder.', if: (c) => c.flag('telDead') && !c.flag('toldHaddaDead'), next: 'dead' },
      { text: "I'll get out of your way.", next: 'bye' },
    ],
  },
  wreck: {
    speaker: 'foreman',
    text: 'We cut into the old wreck for metal. We got the metal. We also got that thing. It took Brenn by the arm and would not let go.',
    next: 'wreck2',
  },
  wreck2: {
    speaker: 'foreman',
    text: 'Brenn lives. The arm stayed there. Nobody goes east now. The good scrap is still lying around it, and it is ours. We paid for it.',
    do: (c) => c.set('haddaWantsScrap'),
    next: 'hub',
  },
  pell: {
    speaker: 'foreman',
    text: "Pell. Came in a month ago with good hands and no band. Doesn't talk much. Works hard. That's all I ask of anyone.",
    next: 'hub',
  },
  report: {
    speaker: 'foreman',
    text: 'Band-shen. In my camp. Eating my food.',
    next: 'report2',
  },
  report2: {
    speaker: 'foreman',
    text: "Then Pell goes tonight. I'll do it myself. Here, dried aloe and a charge-fruit. Nobody says Hadda doesn't pay.",
    do: (c) => {
      c.set('pellReported');
      c.give('aloe', 2);
      c.give('chargeFruit');
      c.toast('Received: 2 dust-aloe leaves, a charge-fruit', 'good');
      c.quest('pell', 'Covered is covered', "I told Hadda about Pell's band marks. She paid me in aloe and fruit. Pell goes tonight.");
    },
    next: 'hub',
  },
  asleep: {
    speaker: 'foreman',
    text: 'Asleep. Well. Asleep is quiet. We can work around quiet.',
    do: (c) => c.set('toldHaddaSleep'),
    next: 'hub',
  },
  dead: {
    speaker: 'foreman',
    text: "Dead. You're sure? Then we go back out tomorrow. Brenn will want to see it.",
    do: (c) => c.set('toldHaddaDead'),
    next: 'hub',
  },
  bye: {
    speaker: 'foreman',
    text: (c) => (c.flag('telDead') || c.flag('telAsleep') ? "Go on. I'll keep watching the east anyway. Habit." : 'Watch the east.'),
    end: true,
  },
};

// ------------------------------------------------------------------ Pell, the scavenger
// Want: metal, and to be left alone. Tic: prices everything ("Staring costs extra"), "Covered is covered".
// Dodge: answers with a price or a question.

export const scav: Dialogue = {
  start: {
    text: (c) =>
      c.flag('metPell')
        ? 'Pell keeps sorting bolts by size. Pell does not look up.'
        : "A thin Mi'naa in long sleeves sorts bolts on a cloth, smallest to largest. Pell does not look up.",
    next: (c) => (!c.flag('metPell') ? 'hello' : c.flag('metPellHub') ? 'hub' : 'offer'),
  },
  hello: {
    speaker: 'scav',
    text: (c) =>
      isk(c)
        ? "Stone. Good. Stone doesn't gossip. You're going past the wreck? Then you can earn something."
        : min(c)
          ? "Crew hands. You know what plating fetches, then. You're going past the wreck? You can earn something."
          : "You're walking east. The wreck is east. So you can earn something.",
    do: (c) => c.set('metPell'),
    next: 'offer',
  },
  offer: {
    speaker: 'scav',
    text: 'The ded-waka sits on four heaps of good plating. Drag them into the dry gully west of it. No food, no ded-waka. It sleeps.',
    next: 'offer2',
  },
  offer2: {
    speaker: 'scav',
    text: 'Leave the plating in the gully. I collect it later. You get a pale crystal for your trouble. Clean one.',
    do: (c) => {
      c.set('metPellHub');
      c.set('pellOffer');
      c.quest('dedwaka', 'The ded-waka', 'Pell will pay a pale crystal if I starve the ded-waka. The plating goes in the gully west of the wreck, for Pell to collect.');
    },
    next: 'hub',
  },
  hub: {
    speaker: 'scav',
    text: (c) => {
      if (c.flag('telDead')) return 'You killed it. So the plating just sits there. Nobody eats it, nobody sells it. Waste.';
      if (badlyHurt(c)) return "You're bleeding. Don't drip on the small bolts.";
      if (c.flag('pellThreatened')) return 'Still here? I thought you were off to tell Hadda.';
      return 'Still here? Watching is free. For now.';
    },
    again: ['Well?', 'Still watching. Still free.', 'You again.', 'Say it, then.'],
    choices: [
      { text: 'What does a bolt-sorter want with a heap of plating?', next: 'why', once: true },
      {
        text: "Watch Pell's hands while they work.",
        if: (c) => !c.flag('sawMarks'),
        once: true,
        check: {
          stat: 'presence',
          specs: ['insight'],
          label: 'Watch Pell',
          win: 'See what the sleeves hide',
          risk: 'Pell sees you looking',
          full: 'marksFull',
          partial: 'marksPartial',
          miss: 'marksMiss',
        },
      },
      { text: 'Hadda says that plating belongs to the camp.', if: (c) => c.flag('haddaWantsScrap'), next: 'belongs', once: true },
      { text: 'Keep counting. I am going.', next: 'bye' },
    ],
  },
  why: {
    speaker: 'scav',
    text: 'Metal is metal. People pay for it. Hadda pays in stew.',
    next: 'hub',
  },
  belongs: {
    speaker: 'scav',
    text: 'Hadda cut the wreck open and then ran. Things belong to whoever carries them. Ask anyone out on the sand.',
    next: 'hub',
  },
  marksFull: {
    text: 'Pell reaches for a bolt and a sleeve rides up. Dark lines on the forearm, cut in a pattern. Band marks. Pell sees you see.',
    do: (c) => c.set('sawMarks'),
    next: 'marks2',
  },
  marksPartial: {
    text: 'Something is off. Pell tugs a sleeve down every few seconds, even in this heat. You do not see what it hides.',
    next: 'hub',
  },
  marksMiss: {
    speaker: 'scav',
    text: 'Staring costs extra.',
    next: 'hub',
  },
  marks2: {
    speaker: 'scav',
    text: 'Covered is covered. You want to make something of it?',
    choices: [
      { text: 'No. Your business is yours.', next: 'keep' },
      { text: 'Does Hadda know?', next: 'haddaKnow', once: true },
      { text: 'Hadda should know.', next: 'threat' },
      { text: 'Covered costs extra. What is my quiet worth to you?', next: 'sly', if: (c) => !c.flag('pellPaidQuiet') },
    ],
  },
  haddaKnow: {
    speaker: 'scav',
    text: 'Hadda knows what Hadda wants to know. My band is four days west. I came here to eat. That is all.',
    next: 'marks2',
  },
  keep: {
    speaker: 'scav',
    text: "Good. Then you saw bolts. Only bolts. We'll get on.",
    do: (c) => {
      c.set('pellTrust');
      c.quest('pell', 'Covered is covered', 'Pell has scavenger band marks. I said nothing.');
    },
    next: 'hub',
  },
  sly: {
    speaker: 'scav',
    text: 'Pell laughs once, through the nose, and tosses you a charge-fruit. "That is what quiet costs today. Tomorrow it costs less."',
    do: (c) => {
      c.set('pellPaidQuiet');
      c.set('pellTrust');
      c.give('chargeFruit');
      c.toast('Received: charge-fruit', 'good');
      c.quest('pell', 'Covered is covered', 'Pell has scavenger band marks. Pell paid me a charge-fruit to keep quiet.');
    },
    next: 'hub',
  },
  threat: {
    speaker: 'scav',
    text: "Then tell. I'll be gone before your feet are dusty. The crystal still waits in the gully. I pay my debts, even to talkers.",
    do: (c) => {
      c.set('pellThreatened');
      c.quest('pell', 'Covered is covered', 'Pell has scavenger band marks. I said Hadda should know. Pell did not blink.');
    },
    next: 'bye',
  },
  bye: {
    speaker: 'scav',
    text: (c) => (c.flag('telDead') ? 'Go on, then. Mind Hadda. She minds everything.' : 'Mind the ded-waka. It minds you.'),
    end: true,
  },

  // After the ded-waka sleeps, Pell turns up at the gully.
  gully: {
    speaker: 'scav',
    text: (c) =>
      c.flag('pellReported')
        ? 'Pell steps out from behind a rock. "Thrown out of camp. Thanks for that. The plating is mine now. I think I earned it."'
        : c.flag('pellThreatened')
          ? 'Pell steps out from behind a rock and looks at the four heaps. "You did not tell Hadda, then. Or not yet. Neat work."'
          : isk(c)
            ? 'Pell steps out from behind a rock and looks at the four heaps in the gully. "Neat work. It sleeps like a stone. No offence."'
            : 'Pell steps out from behind a rock and looks at the four heaps in the gully. "Neat work. It sleeps like the dead. Which it is, mostly."',
    choices: [
      { text: 'It is yours. As agreed.', if: (c) => !c.flag('pellReported'), next: 'gullyGive' },
      { text: 'Take it and go.', if: (c) => c.flag('pellReported'), next: 'gullyGo' },
      {
        text: "The plating goes back to Hadda's crew.",
        check: {
          stat: 'presence',
          specs: ['negotiation', 'intimidation'],
          label: 'Face Pell down',
          win: 'Plating stays, Pell may still pay',
          risk: "Pell's band fights you for it",
          full: 'gullyWin',
          partial: 'gullyHalf',
          miss: 'gullyFight',
        },
      },
    ],
  },
  gullyGive: {
    speaker: 'scav',
    text: 'Then here. Pale, as promised, and clean. Hold it to old marks and they light up. Useful, in ruins.',
    do: (c) => {
      c.crystal('pale');
      c.set('scrapTo', 'pell');
      c.toast('Received: pale crystal', 'crystal');
      c.quest('pell', 'Covered is covered', 'I let Pell have the plating. Pell paid in a pale crystal, as promised.', true);
    },
    next: 'gullyEnd',
  },
  gullyGo: {
    speaker: 'scav',
    text: 'I will. Next time you see a band-shen, look the other way. It is cheaper.',
    do: (c) => {
      c.set('scrapTo', 'pell');
      c.quest('pell', 'Covered is covered', 'Pell took the plating and left. No crystal, and no goodbye.', true);
    },
    next: 'gullyEnd',
  },
  gullyWin: {
    speaker: 'scav',
    text: 'Pell looks at you for a long moment, then laughs once. "Fine. Keep your stew-metal. Take the crystal anyway. I do not like owing."',
    do: (c) => {
      c.crystal('pale');
      c.set('scrapTo', 'camp');
      c.toast('Received: pale crystal', 'crystal');
      c.quest('pell', 'Covered is covered', 'I kept the plating for the camp. Pell left, and paid me anyway.', true);
    },
    next: 'gullyEnd',
  },
  gullyHalf: {
    speaker: 'scav',
    text: '"Fine. Keep it." Pell spits in the sand and walks west. There is no crystal.',
    do: (c) => {
      c.set('scrapTo', 'camp');
      c.quest('pell', 'Covered is covered', 'I kept the plating for the camp. Pell spat and left with nothing.', true);
    },
    next: 'gullyEnd',
  },
  gullyFight: {
    speaker: 'scav',
    text: 'Pell whistles two notes. A second figure rises from the rocks with a sling. "Then we do it the old way."',
    do: async (c) => {
      c.set('scrapTo', 'contested');
      await c.act('pell-fight');
    },
    end: true,
  },
  gullyEnd: {
    text: 'Pell walks off into the sand. In a minute there is nothing to see but heat.',
    do: async (c) => {
      await c.act('pell-leave');
    },
    end: true,
  },
};

// ------------------------------------------------------------------ small camp voices
// Mother Tarn. Want: everyone fed. Tic: "Eat first." Everything is a bowl.
// Dodge: answers a hard question with food.

export const cook: Dialogue = {
  start: {
    speaker: 'cook',
    text: (c) => {
      if (badlyHurt(c) && !isk(c)) return 'Mother Tarn takes one look at you and points at the stool. "Sit down before you fall down. Eat first. Bleed later."';
      if (c.flag('ateStew')) return 'Mother Tarn bangs the ladle on the pot. "Back again? The pot is never empty. Well. Nearly never."';
      if (isk(c)) return 'Mother Tarn stirs a pot of digger-tuber stew. She looks at your stone hands. "Your kind don\'t eat. I know. Sit by the pot anyway. Stone likes warm."';
      return 'Mother Tarn stirs a pot of digger-tuber stew. "Eat first. Heroes are for stories. You are going out on the sand."';
    },
    choices: [
      { text: 'Yes, please. It smells wonderful.', if: (c) => !isk(c) && !c.flag('ateStew'), next: 'eat' },
      { text: 'Is it safe to eat?', if: (c) => !isk(c) && !c.flag('ateStew'), next: 'safe', once: true },
      { text: 'Sit by the pot a while.', if: (c) => isk(c) && !c.flag('ateStew'), next: 'warm' },
      { text: 'Does the apprentice ever eat?', next: 'appr', once: true },
      { text: "Pell's gone, then?", if: (c) => c.flag('pellReported'), next: 'pellGone', once: true },
      { text: 'Those two dogs seem to like you.', if: (c) => c.flag('dogsCalmed'), next: 'dogs', once: true },
      { text: 'Later, Mother Tarn.', next: 'bye' },
    ],
  },
  safe: {
    speaker: 'cook',
    text: 'Safer than the sand. Nobody has died of my stew. Brenn came close once, but that was Brenn.',
    next: 'eat',
  },
  eat: {
    text: 'Hot, starchy and a bit burnt. It is the best thing you have eaten in days.',
    do: (c) => {
      c.set('ateStew');
      c.act('heal-light');
    },
    next: 'eat2',
  },
  eat2: {
    speaker: 'cook',
    text: "Burnt is flavour. Don't let Hadda tell you different.",
    end: true,
  },
  warm: {
    text: 'You sit by the pot. The heat soaks into your stone, slow and deep. The ache in your hands eases.',
    do: (c) => {
      c.set('ateStew');
      c.act('heal-light');
    },
    next: 'warm2',
  },
  warm2: {
    speaker: 'cook',
    text: 'There. Stone gets cold out on the sand. Nobody believes me.',
    end: true,
  },
  appr: {
    speaker: 'cook',
    text: 'Never. His kind don\'t need it. I take him a bowl every day anyway. He holds it till it goes cold. Company, I suppose.',
    next: 'start',
  },
  pellGone: {
    speaker: 'cook',
    text: 'Gone. Hadda threw them out. I packed them a bowl first. Nobody leaves my pot hungry, band marks or no.',
    next: 'start',
  },
  dogs: {
    speaker: 'cook',
    text: 'They follow me everywhere now. Your doing, I hear. They eat better than Hadda does.',
    next: 'start',
  },
  bye: {
    speaker: 'cook',
    text: (c) => (isk(c) ? 'Come and sit later. Stone gets cold out there.' : 'Your stomach will ask later.'),
    end: true,
  },
};

// Unreachable: Osk has no entity in level1.ts. Left as it was.
export const kid: Dialogue = {
  start: {
    speaker: 'kid',
    text: (c) =>
      isk(c)
        ? 'A small Mi\'naa child stares at your stone hands. "Are you very old? Do you remember the ded-waka coming?"'
        : seh(c)
          ? 'A small Mi\'naa child stares at your eyes. "Can you really feel the kin under the sand? Is there any under me?"'
          : 'A small Mi\'naa child tugs your sleeve. "Are you going to the ruin? Bring me a teal stone. A small one."',
    choices: [
      {
        text: 'I do not remember. I am sorry.',
        if: isk,
        next: 'iskBye',
      },
      {
        text: 'Kneel and put a palm on the sand.',
        if: seh,
        next: 'sehFeel',
      },
      { text: 'We will see.', next: 'bye' },
    ],
  },
  iskBye: {
    speaker: 'kid',
    text: '"That is all right. I don\'t remember much either. Mama says that is normal."',
    end: true,
  },
  sehFeel: {
    text: 'Far below, faint as a pulse through a wall, something hums. Not under the child. North, under the ruin. A lot of it.',
    do: (c) => c.set('sehFeltNorth'),
    end: true,
  },
  bye: { speaker: 'kid', text: '"A small one," the child says again.', end: true },
};

// ------------------------------------------------------------------ the symbol door

export const symbolDoor: Dialogue = {
  start: {
    text: (c) =>
      c.flag('doorTried')
        ? 'The door is still sealed. The curved marks sit in their rings, waiting for you to try again.'
        : 'A round door of pale stone fills the hall. Curved marks run around it in rings. A thread of teal light moves through them, then stops. There is no handle. There is no seam.',
    do: (c) => c.set('doorTried'),
    choices: [
      {
        text: 'Let the meaning come.',
        tag: '[Iskari]',
        if: isk,
        next: 'iskRead',
      },
      {
        text: 'Hold the pale crystal to the marks.',
        tag: '[Pale crystal]',
        if: (c) => c.hasCrystal('pale'),
        check: {
          stat: 'resonance',
          specs: ['channellingDepth', 'crystalLore', 'azalosTech'],
          label: 'Wake the door with pale light',
          win: 'The door opens',
          risk: 'The crystal cracks, and something notices',
          full: 'paleFull',
          partial: 'palePartial',
          miss: 'paleMiss',
        },
      },
      {
        text: 'Put your palm flat on the stone and listen.',
        tag: '[Sehari]',
        if: seh,
        check: {
          stat: 'resonance',
          specs: ['boneSinging', 'channellingDepth', 'naturalism'],
          bonus: -1,
          label: 'Listen to the door',
          win: 'The door opens to your touch',
          risk: 'A burnt hand',
          full: 'listenFull',
          partial: 'listenPartial',
          miss: 'listenMiss',
        },
      },
      {
        text: "Fuse a bypass from Tel'sharin scrap.",
        tag: "[Mi'naa]",
        if: min,
        lock: (c) => (c.has('scrap') ? null : "You need Tel'sharin scrap. The heaps by the wreck have plenty."),
        check: {
          stat: 'mind',
          specs: ['minaaTech', 'telsharinTech', 'mechanics'],
          label: 'Fuse a bypass',
          win: 'The door opens, quietly',
          risk: 'Burnt fingers and a loud door',
          full: 'fuseFull',
          partial: 'fusePartial',
          miss: 'fuseMiss',
        },
      },
      {
        text: 'Study the marks for a pattern.',
        if: (c) => !c.flag('doorStudied'),
        check: {
          stat: 'mind',
          specs: ['archaeology', 'lore', 'linguistics'],
          label: 'Study the door',
          win: 'Find the pattern in the rings',
          risk: 'Nothing but your pride',
          full: 'studyFull',
          partial: 'studyPartial',
          miss: 'studyMiss',
        },
      },
      {
        text: "Match the apprentice's rubbing to the marks.",
        if: (c) => c.has('rubbing') && c.flag('doorStudied') && !isk(c),
        next: 'rubbing',
      },
      { text: 'Leave it for now.', next: 'leave' },
    ],
  },
  leave: { text: 'You step back. The teal thread moves once more, then rests.', end: true },
  iskRead: {
    text: 'The marks arrive whole, the way warmth arrives on your face. *Kept for those who come back.* A question sits under the words. You answer it without speaking.',
    next: 'opens',
  },
  opens: {
    text: 'The rings turn. Stone slides on stone with no sound at all. The door opens like an eye.',
    do: async (c) => {
      c.set('doorOpen');
      await c.act('open', 'symbol-door');
      c.objective('Find the archive plate inside the ruin.');
      c.quest('errand', "The Keeper's errand", 'The symbol door is open. The plate must be close.');
    },
    end: true,
  },
  paleFull: {
    text: 'Pale light spills from the crystal into the rings. The marks brighten one by one, as if something checked each and found it true.',
    next: 'opens',
  },
  palePartial: {
    text: 'The rings light and turn. The crystal gets hot in your hand. A fine crack runs across it.',
    do: async (c) => {
      await c.act('chip', 'pale');
    },
    next: 'opens',
  },
  paleMiss: {
    text: (c) =>
      c.flag('guardianDead')
        ? 'The light goes into the marks and comes back wrong. The crystal cracks. Somewhere in the walls, stone grinds, then stops.'
        : 'The light goes into the marks and comes back wrong. The crystal cracks. Across the court, the drone stops mending and turns its eye towards you.',
    do: async (c) => {
      await c.act('chip', 'pale');
      c.set('guardianAlerted');
    },
    end: true,
  },
  listenFull: {
    text: 'Under the stone the old current still runs. You find its rhythm and breathe with it. The rings answer.',
    next: 'opens',
  },
  listenPartial: {
    text: 'The current finds you before you find it. It goes through your arm like cold water. The rings answer, but your hand shakes.',
    do: async (c) => {
      await c.act('wound', 'light');
    },
    next: 'opens',
  },
  listenMiss: {
    text: 'Too much, too fast. The current throws your hand off the stone. Your palm is burnt white.',
    do: async (c) => {
      await c.act('wound', 'light');
    },
    end: true,
  },
  fuseFull: {
    text: "You wedge the scrap into a gap in the rings and twist two wires into its warm core. The Tel'sharin metal wakes. The Aza'los stone does not like it. It opens anyway.",
    do: (c) => {
      c.take('scrap');
    },
    next: 'opens',
  },
  fusePartial: {
    text: 'The scrap spits sparks and burns your fingers. The rings grind open, loud as a rockfall. Anything in the ruin heard that.',
    do: async (c) => {
      c.take('scrap');
      c.set('guardianAlerted');
      await c.act('wound', 'light');
    },
    next: 'opens',
  },
  fuseMiss: {
    text: 'The scrap flares and dies. The door does not even hum. The scrap is still in your hand, still warm enough to try again.',
    end: true,
  },
  studyFull: {
    text: 'The outer ring repeats. The inner rings do not. One inner mark is the same as the rubbing: three rings, one broken. The door wants that shape traced in order.',
    do: (c) => c.set('doorStudied'),
    next: 'start',
  },
  studyPartial: {
    text: 'There is a pattern. Rings inside rings. One mark looks familiar, but you cannot say from where. Something you were given, maybe.',
    do: (c) => c.set('doorStudied'),
    next: 'start',
  },
  studyMiss: {
    text: 'You count the rings. You count them again and get a different number. The teal thread waits, as if it has seen this before.',
    next: 'start',
  },
  rubbing: {
    text: 'You hold the cloth up to the stone. The broken ring matches one mark exactly. You trace it with a finger: outer, middle, inner, and the break.',
    choices: [
      {
        text: 'Trace it slowly.',
        check: {
          stat: 'edge',
          specs: ['sleight', 'archaeology'],
          bonus: 1,
          label: 'Trace the Keeper mark',
          win: 'The door opens',
          risk: 'The stone bites your finger',
          full: 'opens',
          partial: 'traceCost',
          miss: 'traceMiss',
        },
      },
      { text: 'Not yet. Roll the cloth back up.', next: 'leave' },
    ],
  },
  traceCost: {
    text: 'The stone warms under your finger and bites. The rings turn.',
    do: async (c) => {
      await c.act('wound', 'light');
    },
    next: 'opens',
  },
  traceMiss: {
    text: 'Your finger slips at the break. The teal thread flares and goes dark. After a while it creeps back, ready for another try.',
    end: true,
  },
};

// ------------------------------------------------------------------ the ring puzzle clue

export const signRings: Dialogue = {
  start: {
    text: (c) =>
      isk(c)
        ? 'Marks in a curved panel. The meaning arrives whole: *The outer rings wake. The middle ring sleeps. Then the way is kept open.*'
        : 'A curved panel of marks: three rings, drawn again and again. In each drawing the middle ring is scratched through.',
    do: (c) => c.set('readRings'),
    choices: [
      {
        text: 'Work out what it means.',
        if: (c) => !isk(c) && !c.flag('ringsSolved'),
        check: {
          stat: 'mind',
          specs: ['archaeology', 'lore', 'linguistics'],
          label: 'Read the ring panel',
          win: 'Learn which sockets to light',
          risk: 'You guess at the sockets',
          full: 'ringsFull',
          partial: 'ringsPartial',
          miss: 'ringsMiss',
        },
      },
      { text: 'Step back.', next: 'back' },
    ],
  },
  back: { text: 'You step back. One scratched ring catches the light, as if it wants you to notice.', end: true },
  ringsFull: {
    text: 'Three sockets, three rings. Light the outer two. Leave the middle one dark. Someone scratched it out a hundred times so nobody would forget.',
    do: (c) => c.set('ringsSolved'),
    end: true,
  },
  ringsPartial: {
    text: 'The middle ring is always crossed out. Whatever the middle one is, it should stay off.',
    end: true,
  },
  ringsMiss: {
    text: 'Three rings, drawn over and over, with a scratch through one. The lines blur when you try to hold them. Maybe the sockets will tell you more.',
    end: true,
  },
};

// ------------------------------------------------------------------ the archive

export const archive: Dialogue = {
  start: {
    text: 'A thin plate of pale stone rests in a curved niche. Three rings are cut into its face, one broken. Azure threads drift under the surface like fish under ice.',
    choices: [
      { text: 'Take the plate.', next: 'touch' },
      { text: 'Not yet.', next: 'wait' },
    ],
  },
  wait: { text: 'The threads slow, as if waiting with you.', end: true },
  touch: {
    text: 'The moment your skin touches it, the room goes blue. The voice comes thin and slow, the way old wax gives up a mark.',
    do: async (c) => {
      await c.act('memory-start');
    },
    next: 'r1',
  },
  r1: {
    speaker: 'record',
    text: 'If this plate is warm, someone has come back. I hope it is you, my apprentice. I hope it is not only the sand.',
    next: 'r2',
  },
  r2: {
    speaker: 'record',
    text: 'The ripple is close. I feel it at the back of my teeth. I have maybe a day before I go still.',
    next: 'r3',
  },
  r3: {
    speaker: 'record',
    text: (c) =>
      min(c)
        ? "I followed the resettlement records north. [The next marks are numbers, in Mi'naa script. You can read them. A year: thirteen hundred.]"
        : 'I followed the resettlement records north. [The next marks are numbers in an old script. They slide away from you.]',
    next: 'r4',
  },
  r4: {
    speaker: 'record',
    text: 'Where the old city broke, between the Reach and the Spines, there is a stair that goes down. Our records never mention it. That is why I went.',
    next: 'r5',
  },
  r5: {
    speaker: 'record',
    text: (c) =>
      isk(c)
        ? 'Something below is still awake. [For a moment you know this voice. The words mean nothing, but the voice is known. Then it is gone, and your hands are shaking.]'
        : seh(c)
          ? 'Something below is still awake. [Under the voice, the ground hums. Many hums, very far down, like a crowd behind a wall.]'
          : 'Something below is still awake. [The plate buzzes against your palm, the way an implant does when it is about to fail.]',
    next: 'r6',
  },
  r6: {
    speaker: 'record',
    text: 'Do not follow me alone. Find people who remember different things. Between you, you may remember enough.',
    next: 'r7',
  },
  r7: {
    text: 'The voice stops. Two hundred years ago she said the ripple was close. It came, and she did not.',
    next: 'r8',
  },
  r8: {
    text: 'The blue drains out of the room. The plate goes cold in your hands. It is very light, for what it carries.',
    do: async (c) => {
      await c.act('memory-end');
      c.give('archive');
      c.toast('Received: Keeper archive plate', 'quest');
      c.quest('errand', "The Keeper's errand", 'Her last words are on this plate. She went north, to a stair under the broken city. He should hear this from me.');
      c.objective('Take the plate back to the apprentice in the camp.');
    },
    end: true,
  },
};

// ------------------------------------------------------------------ the empty tent (the reveal)

export const tent: Dialogue = {
  start: {
    text: 'The apprentice is not on his crate. The tent flap is open. Inside, a lamp still burns.',
    next: 't2',
  },
  t2: {
    text: (c) =>
      c.flag('apprenticeAfraid')
        ? 'The wax tablets are scattered on the floor. One is split in two. A long scrape runs through the sand, out of the tent, towards the north road he kept watching.'
        : 'The wax tablets are scattered on the floor. One is split in two. A long scrape runs through the sand to the back of the tent, and out.',
    next: 't3',
  },
  t3: {
    text: 'Half under the bedroll there is a scrap of cloth with charcoal on it. Most of it is burnt.',
    choices: [
      { text: 'Read what is left.', next: 't4' },
    ],
  },
  t4: {
    text: '*...the ded-waka had no part in it. They came for the plate. They never wanted me... tell them the stair... do not let them take...* The rest is ash.',
    do: async (c) => {
      c.give('note');
      c.quest('errand', "The Keeper's errand", 'He is gone. Someone dragged him out of his own tent. His note says they came for the plate.', true);
      await c.act('ending');
    },
    end: true,
  },
};

// ------------------------------------------------------------------ one-off beats

export const spireRoot: Dialogue = {
  start: {
    text: (c) =>
      seh(c)
        ? 'A lone spire-root stands in the open sand, woody and twisted. You feel it before you see it. Under its roots, something cool and bright. Pale.'
        : 'A lone spire-root stands in the open sand, woody and twisted. Nothing else grows for fifty paces.',
    choices: [
      {
        text: 'Dig where the feeling is strongest.',
        if: seh,
        once: true,
        next: 'dig',
      },
      {
        text: 'Why would a tree grow alone out here?',
        if: (c) => !seh(c),
        once: true,
        check: {
          stat: 'mind',
          specs: ['survival', 'naturalism', 'crystalLore'],
          label: 'Read the spire-root',
          win: 'Find what the tree drinks from',
          risk: 'Sand in your boots, nothing more',
          full: 'readFull',
          partial: 'readPartial',
          miss: 'readMiss',
        },
      },
      { text: 'Move on.', next: 'move' },
    ],
  },
  move: { text: 'The tree creaks in the hot wind.', end: true },
  dig: {
    text: 'An arm deep, the sand turns cool. Your fingers close on a pale crystal the size of a thumb. It holds the light like water.',
    do: (c) => {
      c.act('reveal-buried');
      c.set('dugRoot');
    },
    end: true,
  },
  readFull: {
    text: 'Prospectors say a lone spire-root drinks from buried crystal. You dig between the roots. An arm deep, your fingers close on a pale crystal.',
    do: (c) => {
      c.act('reveal-buried');
      c.set('dugRoot');
    },
    end: true,
  },
  readPartial: {
    text: 'It must be drinking from something below. You dig, but the sand keeps sliding back. You find a few charge-fruit fallen in the roots instead.',
    do: (c) => {
      c.give('chargeFruit');
      c.toast('Received: charge-fruit', 'good');
    },
    end: true,
  },
  readMiss: {
    text: 'You kick at the roots. Sand, more sand, and a beetle that looks offended. Whatever feeds this tree lies deeper than you dug.',
    end: true,
  },
};

export const scarView: Dialogue = {
  start: {
    text: 'From the ridge you can see it. Far to the north, a long wound in the land, red-brown at the edges. The Scar. Nothing moves there. Nothing grows.',
    end: true,
  },
};

export const crack: Dialogue = {
  start: {
    text: 'The crack is a shoulder wide. Loose stone hangs above it. Someone has hammered old bolts into the rock as handholds. Some of the bolts are missing.',
    choices: [
      {
        text: 'Climb through. Trust your arms.',
        check: {
          stat: 'body',
          specs: ['athletics'],
          label: 'Climb the crack',
          win: 'Over the ridge, past the ded-waka',
          risk: 'A fall, a wound, back at the bottom',
          full: 'through',
          partial: 'throughHurt',
          miss: 'fall',
        },
      },
      {
        text: 'Squeeze through, light and careful.',
        check: {
          stat: 'edge',
          specs: ['athletics'],
          label: 'Squeeze through the crack',
          win: 'Over the ridge, past the ded-waka',
          risk: 'A fall, a wound, back at the bottom',
          full: 'through',
          partial: 'throughHurt',
          miss: 'fall',
        },
      },
      { text: 'Not this way.', next: 'no' },
    ],
  },
  no: {
    text: 'A pebble rattles down the crack as you turn away.',
    do: async (c) => {
      await c.act('crack-back');
    },
    end: true,
  },
  through: {
    text: 'Hand, foot, bolt, breathe. The rock scrapes both shoulders. Then there is sky again, and the ruin below you.',
    do: async (c) => {
      await c.act('crack', 'top');
    },
    end: true,
  },
  throughHurt: {
    text: 'A bolt pulls loose under your hand. You catch the rock with your forearm and lose some skin. But you are through.',
    do: async (c) => {
      await c.act('wound', 'light');
      await c.act('crack', 'top');
    },
    end: true,
  },
  fall: {
    text: 'The rock gives. You slide the whole way down in a rush of grit and land hard. The crack is still there. So are you, mostly.',
    do: async (c) => {
      await c.act('wound', 'light');
      await c.act('crack', 'bottom');
    },
    end: true,
  },
};

export const telFirst: Dialogue = {
  start: {
    text: 'It crouches over a heap of torn plating. Bone and dark green metal, grown into each other. A tube slides out of its chest and into the metal. Red light pulses along its seams, slow, like breathing.',
    next: (c) => (isk(c) ? 'isk' : 'end'),
  },
  isk: {
    text: 'Then its head turns, straight towards you. You have not made a sound.',
    next: 'end',
  },
  end: {
    text: 'Four heaps of plating lie around it. The gap in the ridge runs right past.',
    do: (c) => {
      c.set('sawTel');
      c.quest('dedwaka', 'The ded-waka', 'I saw it feed. Bone and metal, lit red from inside. Four heaps of plating keep it going, and it sits right on the path.');
      c.objective('Get past the ded-waka. Fight, starve, sneak, or climb.');
    },
    end: true,
  },
};

// Old guardian scene, kept for old saves. The level now uses droneFirst.
export const guardianFirst: Dialogue = {
  start: {
    text: (c) =>
      isk(c)
        ? 'A small teal drone hangs in the air of the court. Its eye passes over your face, and it goes back to its work. It knows what you are.'
        : 'A small teal drone hangs in the air of the court. A thin beam runs from it into a crack in the wall. It has not seen you. Yet.',
    do: (c) => {
      c.set('sawGuardian');
      if (isk(c)) c.set('guardianFriendly');
    },
    end: true,
  },
};

// Phase 2: the guardian is a small repair drone. It leaves an Iskari alone unless attacked.
export const droneFirst: Dialogue = {
  start: {
    text: (c) =>
      isk(c)
        ? 'Something small hangs in the air of the court: pale stone, the size of a lamb, one teal eye. It turns the eye on you and looks for a long moment. Then it goes back to the crack it was mending. You belong here, as far as it cares.'
        : 'Something small hangs in the air of the court: pale stone, the size of a lamb, one teal eye. A thin beam runs from it into a crack in the wall, and the crack is closing. It has not seen you. Yet.',
    do: (c) => {
      c.set('sawGuardian');
      if (isk(c)) c.set('guardianFriendly');
    },
    end: true,
  },
};

export const droneIskari: Dialogue = {
  start: {
    text: 'The drone hums at the wall. Under its beam the stone runs shut like warm wax. It does not look round.',
    choices: [
      { text: 'Let it work. It is the only thing here still looking after the place.', next: 'leave' },
      {
        text: 'Knock it out of the air. You do not want it at your back.',
        tag: 'Starts a fight',
        do: (c) => c.act('attack-drone'),
        next: 'strike',
      },
    ],
  },
  leave: { text: 'You step round it. It shifts a hand-width to let you pass, and carries on.', end: true },
  strike: { text: 'You move first. The teal eye swings round, very fast.', end: true },
};

export const dogsCalm: Dialogue = {
  start: {
    text: 'Two lean dogs come out of the wreck shadows, heads low. Ribs show through sun-dark fur. They have not decided about you yet.',
    choices: [
      {
        text: 'Crouch low. Show them empty hands.',
        check: {
          stat: 'presence',
          specs: ['naturalism', 'survival'],
          label: 'Calm the dogs',
          win: 'They leave you alone',
          risk: 'Both dogs go for you',
          full: 'calm',
          partial: 'half',
          miss: 'fight',
        },
      },
      { text: 'Pick up a rock. Let them come.', next: 'fight' },
    ],
  },
  calm: {
    text: 'You keep still and let them smell the air. The bigger one sneezes. They lose interest and trot off towards the camp scraps.',
    do: async (c) => {
      await c.act('dogs-leave');
    },
    end: true,
  },
  half: {
    text: 'The smaller dog backs off. The bigger one does not.',
    do: async (c) => {
      await c.act('dogs-half');
    },
    end: true,
  },
  fight: {
    text: 'The bigger dog drops its head and shows every tooth it has. The smaller one circles to your left.',
    do: async (c) => {
      await c.act('dogs-fight');
    },
    end: true,
  },
};

// ------------------------------------------------------------------ the Sehari hunter, north of the ridge
// Want: the animals back, so she can hunt. Tic: stillness, Sehari roots (sael, kin).
// Dodge: silence, then "Walk soft."

export const hunter: Dialogue = {
  start: {
    text: (c) =>
      seh(c)
        ? 'The hunter drops from four limbs to two as you come near. Pale-gold eyes, root-dark marks down one cheek.'
        : 'A Sehari hunter crouches on a rock, grey-lavender skin cracked like dry clay. Pale-gold eyes follow you. They do not blink much.',
    next: 'hub',
  },
  hub: {
    speaker: 'hunter',
    again: ['Speak, then.', 'You are still loud.', 'Sit, or go round.', 'What now?'],
    text: (c) => {
      if (badlyHurt(c)) return 'You smell of blood. Everything out here can smell it too. Keep moving, or sit very still.';
      if (seh(c)) return 'Sael is loud today. You hear it too.';
      if (c.flag('telAsleep') || c.flag('telDead')) return 'You again. The ground is quieter since you went east. Speak, then.';
      return 'You walk loud. Everything for a mile heard you. Sit, or go round.';
    },
    choices: [
      { text: 'Anything worth hunting out here?', next: 'hunt', once: true },
      { text: 'Have you been inside the ruin?', next: 'ruin', once: true },
      { text: 'Is the ground loud here?', if: seh, next: 'loud', once: true },
      { text: 'Sorry. I will walk softer.', next: 'bye' },
    ],
  },
  hunt: {
    speaker: 'hunter',
    text: (c) =>
      c.flag('telDead')
        ? 'Nothing, yet. The ded-waka is dead, I think. The ground feels lighter. The animals will follow in a day or two.'
        : c.flag('telAsleep')
          ? 'Nothing, yet. The ded-waka sleeps again. I felt it go still. The animals will come back soon.'
          : 'Nothing. The ded-waka woke. Every animal for a day around went still. I am waiting for them to come back.',
    next: 'hub',
  },
  ruin: {
    speaker: 'hunter',
    text: 'No. A small machine lives in there. Teal eye, thin beam. It mends one crack, then the next, all day. It never gets tired. I do.',
    do: (c) => c.quest('errand', "The Keeper's errand", 'The hunter says a small teal machine lives in the ruin. It mends cracks all day and never tires.'),
    next: 'hub',
  },
  loud: {
    speaker: 'hunter',
    text: 'Under the lone tree, south of here, something cool and bright. Under the ruin, much more. Old kin, deep down. It does not like being walked on. [Kin: crystal, in the old words. You have always known it.]',
    next: 'hub',
  },
  bye: { speaker: 'hunter', text: 'Walk soft.', end: true },
};

// ------------------------------------------------------------------ barks
// The game picks one line at random from the array.
// Keys already wired: 'npc-digger', 'npc-digger:after', 'npc-cook:after', 'npc-lookout:after'.
// New keys, for agent B to wire (the digger ones should be checked before plain 'npc-digger'):
//   'npc-digger:telAsleep'     digger, once telAsleep is set
//   'npc-digger:telDead'       digger, once telDead is set
//   'npc-digger:crackClimbed'  digger, once crackClimbed is set (and the ded-waka is still awake)
//   'npc-digger:iskari'        digger, player race iskari (mix in with the plain lines)
//   'npc-digger:sehari'        digger, player race sehari (mix in with the plain lines)
//   'combat:start:<kind>'      one line of narration as a fight starts (combat.ts banner). Kinds: telsharin, dog, drone, defender, scavenger
//   'combat:hit'               the player lands a hit (combat.ts hurt())
//   'combat:miss'              the player misses (combat.ts, the miss branch)
//   'combat:wounded:<sev>'     the player takes a wound: light, moderate, severe (combat.ts applyHarm)
//   'combat:down:<kind>'       an enemy falls (combat.ts down()). Kinds: telsharin, dog, drone, defender
//   'combat:feeds'             the Tel'sharin feeds on plating mid-fight (combat.ts, the "Feeds +1" branch)
//   'stealth:unseen'           a full stealth success (game.ts, the "?" float)
//   'stealth:suspicious'       a partial stealth roll (replaces "It heard something...")
//   'stealth:spotted'          the player is seen (game.ts, the "!" float)
//   'camp:return:pellGone'     walking back into camp after pellGone or pellReported
//   'camp:return:telDead'      walking back into camp after telDead
//   'camp:return:telAsleep'    walking back into camp after telAsleep
//   'collapse:tarn'            Mother Tarn, as the player wakes in camp after a collapse (game.ts, after fade clear)

export const BARKS: Record<string, string[]> = {
  'npc-digger': [
    'Dig, sift, dig. The sand gives back one bolt a day. On a good day.',
    'Brenn says the ded-waka looked right at him. Brenn says a lot of things.',
    'Found a spoon yesterday. Best day this month.',
  ],
  'npc-digger:after': ['The stone man is gone? He was always here. Always.'],
  'npc-cook:after': ['Nobody took stew to the apprentice today. Nobody saw him go.'],
  'npc-lookout:after': ['I watched the east all day, like a fool. They came from the north.'],

  'npc-digger:telAsleep': [
    'Asleep, they say. I sleep too. Nobody calls that good news.',
    'You starved it? Then I can dig east again. Lucky me.',
    'Brenn wants to go and look at it. Brenn is an idiot.',
  ],
  'npc-digger:telDead': [
    'Dead? Properly dead? Brenn will go looking for that arm now.',
    'You killed the ded-waka? Then I dig east tomorrow. Maybe.',
    'Dead-walker, and now just dead. About time.',
  ],
  'npc-digger:crackClimbed': [
    'You went up the crack and came down whole? Show-off.',
    'Nobody climbs that crack twice. Nobody sensible.',
    'The crack, eh? Your shoulders look like it.',
  ],
  'npc-digger:iskari': [
    'Another stone one. Do you lot ever sit anywhere but crates?',
    'Mind the pit. Or don\'t. Stone bounces, I expect.',
  ],
  'npc-digger:sehari': [
    'Can you feel any kin under here? No? Figures.',
    'Hadda says not to ask you about crystal. So. Any crystal?',
  ],

  'combat:start:telsharin': [
    'The ded-waka unfolds from its heap. Red light floods its seams.',
    'Its head turns. The feeding tube slides out, dripping.',
    'The red in its seams burns brighter. It has found food.',
  ],
  'combat:start:dog': [
    'The dogs split left and right, low and quiet.',
    'A growl, then paws in the sand, coming fast.',
    'Ribs, teeth, and no patience left.',
  ],
  'combat:start:drone': [
    'The drone stops mending. Its teal eye swings round to you.',
    'The beam leaves the wall and finds your chest.',
    'The drone rises a hand higher. Its hum turns sharp.',
  ],
  'combat:start:defender': [
    'Stone cracks off its shoulders. It takes the step it was frozen in.',
    'Teal light fills its cracks. It raises one arm towards you.',
    'It walks towards you. It will not stop walking.',
  ],
  'combat:start:scavenger': [
    'A sling starts to whirl. Pell steps back to give it room.',
    '"Nothing personal," says Pell. "It is only metal."',
  ],
  'combat:hit': [
    'Solid. You feel that one land.',
    'That one hurt it.',
    'A clean hit. It staggers back.',
    'Good. Now do it again.',
  ],
  'combat:miss': [
    'Close. Close is nothing.',
    'Air. Just air, and sand.',
    'It twists away at the last moment.',
    'You overreach, and it knows it.',
  ],
  'combat:wounded:light': [
    'A sting. Nothing yet.',
    'That will bruise tomorrow.',
    'A little blood. Keep moving.',
  ],
  'combat:wounded:moderate': [
    'That one went deep. Breathe.',
    'Your arm goes hot, then numb.',
    'You are hurt now. Properly hurt.',
  ],
  'combat:wounded:severe': [
    'One more like that and you go down.',
    'The world tilts. Hold on to it.',
    'Everything sounds loud and far away.',
  ],
  'combat:down:telsharin': [
    'The red light gutters out. The dead-walker is only dead now.',
    'It folds over its heap. Bone settles into metal.',
    'Its seams go dark, one by one, like lamps put out.',
  ],
  'combat:down:dog': [
    'The dog yelps once and lies still.',
    'It drops in the sand. Poor thing. It was only hungry.',
  ],
  'combat:down:drone': [
    'The drone drops. Its eye flickers, then goes dark.',
    'It hits the floor, spins, hums, and stops.',
    'Down. It looks smaller on the floor than in the air.',
  ],
  'combat:down:defender': [
    'The teal leaves its cracks. It kneels, and does not rise.',
    'It stops mid-stride again. This time it will not wake.',
    'Stone on stone. Then the court is quiet.',
  ],
  'combat:feeds': [
    'The tube finds the plating. The red light flares brighter.',
    'It feeds mid-fight. Metal shrieks. Its wounds close.',
    'It sucks at the heap, and its seams glow hotter.',
  ],

  'stealth:unseen': [
    'Nothing. It looks straight past you.',
    'You hold your breath. It moves on.',
    'Still unseen. Stay low.',
  ],
  'stealth:suspicious': [
    'It stops. Its head tilts your way.',
    'Something caught its eye. Get out of sight.',
    'It is looking. Not quite at you. Yet.',
  ],
  'stealth:spotted': [
    'It sees you. No more hiding.',
    'Found. Fight or run.',
    'It looks right at you. Too late to hide.',
  ],

  'camp:return:pellGone': [
    "Pell's cloth is gone. A few bolts lie in the sand.",
    'Somebody else is sorting bolts now. Badly.',
  ],
  'camp:return:telDead': [
    'The crew look up as you pass. Somebody claps, once.',
    'Word got here first: the ded-waka is dead.',
    'Hadda is already counting what the east is worth.',
  ],
  'camp:return:telAsleep': [
    '"Asleep, is it?" Nobody sounds sure that is good news.',
    'The crew talk quieter now, as if it might hear.',
    'Someone has painted SLIP under the skull on the sign.',
  ],

  'collapse:tarn': [
    'Lie still. The sand will wait. So will I.',
    'Two of the crew carried you in. I fed them for it.',
    'Next time, fall closer to the pot.',
    'You were out cold. I kept the pot warm.',
  ],
};

export const DIALOGUES: Record<string, Dialogue> = {
  apprentice,
  foreman,
  scav,
  cook,
  kid,
  symbolDoor,
  signRings,
  archive,
  tent,
  spireRoot,
  scarView,
  crack,
  telFirst,
  guardianFirst: droneFirst,
  droneFirst,
  droneIskari,
  dogsCalm,
  hunter,
};
