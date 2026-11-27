// Model families for the classic (non-BMW) data-book makes: which model page a sheet goes on.
// Rules are tried in order (first match wins); otherwise the first word of the model name is the family.
const MAKES = {
  'ALFA ROMEO': 'Alfa Romeo', AUDI: 'Audi', 'CHRYSLER JEEP': 'Chrysler / Jeep', 'CITROËN': 'Citroën', DACIA: 'Dacia', DAEWOO: 'Daewoo',
  DAIHATSU: 'Daihatsu', FIAT: 'Fiat', FORD: 'Ford', FSO: 'FSO', HONDA: 'Honda', HYUNDAI: 'Hyundai', ISUZU: 'Isuzu', 'JAGUAR/DAIMLER': 'Jaguar / Daimler',
  KIA: 'Kia', LADA: 'Lada', LANCIA: 'Lancia', 'LAND ROVER': 'Land Rover', 'LEYLAND DAF (LDV)': 'LDV (Leyland DAF)', LOTUS: 'Lotus', MAZDA: 'Mazda',
  'MERCEDES-BENZ': 'Mercedes-Benz', MITSUBISHI: 'Mitsubishi', MORGAN: 'Morgan', NISSAN: 'Nissan', 'PEUGEOT-TALBOT': 'Peugeot / Talbot', PORSCHE: 'Porsche',
  PROTON: 'Proton', RELIANT: 'Reliant', RENAULT: 'Renault', ROVER: 'Rover', SAAB: 'Saab', SAO: 'SAO', SEAT: 'SEAT', SKODA: 'Škoda', SUBARU: 'Subaru',
  SUZUKI: 'Suzuki', TOYOTA: 'Toyota', TVR: 'TVR', 'VAUXHALL/OPEL': 'Vauxhall / Opel', VOLKSWAGEN: 'Volkswagen', VOLVO: 'Volvo', 'YUGO/ZASTAVA': 'Yugo / Zastava',
};
const SLUG = { 'Chrysler / Jeep': 'chrysler-jeep', 'Jaguar / Daimler': 'jaguar', 'LDV (Leyland DAF)': 'ldv', 'Peugeot / Talbot': 'peugeot', 'Vauxhall / Opel': 'vauxhall-opel', 'Yugo / Zastava': 'yugo-zastava' };
const R = {
  'ALFA ROMEO': [[/^Alfa Sprint/, 'Sprint'], [/^(GTV|Spider)/, 'GTV & Spider'], [/^(145|146)/, '145 / 146']],
  AUDI: [[/^(80|90)\b/, '80 / 90']],
  'CITROËN': [[/^C15/, 'C15'], [/^C25/, 'C25'], [/^2CV/, '2CV']],
  DAIHATSU: [[/^(Hi-?Jet)/i, 'Hijet'], [/^(F80|Fourtrak)/, 'Fourtrak']],
  FIAT: [[/^Bertone X1/, 'X1/9'], [/^(Strada|Ritmo)/, 'Strada']],
  FORD: [[/^Sapphire/, 'Sierra'], [/^P100/, 'P100 pick-up']],
  HYUNDAI: [[/^S?Coupé/, 'Coupé']],
  'JAGUAR/DAIMLER': [[/^(XJ6|XJR\b)/, 'XJ6 / XJR'], [/^(XJ12|V12)/, 'XJ12 / Double Six'], [/^XJR?-S/, 'XJ-S'], [/^XK/, 'XK8'], [/^Daimler/, 'Daimler Limousine']],
  LADA: [[/^1[2-6]00/, 'Riva (1200–1600)']],
  'LAND ROVER': [[/^(90|110|Defender)/, 'Defender / 90 / 110'], [/^Range/, 'Range Rover']],
  'LEYLAND DAF (LDV)': [[/^200/, '200 Series'], [/^300/, '300 Series'], [/^400/, '400 Series']],
  MAZDA: [[/^(2000|B2000)/, 'B2000 / 929'], [/^RX/, 'RX-7']],
  'MERCEDES-BENZ': [
    [/^190/, '190 (W201)'], [/^C\d/, 'C-Class (W202)'], [/^\d{3} ?GE|^G\d/, 'G-Class'], [/^210|^310|^410/, 'T1 van (210–410)'], [/Sprinter/, 'Sprinter'],
    [/\(107\.|^\d{3} ?SL \(107|^\d{3}SL \(107/, 'SL (R107)'], [/\(129\.|^SL\d/, 'SL (R129)'], [/\(140|^S\d/, 'S-Class (W140)'],
    [/\(126\.|^\d{3} ?S(E|EL|EC)\b/, 'S-Class (W126)'], [/\(124\.|^E\d|^\d{3} ?(E|TE|CE|T)\b|^\d{3}E/, 'E-Class & 200–300 (W124)']],
  MITSUBISHI: [[/^Space/, 'Space Wagon / Runner'], [/^3000/, '3000GT'], [/^L[23]00/, 'L200 / L300']],
  MORGAN: [[/^Plus 4/, 'Plus 4'], [/^Plus 8/, 'Plus 8'], [/^4 ?\/ ?4/, '4/4']],
  NISSAN: [[/^(Silvia|200 ?SX)/, '200SX / Silvia'], [/^300 ?ZX/, '300ZX'], [/^300 C/, '300C (Laurel)'], [/^(2WD|4x4) (Pick|Wagon)/, 'Pick-up (D21)'], [/^(QX|Maxima)/, 'Maxima / QX'], [/^Laurel/, '300C (Laurel)'], [/^200\b/, '200SX / Silvia']],
  'PEUGEOT-TALBOT': [[/^J5/, 'J5']],
  PORSCHE: [[/^924/, '924'], [/^928/, '928']],
  PROTON: [[/^1\.[35]/, 'MPi (1.3 / 1.5)']],
  ROVER: [[/^(1[01]\d\b|Metro)/, 'Metro / 100'], [/^(2\d\d|Coupé)/, '200'], [/^4\d\d/, '400'], [/^6\d\d/, '600'], [/^8\d\d/, '800'], [/^MG/, 'MGF']],
  SAAB: [[/^900/, '900'], [/^9000/, '9000']],
  SKODA: [[/^(136G|Rapid)/, 'Rapid']],
  SUBARU: [[/^(1800|1\.8|L-Series)/, 'L-Series / 1800'], [/^700/, 'Rex 700']],
  SUZUKI: [[/^(SJ|Samurai)/, 'SJ / Samurai'], [/^Super/, 'Super Carry']],
  TOYOTA: [[/^Land/, 'Land Cruiser'], [/^RAV/, 'RAV4'], [/^Hi-?Lux/, 'Hilux'], [/^Hi-?Ace/, 'HiAce'], [/^Lite-?Ace/, 'LiteAce']],
  TVR: [[/^(2[89]0i|3[59]0i|4[025]0|S \()/, 'Wedge & S Series'], [/^S\b/, 'Wedge & S Series']],
  'VAUXHALL/OPEL': [[/^Corsa/, 'Corsa'], [/^Astra/, 'Astra'], [/^Manta/, 'Manta'], [/^Vectra/, 'Vectra'], [/^Omega/, 'Omega'], [/^Senator/, 'Senator'], [/^(Brava|Midi|Rascal|KB)/, 'Commercial (Brava, Midi, Rascal)']],
  VOLVO: [[/^(4[04]0|460)/, '400 Series'], [/^[SV]40/, 'S40 / V40'], [/^3[046]0/, '300 Series'], [/^7[46]0/, '700 Series'], [/^9[046]0/, '900 Series']],
  'YUGO/ZASTAVA': [[/^\d\dA/, 'Yugo 45 / 55 / 65'], [/^(311|1\.3|Sana)/, 'Zastava / Sana']],
};
const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function family(make, model) {
  for (const [re, name] of R[make] || []) if (re.test(model)) return name;
  const w = model.trim().split(/[\s,/&(]/)[0];
  return w;
}
module.exports = { MAKES, family, slug, makeSlug: (name) => SLUG[name] || slug(name) };
