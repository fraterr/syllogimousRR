// Belief-bias syllogisms: the same logical forms as the Syllogism category, but
// with REAL categories (dogs, mammals, roses...). Whether a conclusion is true
// in the real world is computed from a small taxonomy, so believability can be
// balanced against validity: in half of the questions belief and logic agree,
// in the other half they conflict. Only the form decides the answer.

import { escapeHtml } from './util.js';

/** Category → parent category (roots have none). Siblings are disjoint. */
export const TAXONOMY = {
    animals: null, mammals: 'animals', birds: 'animals', fish: 'animals', insects: 'animals',
    dogs: 'mammals', cats: 'mammals', whales: 'mammals', horses: 'mammals',
    eagles: 'birds', penguins: 'birds', sharks: 'fish', salmon: 'fish', bees: 'insects', ants: 'insects',
    plants: null, trees: 'plants', flowers: 'plants', oaks: 'trees', pines: 'trees', roses: 'flowers', tulips: 'flowers',
    vehicles: null, cars: 'vehicles', bicycles: 'vehicles', boats: 'vehicles',
};
export const CATEGORIES = Object.keys(TAXONOMY);

/** x is y or a kind of y. */
export function isA(x, y) {
    for (let c = x; c; c = TAXONOMY[c]) if (c === y) return true;
    return false;
}

/** Real-world truth of "form S P" (A all, E no, I some, O some… not). */
export function realTruth(form, s, p) {
    const subset = isA(s, p);
    const overlap = subset || isA(p, s);
    switch (form) {
        case 'A': return subset;
        case 'E': return !overlap;
        case 'I': return overlap;
        case 'O': return !subset;
    }
    throw new Error('Unknown form ' + form);
}

// Noun forms per language. fr: [gender, plural, "aucun(e) …", "un(e) …"];
// it: [gender, plural, plural with article, "nessun(o/a) …", "un(o/a) …"];
// es: [gender, plural, plural with article, "ningún/ninguna …", "un(a) …"];
// ru: [nominative plural, genitive plural].
const N = {
    animals: { en: 'animals', de: 'Tiere', fr: ['m', 'animaux', 'aucun animal', 'un animal'], it: ['m', 'animali', 'gli animali', 'nessun animale', 'un animale'], es: ['m', 'animales', 'los animales', 'ningún animal', 'un animal'], ru: ['животные', 'животных'] },
    mammals: { en: 'mammals', de: 'Säugetiere', fr: ['m', 'mammifères', 'aucun mammifère', 'un mammifère'], it: ['m', 'mammiferi', 'i mammiferi', 'nessun mammifero', 'un mammifero'], es: ['m', 'mamíferos', 'los mamíferos', 'ningún mamífero', 'un mamífero'], ru: ['млекопитающие', 'млекопитающих'] },
    birds: { en: 'birds', de: 'Vögel', fr: ['m', 'oiseaux', 'aucun oiseau', 'un oiseau'], it: ['m', 'uccelli', 'gli uccelli', 'nessun uccello', 'un uccello'], es: ['f', 'aves', 'las aves', 'ningún ave', 'un ave'], ru: ['птицы', 'птиц'] },
    fish: { en: 'fish', de: 'Fische', fr: ['m', 'poissons', 'aucun poisson', 'un poisson'], it: ['m', 'pesci', 'i pesci', 'nessun pesce', 'un pesce'], es: ['m', 'peces', 'los peces', 'ningún pez', 'un pez'], ru: ['рыбы', 'рыб'] },
    insects: { en: 'insects', de: 'Insekten', fr: ['m', 'insectes', 'aucun insecte', 'un insecte'], it: ['m', 'insetti', 'gli insetti', 'nessun insetto', 'un insetto'], es: ['m', 'insectos', 'los insectos', 'ningún insecto', 'un insecto'], ru: ['насекомые', 'насекомых'] },
    dogs: { en: 'dogs', de: 'Hunde', fr: ['m', 'chiens', 'aucun chien', 'un chien'], it: ['m', 'cani', 'i cani', 'nessun cane', 'un cane'], es: ['m', 'perros', 'los perros', 'ningún perro', 'un perro'], ru: ['собаки', 'собак'] },
    cats: { en: 'cats', de: 'Katzen', fr: ['m', 'chats', 'aucun chat', 'un chat'], it: ['m', 'gatti', 'i gatti', 'nessun gatto', 'un gatto'], es: ['m', 'gatos', 'los gatos', 'ningún gato', 'un gato'], ru: ['кошки', 'кошек'] },
    whales: { en: 'whales', de: 'Wale', fr: ['f', 'baleines', 'aucune baleine', 'une baleine'], it: ['f', 'balene', 'le balene', 'nessuna balena', 'una balena'], es: ['f', 'ballenas', 'las ballenas', 'ninguna ballena', 'una ballena'], ru: ['киты', 'китов'] },
    horses: { en: 'horses', de: 'Pferde', fr: ['m', 'chevaux', 'aucun cheval', 'un cheval'], it: ['m', 'cavalli', 'i cavalli', 'nessun cavallo', 'un cavallo'], es: ['m', 'caballos', 'los caballos', 'ningún caballo', 'un caballo'], ru: ['лошади', 'лошадей'] },
    eagles: { en: 'eagles', de: 'Adler', fr: ['m', 'aigles', 'aucun aigle', 'un aigle'], it: ['f', 'aquile', 'le aquile', 'nessun’aquila', 'un’aquila'], es: ['f', 'águilas', 'las águilas', 'ningún águila', 'un águila'], ru: ['орлы', 'орлов'] },
    penguins: { en: 'penguins', de: 'Pinguine', fr: ['m', 'manchots', 'aucun manchot', 'un manchot'], it: ['m', 'pinguini', 'i pinguini', 'nessun pinguino', 'un pinguino'], es: ['m', 'pingüinos', 'los pingüinos', 'ningún pingüino', 'un pingüino'], ru: ['пингвины', 'пингвинов'] },
    sharks: { en: 'sharks', de: 'Haie', fr: ['m', 'requins', 'aucun requin', 'un requin'], it: ['m', 'squali', 'gli squali', 'nessuno squalo', 'uno squalo'], es: ['m', 'tiburones', 'los tiburones', 'ningún tiburón', 'un tiburón'], ru: ['акулы', 'акул'] },
    salmon: { en: 'salmon', de: 'Lachse', fr: ['m', 'saumons', 'aucun saumon', 'un saumon'], it: ['m', 'salmoni', 'i salmoni', 'nessun salmone', 'un salmone'], es: ['m', 'salmones', 'los salmones', 'ningún salmón', 'un salmón'], ru: ['лососи', 'лососей'] },
    bees: { en: 'bees', de: 'Bienen', fr: ['f', 'abeilles', 'aucune abeille', 'une abeille'], it: ['f', 'api', 'le api', 'nessun’ape', 'un’ape'], es: ['f', 'abejas', 'las abejas', 'ninguna abeja', 'una abeja'], ru: ['пчёлы', 'пчёл'] },
    ants: { en: 'ants', de: 'Ameisen', fr: ['f', 'fourmis', 'aucune fourmi', 'une fourmi'], it: ['f', 'formiche', 'le formiche', 'nessuna formica', 'una formica'], es: ['f', 'hormigas', 'las hormigas', 'ninguna hormiga', 'una hormiga'], ru: ['муравьи', 'муравьёв'] },
    plants: { en: 'plants', de: 'Pflanzen', fr: ['f', 'plantes', 'aucune plante', 'une plante'], it: ['f', 'piante', 'le piante', 'nessuna pianta', 'una pianta'], es: ['f', 'plantas', 'las plantas', 'ninguna planta', 'una planta'], ru: ['растения', 'растений'] },
    trees: { en: 'trees', de: 'Bäume', fr: ['m', 'arbres', 'aucun arbre', 'un arbre'], it: ['m', 'alberi', 'gli alberi', 'nessun albero', 'un albero'], es: ['m', 'árboles', 'los árboles', 'ningún árbol', 'un árbol'], ru: ['деревья', 'деревьев'] },
    flowers: { en: 'flowers', de: 'Blumen', fr: ['f', 'fleurs', 'aucune fleur', 'une fleur'], it: ['m', 'fiori', 'i fiori', 'nessun fiore', 'un fiore'], es: ['f', 'flores', 'las flores', 'ninguna flor', 'una flor'], ru: ['цветы', 'цветов'] },
    oaks: { en: 'oaks', de: 'Eichen', fr: ['m', 'chênes', 'aucun chêne', 'un chêne'], it: ['f', 'querce', 'le querce', 'nessuna quercia', 'una quercia'], es: ['m', 'robles', 'los robles', 'ningún roble', 'un roble'], ru: ['дубы', 'дубов'] },
    pines: { en: 'pines', de: 'Kiefern', fr: ['m', 'pins', 'aucun pin', 'un pin'], it: ['m', 'pini', 'i pini', 'nessun pino', 'un pino'], es: ['m', 'pinos', 'los pinos', 'ningún pino', 'un pino'], ru: ['сосны', 'сосен'] },
    roses: { en: 'roses', de: 'Rosen', fr: ['f', 'roses', 'aucune rose', 'une rose'], it: ['f', 'rose', 'le rose', 'nessuna rosa', 'una rosa'], es: ['f', 'rosas', 'las rosas', 'ninguna rosa', 'una rosa'], ru: ['розы', 'роз'] },
    tulips: { en: 'tulips', de: 'Tulpen', fr: ['f', 'tulipes', 'aucune tulipe', 'une tulipe'], it: ['m', 'tulipani', 'i tulipani', 'nessun tulipano', 'un tulipano'], es: ['m', 'tulipanes', 'los tulipanes', 'ningún tulipán', 'un tulipán'], ru: ['тюльпаны', 'тюльпанов'] },
    vehicles: { en: 'vehicles', de: 'Fahrzeuge', fr: ['m', 'véhicules', 'aucun véhicule', 'un véhicule'], it: ['m', 'veicoli', 'i veicoli', 'nessun veicolo', 'un veicolo'], es: ['m', 'vehículos', 'los vehículos', 'ningún vehículo', 'un vehículo'], ru: ['транспортные средства', 'транспортных средств'] },
    cars: { en: 'cars', de: 'Autos', fr: ['f', 'voitures', 'aucune voiture', 'une voiture'], it: ['f', 'automobili', 'le automobili', 'nessuna automobile', 'un’automobile'], es: ['m', 'coches', 'los coches', 'ningún coche', 'un coche'], ru: ['автомобили', 'автомобилей'] },
    bicycles: { en: 'bicycles', de: 'Fahrräder', fr: ['m', 'vélos', 'aucun vélo', 'un vélo'], it: ['f', 'biciclette', 'le biciclette', 'nessuna bicicletta', 'una bicicletta'], es: ['f', 'bicicletas', 'las bicicletas', 'ninguna bicicleta', 'una bicicleta'], ru: ['велосипеды', 'велосипедов'] },
    boats: { en: 'boats', de: 'Boote', fr: ['m', 'bateaux', 'aucun bateau', 'un bateau'], it: ['f', 'barche', 'le barche', 'nessuna barca', 'una barca'], es: ['m', 'barcos', 'los barcos', 'ningún barco', 'un barco'], ru: ['лодки', 'лодок'] },
};

const W = (t) => `<span class="subj">${escapeHtml(t)}</span>`;
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);

// Each template gets the noun records of S and P and returns HTML.
const TEMPLATES = {
    en: {
        A: (s, p) => `All ${W(s)} are ${W(p)}`, E: (s, p) => `No ${W(s)} are ${W(p)}`,
        I: (s, p) => `Some ${W(s)} are ${W(p)}`, O: (s, p) => `Some ${W(s)} are not ${W(p)}`,
    },
    de: {
        A: (s, p) => `Alle ${W(s)} sind ${W(p)}`, E: (s, p) => `Keine ${W(s)} sind ${W(p)}`,
        I: (s, p) => `Einige ${W(s)} sind ${W(p)}`, O: (s, p) => `Einige ${W(s)} sind keine ${W(p)}`,
    },
    fr: {
        A: (s, p) => `${s[0] === 'f' ? 'Toutes' : 'Tous'} les ${W(s[1])} sont des ${W(p[1])}`,
        E: (s, p) => `${splitWord(cap(s[2]))} n’est ${splitWord(p[3])}`,
        I: (s, p) => `${s[0] === 'f' ? 'Certaines' : 'Certains'} ${W(s[1])} sont des ${W(p[1])}`,
        O: (s, p) => `${s[0] === 'f' ? 'Certaines' : 'Certains'} ${W(s[1])} ne sont pas des ${W(p[1])}`,
    },
    it: {
        A: (s, p) => `${s[0] === 'f' ? 'Tutte' : 'Tutti'} ${s[2].slice(0, s[2].indexOf(' '))} ${W(s[1])} sono ${W(p[1])}`,
        E: (s, p) => `${splitWord(cap(s[3]))} è ${splitWord(p[4])}`,
        I: (s, p) => `${s[0] === 'f' ? 'Alcune' : 'Alcuni'} ${W(s[1])} sono ${W(p[1])}`,
        O: (s, p) => `${s[0] === 'f' ? 'Alcune' : 'Alcuni'} ${W(s[1])} non sono ${W(p[1])}`,
    },
    es: {
        A: (s, p) => `${s[0] === 'f' ? 'Todas' : 'Todos'} ${s[2].slice(0, s[2].indexOf(' '))} ${W(s[1])} son ${W(p[1])}`,
        E: (s, p) => `${splitWord(cap(s[3]))} es ${splitWord(p[4])}`,
        I: (s, p) => `${s[0] === 'f' ? 'Algunas' : 'Algunos'} ${W(s[1])} son ${W(p[1])}`,
        O: (s, p) => `${s[0] === 'f' ? 'Algunas' : 'Algunos'} ${W(s[1])} no son ${W(p[1])}`,
    },
    ru: {
        A: (s, p) => `Все ${W(s[0])} — ${W(p[0])}`, E: (s, p) => `Среди ${W(s[1])} нет ${W(p[1])}`,
        I: (s, p) => `Некоторые ${W(s[0])} — ${W(p[0])}`, O: (s, p) => `Некоторые ${W(s[0])} — не ${W(p[0])}`,
    },
};

/** "nessun’aquila" → "nessun’" + noun, "un cane" → "un " + noun: only the noun is highlighted. */
function splitWord(phrase) {
    const m = phrase.match(/^(\S+?(?:’|\s))(.+)$/);
    return m ? escapeHtml(m[1]) + W(m[2]) : W(phrase);
}

const nounsFor = (lang) => (TEMPLATES[lang] ? lang : 'en');

/** A belief statement as HTML. */
export function renderBelief(form, s, p, lang) {
    const L = nounsFor(lang);
    return TEMPLATES[L][form](N[s][L], N[p][L]);
}

/** Plain name of a category (plural), for explanations. */
export function categoryName(id, lang) {
    const L = nounsFor(lang);
    const v = N[id][L];
    if (typeof v === 'string') return v;
    return L === 'ru' ? v[0] : v[1];
}
