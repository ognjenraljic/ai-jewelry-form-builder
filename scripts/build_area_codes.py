#!/usr/bin/env python3
"""Pozivni brojevi SAD/Kanade (+1) -> grad i država za portal (District 24.11.2026: "recognize area code (480)").

Država: iz Wikipedijine liste NANP brojeva (opis područja svakog broja, prvi pomenuti naziv države/provincije).
Grad: SAMO iz ručno provjerene liste ispod (veći gradovi); automatsko skraćivanje opisa je davalo greške
(937 = Dayton, ne Cincinnati), pa broj bez grada pokazuje samo državu.

  curl -s "https://en.wikipedia.org/w/index.php?title=List_of_North_American_Numbering_Plan_area_codes&action=raw" -o nanp.wiki
  python3 scripts/build_area_codes.py nanp.wiki   # piše public/area-codes.js
"""
import json, re, sys
from pathlib import Path

ST = {'Alabama':'AL','Alaska':'AK','Arizona':'AZ','Arkansas':'AR','California':'CA','Colorado':'CO','Connecticut':'CT','Delaware':'DE','District of Columbia':'DC','Washington, D.C.':'DC','Florida':'FL','Georgia':'GA','Hawaii':'HI','Idaho':'ID','Illinois':'IL','Indiana':'IN','Iowa':'IA','Kansas':'KS','Kentucky':'KY','Louisiana':'LA','Maine':'ME','Maryland':'MD','Massachusetts':'MA','Michigan':'MI','Minnesota':'MN','Mississippi':'MS','Missouri':'MO','Montana':'MT','Nebraska':'NE','Nevada':'NV','New Hampshire':'NH','New Jersey':'NJ','New Mexico':'NM','New York':'NY','North Carolina':'NC','North Dakota':'ND','Ohio':'OH','Oklahoma':'OK','Oregon':'OR','Pennsylvania':'PA','Rhode Island':'RI','South Carolina':'SC','South Dakota':'SD','Tennessee':'TN','Texas':'TX','Utah':'UT','Vermont':'VT','Virginia':'VA','West Virginia':'WV','Washington':'WA','Wisconsin':'WI','Wyoming':'WY','Puerto Rico':'PR','Alberta':'AB','British Columbia':'BC','Manitoba':'MB','New Brunswick':'NB','Newfoundland and Labrador':'NL','Newfoundland':'NL','Nova Scotia':'NS','Ontario':'ON','Prince Edward Island':'PE','Quebec':'QC','Québec':'QC','Saskatchewan':'SK','Northwest Territories':'NT','Yukon':'YT','Guam':'GU','U.S. Virgin Islands':'VI'}
FULL = {}
for n, a in ST.items(): FULL.setdefault(a, n)
FULL.update({'DC': 'Washington, DC', 'QC': 'Quebec', 'NL': 'Newfoundland and Labrador', 'YT': 'Canadian territories'})

# Ručno provjereni veći gradovi (prefiks -> grad); ostali brojevi pokazuju samo državu.
CITY = {}
def put(codes, city):
    for c in codes.split(): CITY[c] = city
for codes, city in [
  ('480', 'Phoenix East Valley'), ('602', 'Phoenix'), ('623', 'Phoenix West Valley'), ('520', 'Tucson'), ('928', 'Northern Arizona'),
  ('303 720 983', 'Denver'), ('719 748', 'Colorado Springs'), ('970', 'Fort Collins'),
  ('213 323', 'Los Angeles'), ('310 424', 'West Los Angeles'), ('818 747', 'San Fernando Valley'), ('626', 'San Gabriel Valley'), ('562', 'Long Beach'),
  ('714 657', 'Orange County'), ('949', 'Irvine'), ('909 840', 'Inland Empire'), ('951', 'Riverside'), ('619 858', 'San Diego'),
  ('415 628', 'San Francisco'), ('510 341', 'Oakland'), ('925', 'East Bay'), ('408 669', 'San Jose'), ('650', 'San Mateo'),
  ('916 279', 'Sacramento'), ('559', 'Fresno'), ('209 350', 'Stockton'), ('661', 'Bakersfield'), ('805 820', 'Santa Barbara'), ('707 369', 'Santa Rosa'), ('831', 'Monterey'),
  ('702 725', 'Las Vegas'), ('775', 'Reno'),
  ('214 469 972 945', 'Dallas'), ('817 682', 'Fort Worth'), ('713 281 832 346 621', 'Houston'), ('512 737', 'Austin'), ('210 726', 'San Antonio'),
  ('915', 'El Paso'), ('361', 'Corpus Christi'), ('806', 'Lubbock'), ('432', 'Midland'), ('254', 'Waco'), ('903 430', 'Tyler'), ('409', 'Beaumont'), ('325', 'Abilene'),
  ('305 786 645', 'Miami'), ('954 754', 'Fort Lauderdale'), ('561 728', 'West Palm Beach'), ('407 689', 'Orlando'), ('321', 'Orlando'), ('813 656', 'Tampa'),
  ('727', 'St. Petersburg'), ('904 324', 'Jacksonville'), ('850 448', 'Tallahassee'), ('239', 'Fort Myers'), ('941', 'Sarasota'), ('863', 'Lakeland'),
  ('352', 'Gainesville'), ('386', 'Daytona Beach'), ('772', 'Port St. Lucie'),
  ('404 678 470 943', 'Atlanta'), ('770', 'Atlanta suburbs'), ('912', 'Savannah'), ('478', 'Macon'),
  ('212 646 332', 'Manhattan'), ('917', 'New York City'), ('718 347 929', 'New York City'), ('516 363', 'Long Island'), ('631 934', 'Long Island'),
  ('914', 'Westchester'), ('518 838', 'Albany'), ('315 680', 'Syracuse'), ('585', 'Rochester'), ('716', 'Buffalo'),
  ('201 551', 'Jersey City'), ('973 862', 'Newark'), ('732 848', 'Central New Jersey'), ('609 640', 'Trenton'), ('856', 'Camden'),
  ('215 267 445', 'Philadelphia'), ('610 484 835', 'Philadelphia suburbs'), ('412 878', 'Pittsburgh'), ('724', 'Pittsburgh suburbs'), ('717 223', 'Harrisburg'), ('570 272', 'Scranton'),
  ('312 872 773', 'Chicago'), ('847 224', 'Chicago north suburbs'), ('630 331', 'Chicago west suburbs'), ('708 464', 'Chicago south suburbs'), ('815 779', 'Rockford'), ('309 861', 'Peoria'),
  ('617 857', 'Boston'), ('781 339', 'Boston suburbs'), ('978 351', 'Lowell'), ('508 774', 'Worcester'), ('413', 'Springfield'),
  ('313 679', 'Detroit'), ('248 947', 'Oakland County'), ('586', 'Macomb County'), ('734', 'Ann Arbor'), ('616', 'Grand Rapids'), ('517', 'Lansing'), ('810', 'Flint'),
  ('216', 'Cleveland'), ('440', 'Cleveland suburbs'), ('330 234', 'Akron'), ('614 380', 'Columbus'), ('513 283', 'Cincinnati'), ('937 326', 'Dayton'), ('419 567', 'Toledo'),
  ('206', 'Seattle'), ('425', 'Bellevue'), ('253', 'Tacoma'), ('509', 'Spokane'), ('503 971', 'Portland'), ('541 458', 'Eugene'),
  ('202 771', 'Washington'), ('301 240 227', 'DC suburbs'), ('410 443 667', 'Baltimore'), ('703 571', 'Northern Virginia'), ('804 686', 'Richmond'), ('757 948', 'Virginia Beach'),
  ('704 980', 'Charlotte'), ('919 984', 'Raleigh'), ('336 743', 'Greensboro'), ('828', 'Asheville'), ('803 839', 'Columbia'), ('843 854', 'Charleston'), ('864 821', 'Greenville'),
  ('615 629', 'Nashville'), ('901', 'Memphis'), ('865', 'Knoxville'), ('423 729', 'Chattanooga'), ('502', 'Louisville'), ('859', 'Lexington'),
  ('317 463', 'Indianapolis'), ('260', 'Fort Wayne'), ('574', 'South Bend'), ('314 557', 'St. Louis'), ('636', 'St. Louis suburbs'), ('816 975', 'Kansas City'), ('417', 'Springfield'),
  ('913', 'Kansas City'), ('316', 'Wichita'), ('785', 'Topeka'), ('612', 'Minneapolis'), ('651', 'Saint Paul'), ('763', 'Minneapolis suburbs'), ('952', 'Minneapolis suburbs'), ('218', 'Duluth'),
  ('414', 'Milwaukee'), ('262', 'Milwaukee suburbs'), ('608', 'Madison'), ('920', 'Green Bay'),
  ('504', 'New Orleans'), ('225', 'Baton Rouge'), ('337', 'Lafayette'), ('318', 'Shreveport'), ('205 659', 'Birmingham'), ('256 938', 'Huntsville'), ('251', 'Mobile'), ('334', 'Montgomery'),
  ('601 769', 'Jackson'), ('501', 'Little Rock'), ('405 572', 'Oklahoma City'), ('918 539', 'Tulsa'), ('505', 'Albuquerque'), ('575', 'Las Cruces'), ('801 385', 'Salt Lake City'),
  ('402 531', 'Omaha'), ('515', 'Des Moines'), ('319', 'Cedar Rapids'), ('203 475', 'New Haven'), ('860 959', 'Hartford'),
  ('416 647 437', 'Toronto'), ('905 289 365 742', 'Greater Toronto Area'), ('514 438 263', 'Montreal'), ('418 581 367', 'Quebec City'), ('613 343 753', 'Ottawa'),
  ('604', 'Vancouver'), ('403', 'Calgary'), ('780', 'Edmonton'), ('519 226 548', 'London'),
]: put(codes, city)

def strip(s):
    s = re.sub(r"\{\{[^{}]*\}\}", "", s)
    s = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]*)\]\]", r"\1", s)
    s = re.sub(r"<ref[^>]*/>|<ref[^>]*>.*?</ref>", "", s, flags=re.S)
    s = re.sub(r"'{2,}", "", s); s = re.sub(r"<[^>]+>", "", s)
    return re.sub(r"\s+", " ", s).strip()

def state_of(t):
    best = None
    for n, a in ST.items():
        m = re.search(r'(?<![A-Za-z])' + re.escape(n) + r'(?![A-Za-z])', t)
        if not m: continue
        if n == 'Washington' and re.match(r', D\.C\.', t[m.end():]): continue
        # Prvi pomenuti naziv je država broja ("Maryland (Baltimore... Delaware...)"); kod istog početka duži naziv.
        if best is None or m.start() < best[0] or (m.start() == best[0] and len(n) > best[1]): best = (m.start(), len(n), a)
    return best[2] if best else None

def main(path):
    text = Path(path).read_text()
    out = {}
    for r in text.split('\n|-\n'):
        m = re.match(r"\s*\|\s*\[\[area codes? (\d{3})[^\]]*\]\]\s*\n\|\s*(.*?)\n", r)
        if not m: continue
        desc = strip(m.group(2))
        st = state_of(desc)
        if not st: continue
        out[m.group(1)] = f"{CITY.get(m.group(1), '')}|{st}"
    missing = sorted(set(CITY) - set(out))
    if missing: print('UPOZORENJE: grad bez broja u listi:', missing)
    js = ('// Generisano: scripts/build_area_codes.py (Wikipedia lista NANP brojeva + ručno provjereni gradovi). Ne mijenjati ručno.\n'
          f'export const AREA_CODES = {json.dumps(out, separators=(",", ":"))};\n'
          f'export const REGION_NAMES = {json.dumps(FULL, separators=(",", ":"))};\n'
          "// '+1 (480) 465-7783' -> { code: '480', city: 'Phoenix East Valley', state: 'AZ', label: 'Phoenix East Valley, AZ' }\n"
          'export function areaOf(phone) {\n'
          "  const d = String(phone || '').replace(/\\D/g, '');\n"
          "  const n = d.length === 11 && d[0] === '1' ? d.slice(1) : d.length === 10 ? d : '';\n"
          "  if (!n || !String(phone).trim().match(/^(\\+?1\\b|\\(|\\d)/)) return null;\n"
          '  const v = AREA_CODES[n.slice(0, 3)];\n'
          '  if (!v) return null;\n'
          "  const [city, state] = v.split('|');\n"
          "  return { code: n.slice(0, 3), city, state, region: REGION_NAMES[state] || state, label: city ? `${city}, ${state}` : REGION_NAMES[state] || state };\n"
          '}\n')
    Path(__file__).resolve().parent.parent.joinpath('public/area-codes.js').write_text(js)
    print(len(out), 'brojeva,', sum(1 for v in out.values() if not v.startswith('|')), 'sa gradom')

if __name__ == '__main__':
    main(sys.argv[1])
